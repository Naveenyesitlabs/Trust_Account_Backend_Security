const { respond, HTTP_STATUS_CODE, calculateInterestRates, all_bank_charges_regex, extractTransactionIds } = require("../../utils/reponseHelper");
const path = require('path');
const { proccessOcr } = require("../../services/BankStatementParser");
const { accountDetails } = require("../../model/user/allClientsModel");
const { getAdminId, getLoggedInUserInfo } = require("../../model/admin/userManagementModel");
const { insertBankStatements, getBankStatements, insertBankTransaction, getFirmName, getLastBankStatement, getLastBankStatementBalance } = require("../../model/user/bankStatementsModel");
const { getJournalBalance, addJurnalEntry, checkJournalExist, getBankChargeLedgerBalance, removeFromOutstanding, isLedgerClientExists, updateJournalReconciliatioBankStatementDB, testFetchJournal } = require("../../model/admin/journalEntryModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");


/**
 * Finds the balance for a given transaction date by looking up the most recent daily balance
 * and then applying all transactions that occurred between that balance and the transaction date.
 * @param {object} transaction - The transaction to find the balance for
 * @param {array} dailyBalances - An array of daily balances in ascending order of date
 * @param {array} transactions - An array of transactions in ascending order of date
 * @returns {number} The balance for the transaction date
 */
function findDailyBalanceForTransaction(transaction, dailyBalances, transactions) {
  const transDate = transaction.date;

  // Try to find exact date match first
  const exactMatch = dailyBalances.find(d => d.date === transDate);
  if (exactMatch) {
    return exactMatch.amount;
  }

  // Find all daily balances before the transaction date
  const previousBalances = dailyBalances.filter(d => d.date < transDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (previousBalances.length === 0) {
    // No previous balance found - this shouldn't happen if beginningBalance is available
    return 0; // or you might return the beginningBalance
  }

  // Get the most recent previous balance
  const mostRecentBalance = previousBalances[0];
  let runningBalance = mostRecentBalance.amount;
  const mostRecentBalanceDate = mostRecentBalance.date;

  // Find all transactions between the most recent balance date and the transaction date
  const relevantTransactions = transactions.filter(t =>
    t.date > mostRecentBalanceDate && t.date <= transDate
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Apply these transactions to the balance
  for (const t of relevantTransactions) {
    runningBalance += (t.credit || 0) - (t.debit || 0);
  }

  return runningBalance;
}


/**
 * To upload bank statement and parsing data from IOLTA bank statement uploaded
 * Method: POST
 * Endpoint: /user/bank-statement/upload
 * @param {*} req 
 * @param {*} res 
 */
const uploadBankStatement = async (req, res) => {
  try {
    const file = req.file;
    const logged_in_user_id = req?.user?.userid || null;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(logged_in_user_id);
    const { bank_name, bank_info } = req.body;
    const logged_in_user_info = await getLoggedInUserInfo(logged_in_user_id);
    if (!file) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "No file uploaded.");
    const filePath = path.resolve('src/uploads', file.filename);

    // process OCR
    const parsedData = await proccessOcr(filePath, file.mimetype);
    console.log("Parsed Data: ", parsedData);
    // return respond(res, true, HTTP_STATUS_CODE.OK, 'File uploaded and data extracted.', parsedData);
    if (!parsedData) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Failed to extract valid data from file.");

    const transaction_count = parsedData.transaction_count;
    const beginningBalance = parsedData.beginningBalance;
    const transactions = parsedData.transactions;
    const dailyBalances = parsedData.dailyBalances;
    const accountData = parsedData.ownerData || [];
    const interest = calculateInterestRates(parsedData);

    // creating new client if account number is new to the system
    let client_id = null;
    // checking this account number is exist or not
    const existingClient = await accountDetails(adminId, bank_name, accountData?.accountNumber);
    const account_bank_name = bank_name || parsedData.bankName;
    const firm_name = await getFirmName(adminId);

    if (existingClient === null) {
      // if no existing client then creating a new client
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "No client account found.");
    } else {
      // if existing client then getting the client_id
      client_id = existingClient;
    }

    const today = new Date().toLocaleDateString('en-CA');

    let periodFrom = new Date(accountData?.statementPeriod?.from);
    let periodTo = new Date(accountData?.statementPeriod?.to);
    periodFrom.setDate(periodFrom.getDate() + 1);
    periodTo.setDate(periodTo.getDate() + 1);

    const statement_id = await insertBankStatements({
      date: today,
      user_name: accountData?.accountName || logged_in_user_info?.name,
      bank_name: bank_name || parsedData.bankName,
      account_number: accountData?.accountNumber,
      statement_period: `${periodFrom.toLocaleDateString('en-CA')}_${periodTo.toLocaleDateString('en-CA')}`,
      statement_period_start: periodFrom.toLocaleDateString('en-CA'),
      statement_period_end: periodTo.toLocaleDateString('en-CA'),
      account_start_date: periodFrom.toLocaleDateString('en-CA') || null,
      account_end_date: periodTo.toLocaleDateString('en-CA') || null,
      ending_balance: parsedData.endingBalance,
      account_details: bank_info,
      upload_document: path.join('src/uploads', file.filename),
      // account_start_date: accountData?.accountStartDate || null,
      // account_end_date: accountData?.accountEndDate || null,
      account_description: accountData?.accountDescription || null,
      interest_rate: !isNaN(interest.annualInterestRate) ? interest.annualInterestRate || 0 : 0,
      client_id,
      userId: logged_in_user_id,
      adminId
    })

    if (!statement_id) {
      return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Failed to insert bank statement");
    }


    if (transactions.length > 0) {
      console.log("Inserting transactions...");
      console.log("Total transactions to insert:", transactions.length);
      let count = 0;

      const lastBankStatementBalance = await getLastBankStatementBalance(adminId);
      let lastBankBalance = 0;
      if (Number(lastBankStatementBalance) !== 0) {
        lastBankBalance = Number(lastBankStatementBalance);
      } else {
        lastBankBalance = Number(beginningBalance);
      }
      console.log("Last Bank Balance before inserting transactions: ", lastBankBalance);
      for (const transaction of transactions) {
        const daily_balance = findDailyBalanceForTransaction(transaction, dailyBalances, transactions);
        const disbursement_amount = transaction.type === "debit" ? Number(transaction.debit) : 0;
        const deposit_amount = transaction.type === "credit" ? Number(transaction.credit) : 0;
        let transaction_method = 'Electronic Transfer';
        if (transaction?.checkNumber && transaction?.checkNumber !== '') {
          transaction_method = 'Check';
        }
        console.log(`Deposit Amount: ${deposit_amount}, Disbursement Amount: ${disbursement_amount} for transaction date: ${transaction.date}`);
        const daily_bank_balance = Number(lastBankBalance) + Number(deposit_amount) - Number(disbursement_amount);
        lastBankBalance = daily_bank_balance;
        console.log(`Calculated daily bank balance: ${daily_bank_balance} for transaction date: ${transaction.date}`);
        // let date = new Date(transaction.date);
        // date.setDate(date.getDate() + 1);
        const insert_transaction = await insertBankTransaction({
          bank_statement_id: statement_id,
          date: transaction.date,
          payee_name: transaction?.payee_name || null,
          transaction_method,
          cheque_number: transaction?.checkNumber || null,
          purpose: transaction?.description || null,
          disbursement_amount,
          deposit_amount,
          daily_balance: daily_balance || 0,
          daily_bank_balance: daily_bank_balance || 0,
          adminId,
          userId: logged_in_user_id,
          reconciled_to_journal: 0,
        });

        if (!insert_transaction) {
          return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Failed to insert transaction for date: " + transaction.date);
        }

        const client_name = accountData?.accountName;
        const openingBalance = count === 0 ? beginningBalance : 0;//dailyBalances[count - 1].balance;
        // inserting journal and ledger
        // console.log("transaction: ", transaction);
        const journalAndLedgers = await insertJournalAndLedgers(transaction, openingBalance, client_name, client_id, adminId, logged_in_user_id);
        count++;

        if (!journalAndLedgers) {
          return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Failed to insert journal and ledger for transaction");
        }

      }
    }

    return respond(res, true, HTTP_STATUS_CODE.OK, "Bank statement uploaded successfully.", parsedData);
  } catch (error) {
    respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}

/**
 * To fetch bank statements
  * Method: GET
 * Endpoint: /user/bank-statement
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const fetchBankStatements = async (req, res) => {
  try {

    const logged_in_user_id = req?.user?.userid || null;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(logged_in_user_id);
    const bankStatements = await getBankStatements(adminId);
    // formatting the fetched data from database
    bankStatements.forEach((statement) => {
      statement.date = new Date(statement.date).toLocaleDateString('en-CA');
      statement.ending_balance = Number(statement.ending_balance);
      statement.daily_balance = Number(statement.daily_bank_balance);
      statement.amount = Number(statement.amount);
      statement.interest_rate = Number(statement.interest_rate);
    });

    // formatting for serial number
    const formattedData = await addSerialNoComman(bankStatements);

    return respond(res, true, HTTP_STATUS_CODE.OK, "Bank statements fetched successfully.", formattedData);
  } catch (error) {
    respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}

/**
 * Inserting journal and ledger for each transaction
 * @param {*} transaction 
 */
const insertJournalAndLedgers = async (transaction, openingBalance, client_name, client_id, adminId, userId, role = "user") => {
  try {
    if (transaction) {
      const { date, checkNumber, description, debit, credit, type } = transaction;

      if (Number(openingBalance) > 0) {
        const journalTransaction = await checkJournalExist({ date, cheque_number: null, deposit_amount: Number(openingBalance), disbursement_amount: 0 }, client_id, adminId, userId, role);
        if (journalTransaction?.isExist) {

          await removeFromOutstanding(journalTransaction?.data?.id);
          let ledger_client_id = journalTransaction?.data?.ledger_client_id || null;


          await updateJournalReconciliatioBankStatementDB({ id: journalTransaction?.data?.id, reconciled_to_bank_statement: 1 });
        }
      }

      // fetching journal balance
      const journalBalance = Number(openingBalance) > 0 ? openingBalance : await getJournalBalance(client_id, adminId, userId, role);
      const deposit_amount = type === "credit" ? Number(credit) : 0;
      const disbursement_amount = type === "debit" ? Number(debit) : 0;
      // calculating journal running balance
      const journal_running_balance =
        Number(journalBalance) +
        Number(deposit_amount) -
        Number(disbursement_amount);

      let is_bank_charge = false;
      let ledgerBalance = 0;
      let ledger_running_balance = 0;
      let reconciled_to_ledger = false;
      let reconciled_to_bank_statement = true;

      // for bank charges ledger entry
      const payee_name = client_name || "";
      let cheque_number = null;
      if (checkNumber !== null && checkNumber !== "" && checkNumber !== undefined) {
        cheque_number = checkNumber;
      } else {
        // to pick transaction id from description
        // const checkNumberData = extractTransactionIds(description)
        // if (checkNumberData.length > 0) {
        //   cheque_number = checkNumberData[0];
        // }

        if (deposit_amount > 0) {
          const checkNumberData = extractTransactionIds(description);

          if (
            checkNumberData.length > 0 &&
            /\d/.test(checkNumberData[0]) // must contain at least one digit
          ) {
            cheque_number = checkNumberData[0];
          }
        }
      }
      let bank_ledger_balance = 0;
      const purpose = description || "";
      const transaction_method = checkNumber ? "Check" : "Electronic Transfer";

      if (description.includes("Bank Charges") || description.includes("Interest")) {
        is_bank_charge = true;
        const bank_charges_ledger_balance = await getBankChargeLedgerBalance(client_id, adminId, null, null);
        bank_ledger_balance =
          Number(bank_charges_ledger_balance) +
          Number(deposit_amount) -
          Number(disbursement_amount);
        // const formattedDate = new Date(date);
        // formattedDate.setDate(formattedDate.getDate() + 1);
        const finalDate = date;

        const { id } = await addJurnalEntry({
          client_id, date: finalDate, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: 0, bank_ledger_balance, notes: null, reconciled_to_ledger, reconciled_to_bank_statement: true, ledger_client_id: null, adminId, userId, is_bank_charge, is_outstanding: false
        });
      }
      // checking this transaction
      const journalTransaction = await checkJournalExist({ date, cheque_number, deposit_amount, disbursement_amount }, client_id, adminId, userId, role);
      if (journalTransaction?.isExist) {

        await removeFromOutstanding(journalTransaction?.data?.id);
        let ledger_client_id = journalTransaction?.data?.ledger_client_id || null;


        await updateJournalReconciliatioBankStatementDB({ id: journalTransaction?.data?.id, reconciled_to_bank_statement: 1 });
      }


      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
    return false;
  }
}


const getLastUploadedBankStatement = async (req, res) => {
  try {
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const bankStatement = await getLastBankStatement(adminId);
    // const dataWithSerialNo = await addSerialNoComman(bankStatement);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Bank statement fetched successfully", bankStatement);
  } catch (error) {
    respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  uploadBankStatement,
  fetchBankStatements,
  getLastUploadedBankStatement
}
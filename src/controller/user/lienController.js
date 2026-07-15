const { getJournalBalance, getLedgerBalance, addJurnalEntry } = require("../../model/admin/journalEntryModel");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { getTrustClientId } = require("../../model/user/allClientsModel");
const { addLienDB, addLienTransactionDB, getLienLedgerBalanceDB, getLiensDB, getLienTransactionsDB, updateLienStatusToResolveDB, getMatterByLienId } = require("../../model/user/lienModel");
const { getMatterByClientId } = require("../../model/user/matterModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { addNotification } = require("../../utils/notificationHelper");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");

const addLienSchema = Joi.object({
  ledger_client_id: Joi.number().required().messages({
    'any.required': 'Client ID is mandatory.',
  }),
  matter: Joi.string().required().messages({
    'any.required': 'Matter is mandatory.',
  }),
  description: Joi.string().allow(null, "").optional(),
  amount: Joi.number().required().messages({
    'any.required': 'Amount is mandatory.',
  }),
  opened_on: Joi.string().required().messages({
    'any.required': 'Open date is mandatory.',
  }),
  case_date: Joi.date().required().messages({
    'any.required': "Please enter case date",
    'date.base': "Case date must be a valid date",
    'any.invalid': "Invalid case date"
  }),
  notes: Joi.string().allow(null, "").optional(),
});


/**
 * Adds a new lien to the system.
 *
 * This function validates the request body using `addLienSchema` and, if valid,
 * creates a new lien entry in the database. It requires the user to be logged in,
 * and uses the logged-in user's ID to associate the lien with the correct admin.
 *
 * @param {Object} req - The request object containing the user information and lien data.
 * @param {Object} res - The response object used to return the outcome of the operation.
 *
 * @throws {Error} If a server error occurs during the lien creation process.
 */
const addLienController = async (req, res) => {
  try {
    const { error } = addLienSchema.validate(req.body);
    if (error) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
    }
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const { ledger_client_id, matter, amount, opened_on, description, case_date, notes } = req.body;
    const inserted = await addLienDB({ ledger_client_id, matter, amount, opened_on, description, case_date, notes, adminId, userId });
    if (!inserted) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Failed to create lien.");
    }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Lien added successfully.");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


const addLienTransactionSchema = Joi.object({
  lien_id: Joi.number().required().messages({
    'any.required': 'Lien ID is mandatory.',
  }),
  ledger_client_id: Joi.number().required().messages({
    'any.required': 'Client ID is mandatory.',
  }),
  date: Joi.date().required().messages({
    'any.required': "Please enter date",
    'date.base': "Date must be a valid date",
    'any.invalid': "Invalid date"
  }),
  payee: Joi.string().required().messages({
    'any.required': 'Payee name is required.',
  }),
  transaction_type: Joi.string().required().messages({
    'any.required': 'Transaction type is required.',
  }),
  transaction_method: Joi.string().required().messages({
    'any.required': 'Transaction method is required.',
  }),
  transaction_number: Joi.string().allow(null, "").optional(),
  purpose: Joi.string().allow(null, "").optional(),
  amount: Joi.number().required().messages({
    'any.required': 'Amount is mandatory.',
  }),
  notes: Joi.string().allow(null, "").optional(),
});


/**
 * Controller to add a lien transaction.
 *
 * This function validates the request body against the addLienTransactionSchema,
 * retrieves the user and admin IDs, calculates the updated lien balance, and
 * inserts a new lien transaction entry into the database. It responds with an
 * appropriate success or error message based on the outcome of the operation.
 *
 * @param {Object} req - The request object containing the lien transaction data.
 * @param {Object} res - The response object used to send back the HTTP response.
 */
const addLienTransactionController = async (req, res) => {
  try {
    const { error } = addLienTransactionSchema.validate(req.body);
    if (error) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
    }
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const { lien_id, ledger_client_id, date, payee, transaction_method, transaction_type, transaction_number, purpose, amount, notes } = req.body;
    const matter = await getMatterByLienId(lien_id);
    // const client_id = await getTrustClientId(ledger_client_id);
    const current_lien_balance = await getLienLedgerBalanceDB(lien_id, ledger_client_id, adminId);
    const deposit_amount = transaction_type === "deposit" ? amount : 0;
    const disbursement_amount = transaction_type === "disbursement" ? amount : 0;
    const lien_balance = Number(current_lien_balance) + Number(deposit_amount) - Number(disbursement_amount);
    let status = 'Open';
    if (Number(lien_balance) <= 0) {
      status = 'Resolved';
      await updateLienStatusToResolveDB(lien_id);
      //  await addNotification("You account has been created successfully", "admin", 'subscription', 'Welcome Admin!', user_id);
      // title, message, type = 'other', notification_for = 'superadmin', user_id
      await addNotification('Lien Resolved', `${matter || 'Matter'} has been resolved`, 'other', 'user', userId);
      await addNotification('Lien Resolved', `${matter || 'Matter'} has been resolved`, 'other', 'admin', adminId);
    }
    const inserted = await addLienTransactionDB({ lien_id, ledger_client_id, date, payee, transaction_method, transaction_number, purpose, deposit_amount, disbursement_amount, lien_balance, adminId, userId });
    if (!inserted) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Failed to add lien transaction.");
    }
    // const insertJournal = await insertLienTransactionIntoJournal({ lien_id, payee_name: payee, date, transaction_method, cheque_number: transaction_number, purpose, notes, ledger_client_id, deposit_amount, disbursement_amount, client_id, adminId, userId });
    // if (!insertJournal) {
    //   return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Failed to add lien transaction into journal.");
    // }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Lien transaction added successfully.");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Inserts a journal entry for a given lien transaction.
 *
 * This function takes a lien transaction, fetches the current balance on the
 * transaction date month, calculates the journal running balance and ledger
 * running balance, and then inserts a journal entry based on the supplied
 * transaction data. It also handles bank charges ledger entries if needed.
 *
 * @param {Object} lienTransaction - The lien transaction object containing the
 * transaction details.
 *
 * @returns {boolean} True if the journal entry was inserted successfully, false
 * otherwise.
 */
const insertLienTransactionIntoJournal = async ({ lien_id, payee_name, date, transaction_method, cheque_number, purpose, notes, ledger_client_id, deposit_amount, disbursement_amount, client_id, adminId, userId }) => {
  try {
    // fetching current balance on transaction date month
    const journalBalance = await getJournalBalance(client_id, adminId, userId, '');
    // calculating journal running balance
    const journal_running_balance = Number(journalBalance) + Number(deposit_amount) - Number(disbursement_amount);
    // for bank charges ledger entry
    let is_bank_charge = false;
    let bank_ledger_balance = 0;
    let ledger_running_balance = 0;
    // fetching ledger balance
    const ledgerBalance = await getLedgerBalance(ledger_client_id, null, adminId, userId, '');
    // calculating ledger running balance
    ledger_running_balance = Number(ledgerBalance) + Number(deposit_amount) - Number(disbursement_amount);
    const inserted = await addJurnalEntry({
      client_id, date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: ledger_running_balance, bank_ledger_balance, notes, reconciled_to_ledger: false, reconciled_to_bank_statement: false, ledger_client_id, matter_id: null, adminId, userId, is_bank_charge, is_outstanding: true, is_lien: true, lien_id
    });
    if (!inserted?.id) {
      return false;
    }
    return true;
  } catch (err) {
    throw new Error("Error at insertLienTransactionIntoJournal: " + err.message);
  }
}


/**
 * Retrieves all liens associated with the logged in user.
 *
 * This function retrieves the user and admin IDs, fetches all liens associated
 * with the admin ID from the database, adds serial numbers to the result, and
 * responds with the result.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the HTTP response.
 */
const getLiensController = async (req, res) => {
  try {
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const liens = await getLiensDB(adminId);
    const dataWithSerialNo = await addSerialNoComman(liens);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Liens fetched successfully", dataWithSerialNo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Retrieves lien transactions for a specific lien ID.
 *
 * This function validates the lien ID from the request parameters, retrieves
 * the user and admin IDs, fetches lien transactions associated with the lien ID
 * from the database, adds serial numbers to the result, and responds with the
 * result.
 *
 * @param {Object} req - The request object containing parameters and user information.
 * @param {Object} res - The response object used to send back the HTTP response.
 *
 * @throws {Error} If a server error occurs during the lien transaction retrieval process.
 */
const getLienTransactionController = async (req, res) => {
  try {
    const { lien_id } = req.params;
    if (!lien_id || lien_id == 'undefined' || lien_id == 'null' || lien_id == '') {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Lien ID is required.");
    }
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const lienTransactions = await getLienTransactionsDB(lien_id, adminId);
    const dataWithSerialNo = await addSerialNoComman(lienTransactions);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Lien transactions fetched successfully", dataWithSerialNo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  addLienController,
  addLienTransactionController,
  getLiensController,
  getLienTransactionController
}
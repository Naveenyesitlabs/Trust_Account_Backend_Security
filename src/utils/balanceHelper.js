const { getLedgerBalanceAfterDeletedRow, updateLedgerBalanceAfterDelete, getCaseLedgerBalanceAfterDeletedRow, updateCaseLedgerBalanceAfterDelete } = require("../model/admin/clientLedgerModel");
const { getJournalBalanceAfterDeletedRow, updateJournalBalanceAfterDelete, getBankChargesBalanceAfterDeletedRow, updateBankChargesBalanceAfterDelete } = require("../model/admin/journalEntryModel");

const updateNextJournalAndLedgerBalance = async (id, ledger_client_id, case_id, matter_id, last_journal_balance, last_case_ledger_balance, last_ledger_balance, last_bank_charges_balance, adminId, userId, role, client_id, is_bank_charges = false) => {
  try {

    /**
            * Updating the next journal balance
            */
    // fetching balance after this row
    let afterBalance = await getJournalBalanceAfterDeletedRow(id, client_id, adminId, userId, role);

    if (afterBalance.length > 0) {
      afterBalance.forEach((row, index) => {
        if (index === 0) {
          row.running_balance = Number(last_journal_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
        } else {
          row.running_balance = Number(afterBalance[index - 1].running_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
        }
      })
    }

    // bulk updatng the values
    // const updateSuccess = await updateJournalBalanceAfterDelete(afterBalance);
    let updatedCount = await updateJournalBalanceAfterDelete(afterBalance);
    if (updatedCount <= 0) {
      throw new Error("Failed to calculate journal balance");
    }

    if (is_bank_charges) {
      /**
     * Updating the next ledger balance
     */
      // fetching balance after this row
      afterBalance = await getBankChargesBalanceAfterDeletedRow(id, client_id, adminId, ledger_client_id, matter_id);

      if (afterBalance.length > 0) {
        afterBalance.forEach((row, index) => {
          if (index === 0) {
            row.bank_ledger_balance = Number(last_bank_charges_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          } else {
            row.bank_ledger_balance = Number(afterBalance[index - 1].bank_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          }
        })
      }

      // bulk updatng the values
      // const updateSuccess = await updateJournalBalanceAfterDelete(afterBalance);
      let updatedCount = await updateBankChargesBalanceAfterDelete(afterBalance);
      if (updatedCount <= 0) {
        throw new Error("Failed to calculate journal balance");
      }
    } else {
      /**
           * Updating the next ledger balance
           */
      afterBalance = await getLedgerBalanceAfterDeletedRow(id, adminId, ledger_client_id, matter_id);
      if (afterBalance.length > 0) {
        afterBalance.forEach((row, index) => {
          if (index === 0) {
            row.ledger_balance = Number(last_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          } else {
            row.ledger_balance = Number(afterBalance[index - 1].ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          }
        });
      }
      updatedCount = await updateLedgerBalanceAfterDelete(afterBalance);
      if (updatedCount <= 0) {
        throw new Error("Failed to calculate journal balance");
      }

      /**
           * Updating the next ledger balance
           */
      afterBalance = await getCaseLedgerBalanceAfterDeletedRow(id, adminId, case_id, matter_id);
      if (afterBalance.length > 0) {
        afterBalance.forEach((row, index) => {
          if (index === 0) {
            row.case_ledger_balance = Number(last_case_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          } else {
            row.case_ledger_balance = Number(afterBalance[index - 1].case_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
          }
        });
      }
      updatedCount = await updateCaseLedgerBalanceAfterDelete(afterBalance);
      if (updatedCount <= 0) {
        throw new Error("Failed to calculate journal balance");
      }
    }



    return true;
  } catch (err) {
    throw new Error("Failed to calculate journal balance: " + err.message);
  }
}

const getLastDatesOfByYears = (no_of_years = 2) => {
  const result = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // Start from (currentYear - no_of_years) to currentYear - 1
  for (let year = currentYear - no_of_years; year < currentYear; year++) {
    for (let month = 0; month < 12; month++) {
      const lastDay = new Date(year, month + 1, 0); // Last day of the month
      lastDay.setDate(lastDay.getDate() + 1); // Add 1 day
      result.push(lastDay.toISOString().split('T')[0]); // Format: YYYY-MM-DD
    }
  }

  // Add months for current year up to current month
  for (let month = 0; month <= currentMonth; month++) {
    const lastDay = new Date(currentYear, month + 1, 0);
    lastDay.setDate(lastDay.getDate() + 1); // Add 1 day
    result.push(lastDay.toISOString().split('T')[0]);
  }

  return result;
};


module.exports = {
  updateNextJournalAndLedgerBalance,
  getLastDatesOfByYears
}
const { getAdminId } = require("../../model/admin/userManagementModel");
const { getReportsDB, getBankStatementReportsDB, getJournalReportsDB, getClientReportsDB, getBankChargesLedgerReportsDB, getOutstandingReports, getLedgerReportsDB, getClientLedgerSummaryReportDB } = require("../../model/user/reportModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");


/**
 * * Object containing report keys and their corresponding functions.
 * 
 * @type {Object}
 * @property {string} doc_key - The key of the report.
 * @property {Function} report_fn - The function that generates the report.
 */
const reportKeys = {
  BANK_STATEMENT: {
    doc_key: 'BANK_STATEMENT',
    report_fn: getBankStatementReportsDB,
    headers: ['serial_no', 'date', 'user_name', 'bank_name', 'account_number', 'statement_period', 'ending_balance', 'daily_balance']
  },
  JOURNAL: {
    doc_key: 'JOURNAL',
    report_fn: getJournalReportsDB,
    headers: ['serial_no', 'date', 'payee_or_payor', 'method', 'check_number', 'purpose', 'deposit', 'disbursement', 'balance', 'client', 'notes', 'reconciled_to_ledger', 'reconciled_to_bank_statement']
  },
  CLIENT: {
    doc_key: 'CLIENT',
    report_fn: getClientReportsDB,
    headers: ['serial_no', 'date', 'client_name', 'ledger_balance', 'has_lien']
  },
  BANK_CHARGES_LEDGER: {
    doc_key: 'BANK_CHARGES_LEDGER',
    report_fn: getBankChargesLedgerReportsDB,
    headers: ['serial_no', 'date', 'payee_or_payor', 'transaction_method', 'check_number', 'purpose', 'deposit_amount', 'disbursement_amount', 'running_balance', 'reconciled']
  },
  OUTSTANDING_DEPOSIT: {
    doc_key: 'OUTSTANDING_DEPOSIT',
    report_fn: getOutstandingReports,
    type: 'deposit',
    headers: ['serial_no', 'date', 'check_number', 'payer', 'related_to_client', 'amount']
  },
  OUTSTANDING_DISBURSEMENT: {
    doc_key: 'OUTSTANDING_DISBURSEMENT',
    report_fn: getOutstandingReports,
    type: 'disbursement',
    headers: ['serial_no', 'date', 'check_number', 'payer', 'related_to_client', 'amount']
  },
  CLIENT_LEDGER: {
    doc_key: 'CLIENT_LEDGER',
    report_fn: getLedgerReportsDB,
    headers: ['serial_no', 'date', 'payee_or_payor', 'method', 'check_number', 'purpose', 'deposit', 'disbursement', 'balance', 'client', 'notes', 'reconciled']
  },
  CLIENT_LEDGER_SUMMARY: {
    doc_key: 'CLIENT_LEDGER_SUMMARY',
    report_fn: getClientLedgerSummaryReportDB,
    headers: ['serial_no', 'individual_clients', 'balance']
  }
}


/**
 * * GET /user/report/modules
 * * Retrieves all modules for the reports.
 * * Each module is represented as an object with the key as the module name and the value as the doc_key.
 * @param {Request} req - Request object
 * @param {Response} res - Response object
 * @returns {Response} - Response containing the modules
 */
const getModules = (req, res) => {
  try {
    const docKeysObj = Object.entries(reportKeys).reduce((acc, [key, value]) => {
      acc[key] = value.doc_key;
      return acc;
    }, {});

    return respond(res, true, HTTP_STATUS_CODE.OK, "Modules fetched successfully", docKeysObj);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
};


/**
 * Fetches reports based on the provided parameters and returns them in the response.
 * 
 * This function retrieves reports for a given admin, month, and year based on the specified key.
 * If the key is 'CLIENT_LEDGER', a ledger client ID is also required. The reports are fetched from
 * the database, assigned serial numbers, and returned in the response.
 *
 * @param {Object} req - The request object containing user and body data.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @throws {Error} - Throws an error if there is an issue fetching the reports from the database.
 */

const fetchReports = async (req, res) => {
  try {
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const { key, ledger_client_id } = req.body;
    // validating inputs
    if (!key) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    // validation only for client ledger
    if (key === 'CLIENT_LEDGER' && !ledger_client_id) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Ledger client id is required");
    // fetching reports
    const reports = await getReportsDB(key, ledger_client_id, adminId);
    const dataWithSerialNo = await addSerialNoComman(reports);

    return respond(res, true, HTTP_STATUS_CODE.OK, "Reports fetched successfully", dataWithSerialNo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
};


module.exports = {
  fetchReports,
  reportKeys,
  getModules
}
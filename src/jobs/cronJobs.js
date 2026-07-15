const cron = require('node-cron');
const { checkPreviousMonthDataExists, getDistinctAdminIds, insertReports, getDistinctClientsByAdminId } = require('../model/user/reportModel');
const { saveToCSV, generateCSV, generatePDF } = require('../utils/csvHelper');
const { respond, HTTP_STATUS_CODE } = require('../utils/reponseHelper');
const addSerialNoComman = require('../utils/addSerialNoComman');
const { reportKeys } = require('../controller/user/reportController');



/**
 * * Checks if the given date is the last day of its month.
 * 
 * @param {Date} date - The date to check.
 * @returns {boolean} - Returns true if the given date is the last day of the month, otherwise false.
 */
function isLastDayOfMonth(date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  return tomorrow.getDate() === 1;
}



/**
 * * Returns the start and end dates of the previous month in the format 'yyyy-mm-dd'
 * * The start date is the first day of the previous month plus one day (to exclude the first day of the current month)
 * * The end date is the last day of the previous month plus one day (to include the last day of the previous month)
 * s
 * @returns {{startDate: string, endDate: string}}
 */
// function getPreviousMonthDateRange() {
//   const now = new Date();
//   const currentMonth = now.getMonth(); // 0-based
//   const currentYear = now.getFullYear();

//   const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
//   const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

//   const rawStartDate = new Date(previousYear, previousMonth, 1);
//   const rawEndDate = new Date(previousYear, previousMonth + 1, 0);

//   // Add +1 day to both dates
//   // rawStartDate.setDate(rawStartDate.getDate() + 1);
//   // rawEndDate.setDate(rawEndDate.getDate() + 1);

//   const formatDate = (date) => date.toISOString().split('T')[0];

//   return {
//     startDate: formatDate(rawStartDate),
//     endDate: formatDate(rawEndDate),
//   };
// }
//! Temporary
function getPreviousMonthDateRange() {
  // Fixed start date: January 1, 2023
  const rawStartDate = new Date(2023, 0, 1);

  // Dynamic end date: last day of previous month
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based
  const currentYear = now.getFullYear();

  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Last day of previous month
  const rawEndDate = new Date(previousYear, previousMonth + 1, 0);

  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    startDate: formatDate(rawStartDate), // always 2023-01-01
    endDate: formatDate(rawEndDate),     // last day of last month
  };
}



/**
 * ! IMPORTANT FUNCTION
 * * This function is the main function that generates all the reports 
 * * It generates reports dynamically using @function {reportKeys} configuration
 * @param {*} adminId 
 * @param {*} month 
 * @param {*} year 
 * @param {*} report_type 
 * @param {*} ledger_client_id 
 * @returns boolean
 */
const generateReport = async (adminId, month, year, report_type, ledger_client_id = null) => {
  try {
    const config = reportKeys[report_type];
    const { doc_key, report_fn, type, headers } = config;

    const reports = type
      ? await report_fn(adminId, month, year, type)
      : (ledger_client_id !== null ? await report_fn(adminId, month, year, ledger_client_id) : await report_fn(adminId, month, year));
    if (!reports.length) return true;
    const reportsWithSerial = await addSerialNoComman(reports);
    const doc_path = await generateCSV(adminId, reportsWithSerial, month, year, doc_key, headers); //adminId, reports, month, year, type, headers
    const pdf_path = await generatePDF(adminId, reportsWithSerial, month, year, doc_key, headers);
    const inserted = await insertReports({
      month,
      year,
      doc_key,
      doc_path,
      pdf_path,
      adminId,
      ledger_client_id
    });

    return !!inserted;
  } catch (error) {
    return false;
  }
};




/**
 * * This function is a monthly task that runs on the last day of the month.
 * * It checks if previous month data exists in the database.
 * * If it does not exist, it generates reports for all the admin users.
 * * If it does exist, it does nothing.
 * @param {*} req
 * @param {*} res
 * @returns {Promise<void>}
 */
async function runMonthlyTask(req, res) {
  try {
    const today = new Date();

    const { startDate, endDate } = getPreviousMonthDateRange();

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Loop through every month between start and end
    let current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const month = current.getMonth() + 1; // 1-based month
      const year = current.getFullYear();

      const isReportExist = await checkPreviousMonthDataExists(month, year);
      if (!isReportExist) {
        const adminIds = await getDistinctAdminIds();
        for (const row of adminIds) {
          const bank_report = await generateReport(row.adminId, month, year, 'BANK_STATEMENT');

          const journal_report = await generateReport(row.adminId, month, year, 'JOURNAL');

          const client_report = await generateReport(row.adminId, month, year, 'CLIENT');

          const deposit_outstanding = await generateReport(row.adminId, month, year, 'OUTSTANDING_DEPOSIT');

          const disbursement_outstanding = await generateReport(row.adminId, month, year, 'OUTSTANDING_DISBURSEMENT');

          const ledgerClients = await getDistinctClientsByAdminId(row.adminId);
          for (const ledgerClient of ledgerClients) {
            const ledger_report = await generateReport(row.adminId, month, year, 'CLIENT_LEDGER', ledgerClient.id);
          }

          const bank_charges = await generateReport(row.adminId, month, year, 'BANK_CHARGES_LEDGER');

          const client_ledger_summary = await generateReport(row.adminId, month, year, 'CLIENT_LEDGER_SUMMARY');

        }
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
}


module.exports = { runMonthlyTask };

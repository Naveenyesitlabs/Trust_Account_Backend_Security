const cron = require('node-cron');
const { checkPreviousMonthDataExists, getDistinctAdminIds, insertReports, getDistinctClientsByAdminId } = require('../model/user/reportModel');
const { saveToCSV, generateCSV } = require('../utils/csvHelper');
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

  const rawEndDate = new Date(previousYear, previousMonth + 1, 0);

  const formatDate = (date) => date.toISOString().split('T')[0];
  // console.log("Report Date: ", {
  //   startDate: formatDate(rawStartDate),
  //   endDate: formatDate(rawEndDate),
  // });
  return {
    startDate: formatDate(rawStartDate),
    endDate: formatDate(rawEndDate),
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
    // console.log("config at generateReport: ", config);
    const { doc_key, report_fn, type, headers } = config;

    const reports = type
      ? await report_fn(adminId, month, year, type)
      : (ledger_client_id !== null ? await report_fn(adminId, month, year, ledger_client_id) : await report_fn(adminId, month, year));
    // console.log(`${doc_key}: ${JSON.stringify(reports)}`);
    if (!reports.length) return true;
    const reportsWithSerial = await addSerialNoComman(reports);
    const doc_path = await generateCSV(adminId, reportsWithSerial, month, year, doc_key, headers); //adminId, reports, month, year, type, headers
    // console.log("doc_path", doc_path);
    const inserted = await insertReports({
      month,
      year,
      doc_key,
      doc_path,
      adminId,
      ledger_client_id
    });
    // console.log(`${report_type} inserting result: `, inserted);

    return !!inserted;
  } catch (error) {
    console.error(`Error creating ${report_type} report:`, error);
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

    // if (!isLastDayOfMonth(today)) {
    //   console.log('Not the last day of the month. Skipping...');
    //   return;
    // }

    const { startDate, endDate } = getPreviousMonthDateRange();
    // console.log('startDate', startDate);
    // console.log('endDate', endDate);
    const month = parseInt(startDate.split('-')[1]); // "05"
    const year = parseInt(startDate.split('-')[0]);
    const isReportExist = await checkPreviousMonthDataExists(month, year);
    // console.log('isReportExist', isReportExist);
    if (!isReportExist) {
      const adminIds = await getDistinctAdminIds();
      for (const row of adminIds) {
        const bank_report = await generateReport(row.adminId, month, year, 'BANK_STATEMENT');
        // if (!bank_report) return false;
        // if (!bank_report) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Bank Statement Report not generated");

        const journal_report = await generateReport(row.adminId, month, year, 'JOURNAL');
        // if (!journal_report) return false;
        // if (!journal_report) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Journal Report not generated");

        const client_report = await generateReport(row.adminId, month, year, 'CLIENT');
        // if (!client_report) return false;
        // if (!client_report) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Client Report not generated");

        const deposit_outstanding = await generateReport(row.adminId, month, year, 'OUTSTANDING_DEPOSIT');
        // if (!deposit_outstanding) return false;
        // if (!deposit_outstanding) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Deposit Outstanding Report not generated");

        const disbursement_outstanding = await generateReport(row.adminId, month, year, 'OUTSTANDING_DISBURSEMENT');
        // if (!disbursement_outstanding) return false;
        // if (!disbursement_outstanding) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Disbursement Outstanding Report not generated");

        const ledgerClients = await getDistinctClientsByAdminId(row.adminId);
        for (const ledgerClient of ledgerClients) {
          const ledger_report = await generateReport(row.adminId, month, year, 'CLIENT_LEDGER', ledgerClient.id);
          // if (!ledger_report) return false;
          // if (!ledger_report) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Ledger Report not generated");
        }

        const bank_charges = await generateReport(row.adminId, month, year, 'BANK_CHARGES_LEDGER');
        // if (!bank_charges) return false;
        // if (!bank_charges) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Bank Charges Ledger Report not generated");

        const client_ledger_summary = await generateReport(row.adminId, month, year, 'CLIENT_LEDGER_SUMMARY');
        // if (!client_ledger_summary) return false;
        // if (!client_ledger_summary) return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Client Ledger Summary Report not generated");

      }
      return true;
      // return respond(res, true, HTTP_STATUS_CODE.OK, "Monthly Task completed successfully");
      // console.log('No data for previous month. Running your operation...');
      // 🔽 Replace with your actual operation
      // await performYourOperation();
    } else {
      console.log('Previous month data exists. Nothing to do.');
      return true;
      // return respond(res, true, HTTP_STATUS_CODE.OK, "Previous month data exists. Nothing to do.");
    }
  } catch (err) {
    console.error(err);
    return false;
    // return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Error in running Monthly Task");
  }
}

// Schedule the cron (runs daily at 00:30 AM)
// cron.schedule('30 0 * * *', () => {
// cron.schedule('*/5 * * * *', () => {
//   runMonthlyTask().catch(console.error);
// });

module.exports = { runMonthlyTask };

const dbConn = require("../../../dbConfig");



/**
 * * Inserts a new report into the 'reports' table in the database
 * @param {Object} reportData - The report data to be inserted
 * @returns {Promise<boolean>} - True if the report was inserted successfully, false otherwise
 */
const insertReports = async (reportData) => {
  try {
    const query = 'INSERT INTO reports SET ?';
    const values = [reportData];

    const [result] = await dbConn.query(query, values); // Destructure result
    if (result.affectedRows > 0) {
      return true; // Successfully inserted
    } else {
      return false; // No row inserted
    }
  } catch (error) {
    throw new Error('Database error at insertReports: ' + error.message);
  }
}



/**
 * * Checks if there is any report present in the database for the given month and year
 * @param {number} month - The month to check
 * @param {number} year - The year to check
 * @returns {Promise<boolean>} - True if there is any report present, false otherwise
 */
const checkPreviousMonthDataExists = async (month, year) => {
  try {
    let query = `select count(id) as count from reports where month=? and year=?`;
    const values = [month, year];
    const [result] = await dbConn.query(query, values);
    return result[0].count > 0;
  } catch (error) {
    throw new Error('Database error at checkPreviousMonthDataExists: ' + error.message);
  }
}



/**
 * * Fetches all the distinct adminIds from manage_firm table
 * @returns {Promise<Array<Object>>} - An array of objects containing distinct adminIds
 */
const getDistinctAdminIds = async () => {
  try {
    let query = 'select distinct user_id as adminId from manage_firm';
    const [result] = await dbConn.query(query);
    return result;
  } catch (error) {
    throw new Error('Database error at checkPreviousMonthDataExists: ' + error.message);
  }
}



/**
 * * Fetches all distinct clients for a given admin ID from the ledger_client table.
 * @param {number} adminId - The ID of the admin whose clients are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the id and client_name of a distinct client.
 * @throws {Error} - Throws an error if there is a database error while fetching the clients.
 */

const getDistinctClientsByAdminId = async (adminId) => {
  try {
    let query = 'select id, client_name from ledger_client where adminId=?';
    const [result] = await dbConn.query(query, [adminId]);
    return result;
  } catch (error) {
    throw new Error('Database error at getDistinctClientsByAdminId: ' + error.message);
  }
}



/**
 * * Fetches all bank statements for a given admin ID for a given month and year.
 * @param {number} adminId - The ID of the admin whose bank statements are to be fetched.
 * @param {number} month - The month for which the bank statements are to be fetched.
 * @param {number} year - The year for which the bank statements are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the bank statement details.
 * @throws {Error} - Throws an error if there is a database error while fetching the bank statements.
 */
const getBankStatementReportsDB = async (adminId, month, year) => {
  try {
    let query = `select 
                bt.date, 
                bs.user_name,
                bs.bank_name,
                bs.account_number,
                bs.statement_period,
                bs.ending_balance,
                bt.daily_balance, 
                bt.reconciled_to_journal
            from 
                bank_transactions as bt 
            inner join 
                bank_statements as bs on bs.id = bt.bank_statement_id 
            where 
                bs.adminId = ? 
                and bt.adminId = ? 
                and MONTH(bt.date) = ? 
                and YEAR(bt.date) = ?
            order by 
                bt.id desc`;
    const values = [adminId, adminId, month, year];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getBankStatementReportsDB: ' + error.message);
  }
}



/**
 * * Fetches all journal entries for a given admin ID for a given month and year
 * @param {number} adminId - The ID of the admin whose journal entries are to be fetched
 * @param {number} month - The month for which the journal entries are to be fetched
 * @param {number} year - The year for which the journal entries are to be fetched
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the journal entry details
 * @throws {Error} - Throws an error if there is a database error while fetching the journal entries
 */
const getJournalReportsDB = async (adminId, month, year) => {
  try {
    let query = `select 
                      mfa.date, 
                      mfa.payee_name as payee_or_payor, 
                      mfa.transaction_method as method,
                      mfa.cheque_number as check_number,
                      mfa.purpose,
                      mfa.deposit_amount as deposit,
                      mfa.disbursement_amount as disbursement,
                      mfa.running_balance as balance,
                      lc.client_name as client,
                      mfa.notes,
                      mfa.reconciled_to_ledger,
                      mfa.reconciled_to_bank_statement
                  from 
                      manage_firm_accounting as mfa 
                  inner join 
                      ledger_client as lc on lc.id=mfa.ledger_client_id 
                  where 
                      mfa.adminId= ? 
                      and MONTH(mfa.date) = ? 
                      and YEAR(mfa.date) = ? 
                  order by 
                      mfa.id desc`;

    const values = [adminId, month, year];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getJournalReportsDB: ' + error.message);
  }
}



/**
 * * Fetches client reports for a given admin ID, month, and year.
 * * This function retrieves all ledger clients for the specified admin 
 * * and calculates their latest ledger balance, excluding bank charges.
 * * Only clients with a non-null ledger balance are returned.
 *
 * @param {number} adminId - The ID of the admin whose clients are to be fetched.
 * @param {number} month - The month for which the client reports are to be fetched.
 * @param {number} year - The year for which the client reports are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the client details and their latest ledger balance.
 * @throws {Error} - Throws an error if there is a database error while fetching the client reports.
 */

const getClientReportsDB = async (adminId, month, year) => {
  try {
    let query = `WITH filtered_mfa AS (
                    SELECT *
                    FROM manage_firm_accounting
                    WHERE MONTH(date) = ?
                      AND YEAR(date) = ?
                      AND adminId = ?
                )

                SELECT *
                FROM (
                    SELECT 
                        lc.created_at as date,
                        lc.client_name,
                        (
                            SELECT mfa.ledger_balance 
                            FROM filtered_mfa AS mfa 
                            WHERE mfa.ledger_client_id = lc.id 
                              AND mfa.is_bank_charge = false 
                              AND mfa.ledger_balance IS NOT NULL
                            ORDER BY mfa.id DESC 
                            LIMIT ?
                        ) AS ledger_balance,
                        (select COUNT(cm.id) from client_matter as cm where cm.ledger_client_id = lc.id) as has_lien
                    FROM ledger_client AS lc
                    WHERE lc.adminId = ?
                      AND lc.id IN (
                          SELECT DISTINCT ledger_client_id
                          FROM filtered_mfa
                      )
                ) AS sub
                WHERE sub.ledger_balance IS NOT NULL
                ORDER BY sub.client_name ASC`;

    const values = [month, year, adminId, 1, adminId];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getClientReportsDB: ' + error.message);
  }
}



/**
 * * Fetches all outstanding deposits/disbursements for the given admin and month
 * * Returns an array of objects, each containing the outstanding deposit/disbursement details.
 * * Only transactions with a non-zero outstanding amount are returned.
 *
 * @param {number} adminId - The ID of the admin whose outstanding deposits/disbursements are to be fetched.
 * @param {number} month - The month for which the outstanding deposits/disbursements are to be fetched.
 * @param {number} year - The year for which the outstanding deposits/disbursements are to be fetched.
 * @param {string} type - The type of outstanding report to be fetched. Can be either 'deposit' or 'disbursement'.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the outstanding deposit/disbursement details.
 * @throws {Error} - Throws an error if there is a database error while fetching the outstanding deposits/disbursements.
 */
const getOutstandingReports = async (adminId, month, year, type) => {
  try {
    if (!['deposit', 'disbursement'].includes(type)) {
      throw new Error('Invalid outstanding report type');
    }
    let query = type === 'deposit' ? `select 
                      mfa.date,
                      mfa.cheque_number as check_number,
                      mfa.payee_name as payer,
                      lc.client_name as related_to_client,
                      mfa.deposit_amount as amount
                  from 
                      manage_firm_accounting as mfa 
                  inner join 
                      ledger_client as lc on lc.id=mfa.ledger_client_id 
                  where 
                      mfa.adminId= ? 
                      and mfa.is_bank_charge = ? 
                      and mfa.deposit_amount > 0 
                      and mfa.is_outstanding = ? 
                      and MONTH(mfa.date) = ? 
                      and YEAR(mfa.date) = ? 
                  order by 
                      mfa.id desc` : `select 
                      mfa.date,
                      mfa.cheque_number as check_number,
                      mfa.payee_name as payer,
                      lc.client_name as related_to_client,
                      mfa.disbursement_amount as amount
                  from 
                      manage_firm_accounting as mfa 
                  inner join 
                      ledger_client as lc on lc.id=mfa.ledger_client_id 
                  where 
                      mfa.adminId= ? 
                      and mfa.is_bank_charge = ? 
                      and mfa.disbursement_amount > 0 
                      and mfa.is_outstanding = ? 
                      and MONTH(mfa.date) = ? 
                      and YEAR(mfa.date) = ? 
                  order by 
                      mfa.id desc`;

    const values = [adminId, false, true, month, year];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getOutstandings: ' + error.message);
  }
}



/**
 * * Fetches all ledger entries for a given admin ID, month, year, and ledger_client_id
 * * Returns an array of objects, each containing the ledger entry details.
 * * Only transactions with a non-zero ledger balance are returned.
 *
 * @param {number} adminId - The ID of the admin whose ledger entries are to be fetched.
 * @param {number} month - The month for which the ledger entries are to be fetched.
 * @param {number} year - The year for which the ledger entries are to be fetched.
 * @param {number} ledger_client_id - The ID of the ledger client for which the ledger entries are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the ledger entry details.
 * @throws {Error} - Throws an error if there is a database error while fetching the ledger entries.
 */
const getLedgerReportsDB = async (adminId, month, year, ledger_client_id) => {
  try {
    let query = `SELECT 
                      mfa.date,
                      mfa.payee_name as payee_or_payor,
                      mfa.transaction_method as method,
                      mfa.cheque_number as check_number,
                      mfa.purpose,
                      mfa.deposit_amount as deposit,
                      mfa.disbursement_amount as disbursement,
                      mfa.running_balance as balance,
                      lc.client_name as client,
                      mfa.notes,
                      mfa.reconcile_to_journal as reconciled
                  FROM 
                      manage_firm_accounting AS mfa
                  INNER JOIN 
                      ledger_client AS lc ON lc.id = mfa.ledger_client_id 
                  WHERE 
                      mfa.ledger_client_id = ? 
                      AND mfa.is_bank_charge = ? 
                      AND lc.adminId = ? 
                      AND mfa.adminId = ? 
                      AND MONTH(mfa.date) = ? 
                      AND YEAR(mfa.date) = ?
                  ORDER BY 
                      mfa.id DESC`;
    const values = [ledger_client_id, false, adminId, adminId, month, year];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getLedgerReportsDB: ' + error.message);
  }
}



/**
 * * Fetches all bank charges ledger entries for a given admin ID, month, year
 * * Returns an array of objects, each containing the ledger entry details.
 * * Only transactions with a non-zero ledger balance and are not outstanding are returned.
 *
 * @param {number} adminId - The ID of the admin whose ledger entries are to be fetched.
 * @param {number} month - The month for which the ledger entries are to be fetched.
 * @param {number} year - The year for which the ledger entries are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the ledger entry details.
 * @throws {Error} - Throws an error if there is a database error while fetching the ledger entries.
 */
const getBankChargesLedgerReportsDB = async (adminId, month, year) => {
  try {
    let query = `SELECT 
                      mfa.date,
                      mfa.payee_name as payee_or_payor,
                      mfa.transaction_method,
                      mfa.cheque_number as check_number,
                      mfa.purpose,
                      mfa.deposit_amount,
                      mfa.disbursement_amount,
                      mfa.bank_ledger_balance as running_balance,
                      mfa.reconciled_to_bank_statement as reconciled
                  FROM 
                      manage_firm_accounting AS mfa
                  INNER JOIN 
                      ledger_client AS lc ON lc.id = mfa.ledger_client_id 
                  WHERE 
                      mfa.is_bank_charge = ? 
                      AND lc.adminId = ? 
                      AND mfa.adminId = ? 
                      AND MONTH(mfa.date) = ? 
                      AND YEAR(mfa.date) = ? 
                  ORDER BY 
                      mfa.id DESC`;
    const values = [true, adminId, adminId, month, year];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getBankChargesLedgerReportsDB: ' + error.message);
  }
}



/**
 * * Fetches client ledger summary reports for a given admin ID, month, and year.
 * * This function retrieves all ledger clients for the specified admin and calculates their latest ledger balance, excluding bank charges.
 * * Only clients with a non-null ledger balance are returned.
 *
 * @param {number} adminId - The ID of the admin whose clients are to be fetched.
 * @param {number} month - The month for which the client ledger summary reports are to be fetched.
 * @param {number} year - The year for which the client ledger summary reports are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the client details and their latest ledger balance.
 * @throws {Error} - Throws an error if there is a database error while fetching the client ledger summary reports.
 */
const getClientLedgerSummaryReportDB = async (adminId, month, year) => {
  try {
    let query = `WITH filtered_mfa AS (
                      SELECT *
                      FROM manage_firm_accounting
                      WHERE MONTH(date) = ?
                        AND YEAR(date) = ?
                        AND adminId = ?
                  )

                  SELECT *
                  FROM (
                      SELECT 
                          lc.client_name as individual_clients, 
                          (
                              SELECT mfa.ledger_balance 
                              FROM filtered_mfa AS mfa 
                              WHERE mfa.ledger_client_id = lc.id 
                                AND mfa.is_bank_charge = false 
                                AND mfa.ledger_balance IS NOT NULL
                              ORDER BY mfa.id DESC 
                              LIMIT ?
                          ) AS balance
                      FROM ledger_client AS lc
                      WHERE lc.adminId = ?
                        AND lc.id IN (
                            SELECT DISTINCT ledger_client_id
                            FROM filtered_mfa
                        )
                  ) AS sub
                  WHERE sub.balance IS NOT NULL
                  ORDER BY sub.individual_clients ASC`;

    const values = [month, year, adminId, 1, adminId];
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getClientLedgerSummaryReportDB: ' + error.message);
  }
}


const getReportsDB = async (doc_key, ledger_client_id = null, adminId) => {
  try {
    let query = `
      SELECT * FROM reports AS r
      WHERE r.doc_key = ? AND r.adminId = ?
    `;
    const values = [doc_key, adminId];

    if (ledger_client_id !== null && ledger_client_id !== undefined && ledger_client_id !== '') {
      query += ` AND r.ledger_client_id = ?`;
      values.push(ledger_client_id);
    }

    query += ` ORDER BY r.month DESC, r.year DESC`;
    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error('Database error at getReportsDB: ' + error.message);
  }
};



module.exports = {
  getBankStatementReportsDB,
  getJournalReportsDB,
  getClientReportsDB,
  getOutstandingReports,
  insertReports,
  checkPreviousMonthDataExists,
  getDistinctAdminIds,
  getDistinctClientsByAdminId,
  getLedgerReportsDB,
  getBankChargesLedgerReportsDB,
  getClientLedgerSummaryReportDB,
  getReportsDB,
}

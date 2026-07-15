const dbConn = require('../../../dbConfig');

/**
 * To get total count of the table
 */
const getLedgersCount = async () => {
    try {
        let query = 'SELECT COUNT(id) AS count FROM client_ledger';

        // destructure rows from query result
        const [rows] = await dbConn.query(query);

        return rows[0].count;
    } catch (err) {
        console.error(err);
        return false;
    }
};



/**
 * Fetching all ledgers based on client id
 * @param {*} query 
 * @returns 
 */
const fetchLedgers = async ({ page, limit, startDate, endDate, client_id }) => {
    try {
        // Ensure limit is a number
        limit = Number(limit);

        // Calculate offset for pagination
        const offset = page && limit ? (page - 1) * limit : 0;

        // Initialize conditions and values for the SQL WHERE clause
        let conditions = [];
        let values = [];

        // Always filter by client_id
        values.push(client_id);

        // If startDate and endDate are provided, add date range condition
        if (startDate && endDate) {
            conditions.push("transaction_date BETWEEN ? AND ?");
            values.push(startDate, endDate);
        }

        // Build the WHERE clause dynamically
        const whereClause = conditions.length > 0
            ? `WHERE client_id = ? AND ${conditions.join(' AND ')}`
            : `WHERE client_id = ?`;

        // Base SQL query to fetch ledger entries
        let baseQuery = `
            SELECT id, transaction_date, payor_payee, transaction_method, check_number, purpose, deposit, disbursement, running_balance, notes, is_reconcile_to_journal
            FROM client_ledger 
            ${whereClause}
            ORDER BY transaction_date ASC
        `;

        // If pagination is applied, add LIMIT and OFFSET
        if (page && limit) {
            baseQuery += ' LIMIT ?, ?';
            values.push(offset, limit);
        }

        // Wrap base query to add serial number using MySQL variable
        const finalQuery = `
            SELECT 
                (@row_number := @row_number + 1) AS serial_number,
                id, transaction_date, payor_payee, transaction_method, check_number, purpose, deposit, disbursement, running_balance, notes, is_reconcile_to_journal
            FROM (
                ${baseQuery}
            ) AS filtered_docs
        `;

        // Initialize row number variable in MySQL
        await dbConn.query("SET @row_number := ?", [offset]);

        // Execute the final query
        const [rows] = await dbConn.query(finalQuery, values);
        return rows;
    } catch (error) {
        // Log and return false if an error occurs
        console.error("Fetch error:", error);
        return false;
    }
};


/**
 * Insert ledger
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const insertLedger = async (saveData) => {
    try {
        // building query
        const query = `
            INSERT INTO client_ledger
            (client_id, transaction_date, payor_payee, transaction_method, check_number, 
            purpose, deposit, disbursement, running_balance, notes, is_reconcile_to_journal)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `;

        // gathering values
        const values = [
            saveData.client_id,
            saveData.transaction_date,
            saveData.payor_payee,
            saveData.transaction_method,
            saveData.check_number,
            saveData.purpose,
            saveData.deposit,
            saveData.disbursement,
            saveData.running_balance,
            saveData.notes,
            saveData.is_reconcile_to_journal
        ];

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        // returning last inserted id
        return rows.insertId;
    } catch (err) {
        console.error(err.message);
        return false;
    }
}


/**
 * fetching balance of ledger with month or without month(overall, upto current month)
 * @param {*} client_id 
 * @param {*} month 
 * @returns 
 */
const getLedgerBalance = async (client_id, month = null) => {
    try {
        // building query
        let query = `
            SELECT running_balance FROM client_ledger WHERE client_id = ?
        `;

        // gathering values
        const values = [client_id];

        if (month) {
            query += ` AND MONTH(transaction_date) = ?`;
            values.push(month);
        }

        query += ' ORDER BY id DESC LIMIT 1';

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].running_balance;
    } catch (err) {
        console.error(err.message);
        return false;
    }
}


module.exports = {
    fetchLedgers,
    getLedgersCount,
    insertLedger,
    getLedgerBalance
};

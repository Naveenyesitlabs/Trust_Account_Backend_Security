const dbConn = require("../../../dbConfig");

/**
 * Add new journal entry
 */
const saveJournalEntry = async (journalData) => {
    try {
        // building query
        const query = `
            INSERT INTO client_journal 
            (client_id, transaction_date, payor_payee, transaction_method, check_number,
            purpose, deposit, disbursement, running_balance, notes, is_reconcile_ledger, is_reconcile_bank)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [
            journalData.client_id,
            journalData.transaction_date,
            journalData.payor_payee,
            journalData.transaction_method,
            journalData.check_number,
            journalData.purpose,
            journalData.deposit,
            journalData.disbursement,
            journalData.running_balance,
            journalData.notes,
            journalData.is_reconcile_ledger,
            journalData.is_reconcile_bank
        ];

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        // returning last inserted id
        return rows.insertId;
    } catch (err) {
        return false;
    }
}


/**
 * fetching balance of journal with month or without month(overall, upto current month)
 * @param {*} client_id 
 * @param {*} month 
 * @returns 
 */
const getJournalBalance = async () => {
    try {
        // doing db operation
        const [rows] = await dbConn.query('SELECT running_balance FROM client_journal ORDER BY id DESC LIMIT 1');

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].running_balance;
    } catch (err) {
        console.error(err.message);
        return false;
    }
}


/**
 * Fetching journal transactions of a bank name, account number and account name
 * @param {*} client_id 
 * @param {*} search 
 * @param {*} start_date 
 * @param {*} end_date 
 * @returns 
 */
const fetchAllJournal = async (bank_name, account_number, account_name) => {
    try {
        // building basic query
        let query = `SELECT 
                            CJ.id, CJ.transaction_date, CJ.payor_payee, CJ.transaction_method, CJ.check_number,
                            CJ.purpose, CJ.deposit, CJ.disbursement, CJ.running_balance, CJ.notes, CJ.is_reconcile_ledger, CJ.is_reconcile_bank
                    FROM client_journal AS CJ 
                    INNER JOIN 
                        client_trust_accounts AS CTA ON CTA.clientId = CJ.client_id
                    WHERE 
                        CTA.bank_name = ? 
                        AND CTA.account_name = ? 
                        AND CTA.account_number= ?
                    ORDER BY 
                        CJ.transaction_date ASC `;

        // building values
        const values = [bank_name, account_name, account_number];

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        return rows;
    } catch (err) {
        console.error(err.message);
        return false;
    }
}


module.exports = {
    saveJournalEntry,
    getJournalBalance,
    fetchAllJournal
}

const dbConn = require("../../../dbConfig");

const checkIfFullyReconciled = async (
    adminId,
    firm_name,
    bank_name,
    account_name,
    account_number,
    account_open_date,
    account_close_date
) => {
    try {

        const query = `
            SELECT COUNT(*) AS unreconciled_count
            FROM manage_firm_accounting AS mfa
            INNER JOIN client_trust_accounts AS cta 
                ON cta.clientId = mfa.client_id
            WHERE mfa.adminId = ?
                AND cta.firm_name = ?
                AND cta.bank_name = ?
                AND cta.account_name = ?
                AND cta.account_number = ?
                AND mfa.date BETWEEN ? AND ?
                AND mfa.reconciled_to_bank_statement = 0
        `;

        const values = [
            adminId,
            firm_name,
            bank_name,
            account_name,
            account_number,
            account_open_date,
            account_close_date
        ];

        const [rows] = await dbConn.query(query, values);

        // if any unreconciled row exists -> false
        if (rows[0].unreconciled_count > 0) {
            return false;
        }

        // all reconciled
        return true;

    } catch (error) {
        throw new Error(
            'Error checking reconciliation status: ' + error.message
        );
    }
};


const getReconcileJournalBalance = async (adminId, firm_name, bank_name, account_name, account_number, account_open_date, account_close_date) => {
    try {
        // building the query
        let query = `
                    SELECT mfa.running_balance FROM manage_firm_accounting AS mfa 
                    INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
                    WHERE mfa.adminId = ? AND cta.firm_name = ? 
                    AND cta.bank_name = ? AND cta.account_name = ?
                    AND cta.account_number = ? AND mfa.date between ? AND ?
                    ORDER BY mfa.id DESC 
                    LIMIT ? 
                    `;

        // gathering values in an array
        const values = [adminId, firm_name, bank_name, account_name, account_number, account_open_date, account_close_date, 1];

        // executing the query
        const [rows] = await dbConn.query(query, values);
        // returning the failed result
        if (rows.length === 0) return 0;
        // returning the running balance
        return rows[0].running_balance;
    } catch (error) {
        throw new Error('Error fetching bank statements at getReconcileJournalBalance: ' + error.message);
    }
}


const getReconcileLedgerBalance = async (adminId, firm_name, bank_name, account_name, account_number, account_open_date, account_close_date) => {
    try {
        // building query 
        let query = `
            WITH ranked_entries AS (
                SELECT 
                    ledger_balance,
                    ROW_NUMBER() OVER (PARTITION BY ledger_client_id ORDER BY id DESC) AS rn
                FROM manage_firm_accounting
                WHERE client_id = (
                    SELECT clientId 
                    FROM client_trust_accounts 
                    WHERE account_name = ? AND account_number = ?
                    AND firm_name = ? AND bank_name = ?
                    LIMIT ?
                )
                AND is_bank_charge = ?
                AND adminId = ?
                AND date between ? AND ?
            )
            SELECT SUM(ledger_balance) as rec_ledger_balance
            FROM ranked_entries
            WHERE rn = ?
        `;

        const values = [account_name, account_number, firm_name, bank_name, 1, false, adminId, account_open_date, account_close_date, 1];
        // executing the query
        const [rows] = await dbConn.query(query, values);
        // returning the failed result
        if (rows.length === 0) return 0;
        // returning the ledger balance
        return rows[0].rec_ledger_balance;
    } catch (error) {
        throw new Error('Error fetching bank statements at getReconcileLedgerBalance: ' + error.message);
    }
}


const getReconcileBankLedgerBalance = async (adminId, firm_name, bank_name, account_name, account_number, account_open_date, account_close_date) => {
    try {
        // building query 
        let query = `
            WITH ranked_entries AS (
                SELECT  
                    bank_ledger_balance,
                    ROW_NUMBER() OVER (PARTITION BY ledger_client_id ORDER BY id DESC) AS rn
                FROM manage_firm_accounting
                WHERE client_id = (
                    SELECT clientId 
                    FROM client_trust_accounts 
                    WHERE account_name = ? AND account_number = ?
                    AND firm_name = ? AND bank_name = ?
                    LIMIT ?
                )
                AND is_bank_charge = ?
                AND adminId = ?
                AND date between ? AND ?
            )
            SELECT SUM(bank_ledger_balance) as rec_bank_ledger_balance
            FROM ranked_entries
            WHERE rn = ?
        `;

        const values = [account_name, account_number, firm_name, bank_name, 1, true, adminId, account_open_date, account_close_date, 1];
        // executing the query
        const [rows] = await dbConn.query(query, values);
        // returning the failed result
        if (rows.length === 0) return 0;
        // returning the ledger balance
        return rows[0].rec_bank_ledger_balance;
    } catch (error) {
        throw new Error('Error fetching bank statements at getReconcileBankLedgerBalance: ' + error.message);
    }
}



const getReconcileClientId = async (account_name, account_number, firm_name, bank_name, adminId) => {
    try {
        // building query
        const query = `SELECT clientId 
                    FROM client_trust_accounts 
                    WHERE account_name = ? AND account_number = ?
                    AND firm_name = ? AND bank_name = ? AND adminId = ?`

        const values = [account_name, account_number, firm_name, bank_name, adminId];

        // executing the query
        const [rows] = await dbConn.query(query, values);
        // returning the failed result
        if (rows.length === 0) return null;
        // returning the ledger balance
        return rows[0].clientId;
    } catch (error) {
        throw new Error('Error fetching bank statements at getClientId: ' + error.message);
    }
}


const getReconcileEndingBalance = async (clientId, account_open_date, account_close_date) => {
    try {
        // building query
        let query = `SELECT ending_balance FROM bank_statements WHERE client_id = ? AND statement_period_start <= ? AND statement_period_end >= ?`;
        // const statement_period = `${account_open_date}_${account_close_date}`;
        const values = [clientId, account_open_date, account_close_date];
        // executing the query
        const [rows] = await dbConn.query(query, values);
        // returning the failed result
        if (rows.length === 0) return false;
        // returning the ledger balance
        return rows[0].ending_balance;
    } catch (error) {
        throw new Error('Error fetching bank statements at getReconcileEndingBalance: ' + error.message);
    }
}


const getOutstandingsSum = async (adminId, account_open_date, account_close_date, type) => {
    try {
        const query = type === 'deposit'
            ? `
            SELECT SUM(mfa.deposit_amount) AS total
            FROM manage_firm_accounting AS mfa
            INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
            WHERE mfa.adminId = ?
              AND mfa.is_outstanding = ? 
              AND mfa.date between ? AND ?
        `
            : `
            SELECT SUM(mfa.disbursement_amount) AS total
            FROM manage_firm_accounting AS mfa
            INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
            WHERE mfa.adminId = ?
              AND mfa.is_outstanding = ? 
              AND mfa.date between ? AND ?
        `;

        const values = [adminId, true, account_open_date, account_close_date];

        const [result] = await dbConn.query(query, values);

        if (!result || result.length === 0 || result[0].total === null) return 0;

        return result[0].total;
    } catch (err) {
        throw new Error("Database error at getOutstandingsSum: " + err.message);
    }
};


const getAccountData = async (account_name, account_number, firm_name, bank_name, account_open_date, account_close_date) => {
    try {
        let query = `SELECT COUNT(clientId) as account_count FROM client_trust_accounts WHERE account_name = ? AND account_number = ? AND firm_name = ? AND bank_name = ? AND account_open_date = ?`;
        const values = [account_name, account_number, firm_name, bank_name, account_open_date];
        if (account_close_date) {
            query += ` AND account_close_date = ?`;
            values.push(account_close_date);
        }

        const [rows] = await dbConn.query(query, values);
        // returning the ledger balance
        return rows.length > 0 ? Number(rows[0].account_count) > 0 : false;
    } catch (error) {
        throw new Error('Error fetching bank statements at getAccountData: ' + error.message);
    }
}


const insertReconciliationDiscard = async (data) => {
    try {
        let query = `INSERT INTO discard_reconciliation SET ?`;
        const [rows] = await dbConn.query(query, data);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Error fetching bank statements at insertReconciliationDiscard: ' + error.message);
    }
}


const getReconciliationDiscard = async (firm_name, account_name, account_number, start_date, end_date) => {
    try {
        let query = `
            SELECT * FROM discard_reconciliation 
            WHERE firm_name = ? 
              AND account_name = ? 
              AND account_number = ? 
              AND start_date = ?`;

        if (end_date !== null) {
            query += ` AND end_date = ?`;
        } else {
            query += ` AND end_date IS NULL`;
        }

        const [rows] = await dbConn.query(query, [
            firm_name,
            account_name,
            account_number,
            start_date,
            end_date
        ]);

        return rows[0] || [];
    } catch (error) {
        throw new Error('Error at getReconciliationDiscard: ' + error.message);
    }
};



const updateReconciliationDiscard = async (
    id,
    data
) => {
    try {

        const query = `UPDATE discard_reconciliation SET ? WHERE id = ?`;
        const [rows] = await dbConn.query(query, [data, id]);

        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at updateReconciliationDiscard: ' + error.message);
    }
};


const getJournalEntryUsersDB = async ({ adminId, firm_name, bank_name, account_name, account_number, start_date, end_date }) => {
    try {
        let query = `SELECT distinct mfa.userId FROM manage_firm_accounting AS mfa 
                    INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
                    WHERE mfa.adminId = ? AND cta.firm_name = ? 
                    AND cta.bank_name = ? AND cta.account_name = ?
                    AND cta.account_number = ? AND mfa.date between ? AND ?`;
        const values = [adminId, firm_name, bank_name, account_name, account_number, start_date, end_date];
        const [rows] = await dbConn.query(query, values);
        return rows || [];
    } catch (error) {
        throw new Error('Database error at getJournalEntryUserDB: ' + error.message);
    }
}


const getLastBankStatementPeriodDB = async (adminId, bank_name, account_number) => {
    try {
        let query = `select statement_period_start, statement_period_end from bank_statements where adminId = ? and bank_name = ? and account_number = ? order by statement_period_end desc limit 1`;
        const values = [adminId, bank_name, account_number];
        const [rows] = await dbConn.query(query, values);
        let firstDay = null, lastDay = null;
        if (rows.length > 0) {
            firstDay = rows[0].statement_period_start;
            lastDay = rows[0].statement_period_end
        }
        return { firstDay, lastDay };
    } catch (error) {
        throw new Error('Database error at getLastBankStatementPeriodDB: ' + error.message);
    }
}



module.exports = {
    getReconcileJournalBalance,
    getReconcileLedgerBalance,
    getReconcileBankLedgerBalance,
    getReconcileClientId,
    getReconcileEndingBalance,
    getOutstandingsSum,
    getAccountData,
    insertReconciliationDiscard,
    getReconciliationDiscard,
    updateReconciliationDiscard,
    getJournalEntryUsersDB,
    getLastBankStatementPeriodDB,
    checkIfFullyReconciled,
}

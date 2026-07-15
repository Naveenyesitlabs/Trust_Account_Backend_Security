const dbConn = require("../../../dbConfig");
const { resolveRoleScopedField, toContainsLikeValue } = require('../../utils/sqlSafety');


const getBankDaitles = async ({ firm_name, userId, adminId, role }) => {

    const idField = resolveRoleScopedField(role);
    const idValue = role == 'admin' ? adminId : userId


    try {
        const query = `
        SELECT * FROM client_trust_accounts WHERE firm_name = ? AND ${idField} = ?
            ORDER BY firm_name DESC
        `;
        const [rows] = await dbConn.query(query, [firm_name, idValue]);
        return rows[0];
    } catch (error) {
        // return error;
        throw new Error('Database error: ' + error.message);
    }
}


const getClientsBankLedger = async (adminId) => {
    try {
        let query = `
            SELECT DISTINCT clientId, firm_name AS account_name
            FROM client_trust_accounts 
            WHERE adminId = ?
              AND firm_name IS NOT NULL 
              AND firm_name != '' 
            ORDER BY account_name ASC
        `;
        const [rows] = await dbConn.query(query, [adminId]);
        return rows;
    } catch (error) {
        throw new Error('Database error at getClientsBankLedger: ' + error.message);
    }
};



const allBankLedgers = async (client_id, purpose, userId, adminId) => {
    try {
        // building query
        let query = `SELECT 
            mfa.id, mfa.date, mfa.payee_name, mfa.transaction_method, mfa.cheque_number, 
            mfa.purpose, mfa.deposit_amount, mfa.disbursement_amount, mfa.bank_ledger_balance, mfa.notes, mfa.reconciled_to_ledger,
            cta.account_open_date, cta.account_close_date
            FROM manage_firm_accounting AS mfa 
            INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
            WHERE mfa.is_bank_charge = ?
        `;

        const conditions = [];
        const values = [true];

        if (client_id) {
            conditions.push(`mfa.client_id = ?`);
            values.push(client_id);
        }

        if (purpose) {
            conditions.push(`mfa.purpose LIKE ?`);
            values.push(toContainsLikeValue(purpose));
        }

        if (conditions.length > 0) {
            query += ` AND ${conditions.join(' AND ')}`;
        }

        if (userId) {
            query += ` AND mfa.adminId = ?`;
            values.push(adminId);
        }

        query += ` ORDER BY mfa.id DESC`;


        const [rows] = await dbConn.query(query, values);
        return rows;
    } catch (error) {
        return error;
    }
};


const getFirmInfoByClientId = async (clientId) => {
    try {
        const query = `SELECT * FROM client_trust_accounts WHERE clientId = ?`;
        const [rows] = await dbConn.query(query, [clientId]);
        return rows[0];
    } catch (error) {
        return error;
    }
}


module.exports = {
    allBankLedgers,
    getBankDaitles,
    getClientsBankLedger,
    getFirmInfoByClientId,
};

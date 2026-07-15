const dbConn = require("../../../dbConfig");
const { resolveRoleScopedField, toContainsLikeValue } = require('../../utils/sqlSafety');

const getLedgersClient = async (adminId, userId) => {
    try {
        let query = `SELECT DISTINCT lc.id, lc.client_name FROM ledger_client AS lc 
        INNER JOIN manage_firm_accounting AS mfa ON mfa.ledger_client_id = lc.id 
        WHERE lc.adminId = ? AND mfa.is_bank_charge = ?`;
        const [result] = await dbConn.query(query, [adminId, false]);
        return result;
    } catch (error) {
        throw error;
    }
}

const getAllLedgersClientDaitles = async (searchData) => {
    const { client_name, month, year, case_summary, userId, adminId, role } = searchData;
    try {
        const idValue = role === 'admin' ? adminId : userId;
        let query = role === 'admin' ? `
            SELECT 
                MFA.id,
                CTA.clientId,
                MFA.client_name,
                MFA.running_balance
            FROM client_trust_accounts AS CTA
            JOIN manage_firm_accounting AS MFA ON CTA.clientId = MFA.client_id
            JOIN use_clients AS uc ON CTA.clientId = uc.id
            WHERE CTA.adminId = ?
        ` : `
            SELECT 
                MFA.id,
                CTA.clientId,
                MFA.client_name,
                MFA.running_balance
            FROM client_trust_accounts AS CTA
            JOIN manage_firm_accounting AS MFA ON CTA.clientId = MFA.client_id
            JOIN use_clients AS uc ON CTA.clientId = uc.id
            WHERE CTA.userId = ?
        `;
        const values = [idValue];
        if (client_name) {
            query += ` AND CTA.account_name LIKE ?`;
            values.push(toContainsLikeValue(client_name));
        }
        if (month) {
            query += ` AND CTA.month = ?`;
            values.push(month);
        }
        if (year) {
            query += ` AND CTA.year = ?`;
            values.push(year);
        }
        if (case_summary) {
            query += ` AND uc.case_summary LIKE ?`;
            values.push(toContainsLikeValue(case_summary));
        }

        query += ` ORDER BY CTA.clientId, MFA.running_balance`;

        const [result] = await dbConn.query(query, values);
        return result;
    } catch (error) {
        return [];
    }
};


const getLedgerSummary = async (client_name, month, year, case_status, adminId, userId) => {
    try {

        // building the query
        let query = `
            WITH ranked_entries AS (
                SELECT
                    mfa.ledger_client_id,
                    mfa.ledger_balance,
                    cta.account_open_date, 
                    cta.account_close_date,
                    ROW_NUMBER() OVER (PARTITION BY mfa.ledger_client_id ORDER BY mfa.id DESC) AS rn
                FROM manage_firm_accounting AS mfa
                INNER JOIN client_trust_accounts AS cta ON mfa.client_id = cta.clientId
                WHERE mfa.is_bank_charge = ?
                AND mfa.adminId = ?
                AND MONTH(mfa.date) = ?
                AND YEAR(mfa.date) = ?
            )
            SELECT lc.client_name, re.ledger_balance, re.account_open_date, re.account_close_date
            FROM ranked_entries AS re
            LEFT JOIN ledger_client AS lc ON lc.id = re.ledger_client_id
            WHERE rn = ?
        `;

        if (case_status === 'open') {
            query += " AND re.account_close_date IS NULL";
        } else if (case_status === 'close') {
            query += " AND re.account_close_date IS NOT NULL";
        }
        // gathering values
        // const values = [client_name, 1, false, adminId, userId, month, year, 1];
        const values = [false, adminId, month, year, 1];

        // doing db operation
        const [result] = await dbConn.query(query, values);

        return result;
    } catch (error) {
        throw new Error("Datatbase error at getLedgerSummary: " + error.message);
    }
};


const getClientInfoByName = async ({ client_name }) => {
    try {
        const query = `SELECT account_name, month, year FROM client_trust_accounts WHERE account_name = ?`;
        const values = [client_name];
        const [result] = await dbConn.query(query, values);
        return result;
    } catch (error) {
        return [];
    }
}



module.exports = {
    getLedgersClient,
    getAllLedgersClientDaitles,
    getClientInfoByName,
    getLedgerSummary
};

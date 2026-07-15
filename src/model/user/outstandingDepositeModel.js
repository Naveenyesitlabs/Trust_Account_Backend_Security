const dbConn = require("../../../dbConfig");
const { getLastDatesOfByYears } = require("../../utils/balanceHelper");

const getOutstandingDeposite = async ({ userId, adminId, role }) => {
    const idValue = role === 'admin' ? adminId : userId;

    const query = role === 'admin' ? `
     SELECT mfa.date, mfa.cheque_number, mfa.payee_name, mfa.client_id, mfa.client_name,
        mfa.deposit_amount
     FROM manage_firm_accounting AS mfa
     JOIN client_trust_accounts AS uc ON mfa.client_id = uc.clientId
     WHERE mfa.deposit_amount IS NOT NULL
       AND uc.account_name IS NOT NULL 
       AND mfa.client_name IS NOT NULL
       AND mfa.adminId = ?
    ` : `
     SELECT mfa.date, mfa.cheque_number, mfa.payee_name, mfa.client_id, mfa.client_name,
        mfa.deposit_amount
     FROM manage_firm_accounting AS mfa
     JOIN client_trust_accounts AS uc ON mfa.client_id = uc.clientId
     WHERE mfa.deposit_amount IS NOT NULL
       AND uc.account_name IS NOT NULL 
       AND mfa.client_name IS NOT NULL
       AND mfa.userId = ?
    `;

    return dbConn.query(query, [idValue]).then((result) => {
        return result[0];
    }).catch((err) => {
        throw new Error("Database error at getOutstandingDeposite: " + err.message);
    });
};

const getOutstandings = async (adminId, userId, type) => {
    try {
        const query = type === 'deposit' ? `
            SELECT mfa.id, mfa.date, mfa.cheque_number, mfa.payee_name, lc.client_name, mfa.deposit_amount
            FROM manage_firm_accounting AS mfa
            INNER JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id
            WHERE (mfa.adminId = ? OR mfa.userId = ?) 
              AND mfa.is_bank_charge = ? 
              AND mfa.is_outstanding = ? 
              AND mfa.deposit_amount > ?
            ORDER BY mfa.id DESC
        ` : `
            SELECT mfa.id, mfa.date, mfa.cheque_number, mfa.payee_name, lc.client_name, mfa.disbursement_amount
            FROM manage_firm_accounting AS mfa
            INNER JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id
            WHERE (mfa.adminId = ? OR mfa.userId = ?) 
              AND mfa.is_bank_charge = ? 
              AND mfa.is_outstanding = ? 
              AND mfa.disbursement_amount > ?
            ORDER BY mfa.id DESC
        `;

        const values = [adminId, userId, false, true, 0];
        const [result] = await dbConn.query(query, values);
        return result;
    } catch (err) {
        throw new Error("Database error at getOutstandings: " + err.message);
    }
};

module.exports = {
    getOutstandingDeposite,
    getOutstandings
};

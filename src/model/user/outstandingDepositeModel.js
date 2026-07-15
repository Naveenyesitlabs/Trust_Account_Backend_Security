const dbConn = require("../../../dbConfig");
const { getLastDatesOfByYears } = require("../../utils/balanceHelper");

const table = "manage_firm_accounting";

const getOutstandingDeposite = async ({ userId, adminId, role }) => {
    const idField = role === 'admin' ? 'adminId' : 'userId';
    const idValue = role === 'admin' ? adminId : userId;

    const query = `
     SELECT mfa.date, mfa.cheque_number, mfa.payee_name, mfa.client_id, mfa.client_name,
        mfa.deposit_amount
     FROM ${table} AS mfa
     JOIN client_trust_accounts AS uc ON mfa.client_id = uc.clientId
     WHERE mfa.deposit_amount IS NOT NULL
       AND uc.account_name IS NOT NULL 
       AND mfa.client_name IS NOT NULL
       AND mfa.${idField} = ?
    `;

    return dbConn.query(query, [idValue]).then((result) => {
        return result[0];
    }).catch((err) => {
        throw new Error("Database error at getOutstandingDeposite: " + err.message);
    });
};

const getOutstandings = async (adminId, userId, type) => {
    try {
        const column_name = type === 'deposit' ? 'deposit_amount' : 'disbursement_amount';
        const query = `
            SELECT mfa.id, mfa.date, mfa.cheque_number, mfa.payee_name, lc.client_name, mfa.${column_name}
            FROM ${table} AS mfa
            INNER JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id
            WHERE (mfa.adminId = ? OR mfa.userId = ?) 
              AND mfa.is_bank_charge = ? 
              AND mfa.is_outstanding = ? 
              AND mfa.${column_name} > ?
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

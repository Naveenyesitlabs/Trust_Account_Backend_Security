const dbConn = require("../../../dbConfig");

const table = "manage_firm_accounting";


const getDisbursementAmount = async (adminId, userId, role) => {
    const idField = role === 'admin' ? 'adminId' : 'userId';
    const idValue = role === 'admin' ? adminId : userId;

    const query = `
        SELECT DISTINCT mfa.date, mfa.cheque_number, mfa.payee_name, mfa.client_id, uc.account_name AS client_name,
        mfa.disbursement_amount
        FROM ${table} AS mfa
        JOIN client_trust_accounts AS uc ON mfa.client_id = uc.clientId
        WHERE mfa.disbursement_amount IS NOT NULL AND mfa.client_name IS NOT NULL
        AND uc.account_name IS NOT NULL
        AND mfa.${idField} = ?
    `;

    const result = await dbConn.query(query, [idValue])
        .then(([rows]) => rows)
        .catch((err) => {
            console.error("DB Error:", err);
            return [];
        });

    return result;

}



module.exports = getDisbursementAmount
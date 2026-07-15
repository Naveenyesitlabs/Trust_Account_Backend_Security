const dbConn = require('../../../dbConfig');
const { resolveRoleScopedField } = require('../../utils/sqlSafety');


const isTheAdminData = async (adminId, userId, clientId, role) => {
    const idValue = role === 'admin' ? adminId : userId;
    const query = role === 'admin'
        ? 'SELECT * FROM client_trust_accounts WHERE adminId = ? AND clientId = ?;'
        : 'SELECT * FROM client_trust_accounts WHERE userId = ? AND clientId = ?;';

    const [rows] = await dbConn.query(query, [idValue, clientId]);
    return rows.length > 0;

}


const isAccountExist = async (account_number, adminId) => {
    try {
        // const idField = role === 'admin' ? 'adminId' : 'userId';
        // const idValue = role === 'admin' ? adminId : userId;
        let query = `SELECT COUNT(clientId) AS count FROM client_trust_accounts 
        WHERE account_number = ? AND adminId = ? `;
        const values = [account_number, adminId];
        const [rows] = await dbConn.query(query, values);

        return rows[0].count > 0;
    } catch (error) {
        throw new Error('Database error: ' + error.message);
    }
}


const addClientTrustAccount = async (data) => {
    const { firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date, created_by, adminId, userId, role
    } = data;

    // const isAdminId = role === 'admin' ? adminId : created_by;
    // const isUserId = role === 'user' ? userId : null;

    const query = `
        INSERT INTO client_trust_accounts 
        (firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date,adminId, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await dbConn.query(query, [firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date, adminId, userId

    ]);

    return { clientId: result.insertId, ...data };
};

const updateClientTrustAccount = async (clientId, data) => {
    const { firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date
    } = data;
    const query = `
        UPDATE client_trust_accounts
        SET firm_name = ?, bank_name = ?, account_name = ?, account_number = ?, month = ?, year = ?, account_open_date = ?, account_close_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE clientId = ?
    `;
    await dbConn.query(query, [firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date, clientId]);
    return { clientId, ...data };
};


// returns undefined if not found, perfect for checks
const getClientTrustAccountById = async (clientId) => {
    const [rows] = await dbConn.query(
        `SELECT * FROM client_trust_accounts WHERE clientId = ?`,
        [clientId]
    );
    return rows[0];
};

// Get all trust accounts
const getAllClientTrustAccounts = async (adminId, userId, role) => {
    let query = `SELECT * FROM client_trust_accounts WHERE adminId = ? ORDER BY clientId DESC`;
    const [rows] = await dbConn.query(
        query,
        [adminId]
    );

    return rows;

};


// Delete by ID
const deleteClientTrustAccount = async (clientId) => {
    await dbConn.query(`DELETE FROM client_trust_accounts WHERE clientId = ?`, [clientId]);
};


/**
 * Fetch client info
 */
const getClientId = async (
    adminId = null,
    bank_name = null,
    account_number = null,
    account_name = null,
    firm_name = null,
    ledger_details = null,
    purpose = null,
) => {
    try {
        // Base query
        let query = `SELECT 
                        *
                    FROM client_trust_accounts 
                    WHERE 1=1 AND adminId = ?`; // Always true, simplifies condition appending

        const values = [adminId];

        // Add conditions dynamically
        if (bank_name) {
            query += ` AND bank_name = ?`;
            values.push(bank_name);
        }
        if (account_number) {
            query += ` AND account_number = ?`;
            values.push(account_number);
        }
        if (account_name) {
            query += ` AND account_name = ?`;
            values.push(account_name);
        }
        if (firm_name) {
            query += ` AND firm_name = ?`;
            values.push(firm_name);
        }
        if (ledger_details) {
            query += ` AND ledger_details = ?`;
            values.push(ledger_details);
        }
        if (purpose) {
            query += ` AND purpose = ?`;
            values.push(purpose);
        }

        const [rows] = await dbConn.query(query, values);

        return rows[0] || [];
    } catch (error) {
        return false;
    }
};

const createClientFromBankStatement = async (data) => {
    try {
        // destructuring data
        const { firm_name, bank_name, account_number, account_name, account_open_date, account_close_date, adminId, userId } = data;

        // building query
        const query = `INSERT INTO client_trust_accounts 
        (firm_name, bank_name, account_number, account_name, account_open_date, account_close_date, adminId, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [firm_name, bank_name, account_number, account_name, account_open_date, account_close_date, adminId, userId];

        // executing query
        const [result] = await dbConn.query(query, values);
        return result.insertId;
    } catch (error) {
        throw new Error('Database error at createClientFromBankStatement: ' + error.message);
    }
}


module.exports = {
    addClientTrustAccount,
    updateClientTrustAccount,
    getAllClientTrustAccounts,
    deleteClientTrustAccount,
    getClientTrustAccountById,
    getClientId,
    isTheAdminData,
    isAccountExist,
    createClientFromBankStatement
};

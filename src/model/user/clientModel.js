const dbConn = require('../../../dbConfig');
const { toContainsLikeValue } = require('../../utils/sqlSafety');


/**
 * Create new client
 * @param {*} clientData 
 * @returns 
 */
const createClient = async (clientData) => {
    try {
        const query = `
            INSERT INTO use_clients (account_name, fee_type,case_summary,account_open_date, userId)
            VALUES (?, ?, ?,?,?)
            `;

        const values = [clientData.account_name, clientData.fee_type, clientData.case_summary, clientData.account_open_date, clientData.userId];

        const [rows] = await dbConn.query(query, values);
        return rows.insertId;

    } catch (error) {
        return false;
    }
}


const getAllClientsUserDB = async (adminId, userId, role) => {
    try {
        const idValue = role === 'admin' ? adminId : userId;

        const query = role === 'admin' ? `
            SELECT cta.account_name COLLATE utf8mb4_general_ci AS client_name
            FROM client_trust_accounts AS cta
            WHERE cta.adminId = ?

            UNION

            SELECT uc.account_name COLLATE utf8mb4_general_ci AS client_name
            FROM use_clients AS uc
            WHERE uc.adminId = ?
        ` : `
            SELECT cta.account_name COLLATE utf8mb4_general_ci AS client_name
            FROM client_trust_accounts AS cta
            WHERE cta.userId = ?

            UNION

            SELECT uc.account_name COLLATE utf8mb4_general_ci AS client_name
            FROM use_clients AS uc
            WHERE uc.userId = ?
        `;

        const [rows] = await dbConn.query(query, [idValue, idValue]);

        return rows;

    } catch (error) {
        return false;
    }
}


const fetchClients = async ({
    filters = [],
} = {}) => {
    try {
        const accountNameFilter = filters.find(
            (filter) =>
                filter?.field === 'account_name' &&
                filter?.operator?.toUpperCase() === 'LIKE' &&
                filter?.value !== undefined &&
                filter?.value !== null
        );

        let query = `
            SELECT clientId as id, account_name as name
            FROM use_clients
        `;
        const values = [];

        if (accountNameFilter) {
            query += ' WHERE account_name LIKE ?';
            values.push(accountNameFilter.value);
        }

        query += ' ORDER BY name ASC';

        const [rows] = await dbConn.query(query, values);
        return rows;

    } catch (error) {
        return false;
    }
};



/**
 * Fetch client info
 */
const getClientInfo = async ({
    admin_id = null,
    client_id = null,
    client_name = null,
    bank_name = null,
    account_number = null,
    account_name = null
}) => {
    try {
        let query = `SELECT lc.id AS client_id, lc.client_name, cm.matter, cm.opened_on, cm.closed_on FROM ledger_client AS lc 
                    LEFT JOIN client_matter AS cm ON cm.ledger_client_id = lc.id
                    WHERE lc.id = ?`;
        const values = [client_id];
        if (admin_id) {
            query += ` AND lc.adminId = ? `;
            values.push(admin_id);
        }

        query += ` ORDER BY cm.id DESC
                    LIMIT 1`

        const [rows] = await dbConn.query(query, values);
        return rows;
    } catch (error) {
        return false;
    }
};


/**
 * To check client_id is exist or not
 * @param {*} clientId 
 * @returns 
 */
const isClientExists = async (clientId) => {
    try {
        // bulding the query
        const query = 'SELECT COUNT(id) FROM use_clients WHERE id = ?';
        const [rows] = await dbConn.query(query, [clientId]);
        return rows.length > 0;
    } catch (error) {
        return false;
    }
};


/**
 * Get client count
 */
const getClientCount = async () => {
    try {
        // bulding the query
        const query = 'SELECT COUNT(clientId) AS count FROM use_clients';
        const [rows] = await dbConn.query(query);
        return rows[0].count;
    } catch (error) {
        return false;
    }
};


/**
 * get all clients for client table
 */
const fetchAllClientsFromDB = async (search, start_date, end_date) => {
    try {
        // bulding the query
        let query = `SELECT 
                            CTA.clientId AS id,
                            CTA.account_open_date,
                            CTA.account_close_date,
                            CTA.account_name,
                            CTA.fee_type,
                            CTA.case_summary,
                            (
                                SELECT MFA.ledger_balance FROM manage_firm_accounting AS MFA
                                WHERE MFA.client_id = CTA.clientId
                                ORDER BY MFA.id DESC
                                LIMIT 1
                            ) AS ledger_balance
                        FROM client_trust_accounts AS CTA`;

        const conditions = [];
        const values = [];
        // add search condition
        if (search) {
            conditions.push(`CTA.account_name LIKE ? ESCAPE '\\'`);
            values.push(toContainsLikeValue(search));
        }
        // add date range condition
        if (start_date && end_date) {
            conditions.push(`CTA.account_open_date BETWEEN ? AND ?`);
            values.push(start_date, end_date);
        }

        // add where clause
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`
        }

        // add order by clause
        query += ` ORDER BY CTA.created_at DESC`;

        // fetching the data
        const [rows] = await dbConn.query(query, values);
        return rows;
    } catch (error) {
        return false;
    }
};

/**
 * Update client
 * @param {*} client_id 
 * @param {*} clientData 
 * @returns 
 */
const modifyClient = async (client_id, clientData) => {
    try {
        const [rows] = await dbConn.query('UPDATE use_clients SET ? WHERE clientId = ?', [clientData, client_id]);
        return rows;
    } catch (error) {
        return false;
    }
};


// exporting the functions
module.exports = {
    createClient,
    fetchClients,
    getClientInfo,
    isClientExists,
    getClientCount,
    fetchAllClientsFromDB,
    modifyClient,
    getAllClientsUserDB
};

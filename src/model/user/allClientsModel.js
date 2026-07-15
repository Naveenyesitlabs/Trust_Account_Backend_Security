const dbConn = require('../../../dbConfig');

const insertLedgerClient = async (clientData) => {
    try {
        // building the query
        const query = 'INSERT INTO ledger_client SET ?';

        // executing the query
        const [result] = await dbConn.query(query, clientData); // Destructure result
        if (result.affectedRows <= 0) {
            return false; // No row inserted
        }

        return { id: result.insertId, client_name: result.client_name };
    } catch (error) {
        throw new Error("Database error at insertLedgerClient: " + error.message);
    }
}


const getAllLegerClients = async (adminId) => {
    try {
        // building te query
        let query = `SELECT DISTINCT lc.id, lc.created_at, lc.client_name, lc.fee_type, lc.case_summary, lc.case_open, lc.case_close,
                    (SELECT COUNT(cm.id) FROM client_matter AS cm WHERE cm.ledger_client_id = lc.id AND cm.closed_on IS NULL) AS lien_count,
                    (SELECT ledger_balance FROM manage_firm_accounting WHERE ledger_client_id = lc.id ORDER BY id DESC LIMIT 1) AS ledger_balance
                    FROM ledger_client AS lc 
                    WHERE lc.adminId = ? ORDER BY lc.id DESC`;
        // executing the query
        const [rows] = await dbConn.query(query, [adminId]);
        return rows;
    } catch (error) {
        throw new Error("Database error at getAllLegerClients: " + error.message);
    }
}


const getLedgerClientList = async (adminId) => {
    try {
        // building te query
        let query = `SELECT DISTINCT mfa.ledger_client_id, lc.client_name FROM manage_firm_accounting AS mfa
                     INNER JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id
                     WHERE mfa.adminId = ? ORDER BY lc.client_name ASC`;
        // executing the query
        const [rows] = await dbConn.query(query, [adminId]);
        return rows;
    } catch (error) {
        throw new Error("Database error at getLedgerClientList: " + error.message);
    }
}


const accountDetails = async (adminId, bank_name, accountNumber) => {
    try {
        const query = `
      SELECT clientId 
      FROM client_trust_accounts 
      WHERE account_number = ? AND bank_name LIKE ? AND adminId = ?
      LIMIT 1
    `;

        const values = [accountNumber, `%${bank_name}%`, adminId]; // Add wildcards here

        const [result] = await dbConn.query(query, values);

        return result.length > 0 ? result[0].clientId : null;

    } catch (error) {
        throw new Error("Database error at accountDetails: " + error.message);
    }
};



const getTrustClientId = async (ledger_client_id) => {
    try {
        // building query
        let query = `SELECT client_id FROM ledger_client WHERE id = ?`;
        const [rows] = await dbConn.query(query, [ledger_client_id]);
        return rows.length > 0 ? rows[0].client_id : null;
    } catch (error) {
        throw new Error("Database error at getTrustClientId: " + error.message);
    }
}


module.exports = {
    insertLedgerClient,
    getAllLegerClients,
    accountDetails,
    getTrustClientId,
    getLedgerClientList,
}

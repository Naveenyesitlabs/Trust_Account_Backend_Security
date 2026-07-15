const dbConn = require('../../../dbConfig');

/**
 * To insert trust documents
 * @param {*} clientId 
 * @param {*} data 
 * @returns 
 */
const insertTrustDocuments = async (data) => {
    try {
        const query = 'INSERT INTO client_trust_entry SET ?';

        const [result] = await dbConn.query(query, data); // Destructure result
        if (result.affectedRows > 0) {
            return true; // Successfully inserted
        } else {
            return false; // No row inserted
        }
    } catch (error) {
        console.error("Insert error:", error);
        throw new Error("Database error at insertTrustDocuments: " + error.message);
    }
};



/**
 *  To get recent client trust entry documents
 * @param {*} user_id 
 * @returns 
 */
const getRecentClientTrustEntryDocuments = async (adminId) => {
    try {
        // building query
        let query = 'SELECT * FROM client_trust_entry WHERE adminId = ? ORDER BY date DESC';
        const values = [adminId];

        // fetching data
        const [rows] = await dbConn.query(query, values);
        return rows;
    } catch (error) {
        console.error("Fetch error:", error);
        throw new Error("Database error at getRecentClientTrustEntryDocuments: " + error.message);
    }
};



module.exports = {
    insertTrustDocuments,
    getRecentClientTrustEntryDocuments
}

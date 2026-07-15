const dbConn = require("../../../dbConfig");

/**
 * Create new matter
 * @param {*} matterData 
 * @returns 
 */
const addMatter = async (matterData) => {
    try {
        const [rows] = await dbConn.query('INSERT INTO client_matter SET ?', [matterData]);
        if (rows.affectedRows <= 0) return false;

        return { id: rows.insertId };
    } catch (error) {
        throw new Error("Database error at addMatter: " + error.message);
    }
};


const getMatterByClientId = async (ledger_client_id) => {
    try {
        const [rows] = await dbConn.query('SELECT id, matter FROM client_matter WHERE ledger_client_id = ?', [ledger_client_id]);
        return rows;
    } catch (error) {
        throw new Error("Database error at getMatterByClientId: " + error.message);
    }
};


const getMatters = async (adminId) => {
    try {
        // building the query
        let query = `SELECT cm.id, lc.client_name, cm.matter, cm.lien_holder, cm.amount, 
        cm.amount_paid, cm.balance, cm.status, cm.notes, cm.date AS date_issued, cm.resolve_status
        FROM client_matter AS cm 
        INNER JOIN ledger_client AS lc ON lc.id = cm.ledger_client_id 
        WHERE cm.adminId = ?`;

        const values = [adminId];
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return [];

        return rows;
    } catch (error) {
        throw new Error("Database error at getMatters: " + error.message);
    }
};


const updateMatterNote = async (matterId, notes) => {
    try {
        let query = 'UPDATE client_matter SET notes = ? WHERE id = ?';
        const values = [notes, matterId];
        const [rows] = await dbConn.query(query, values);
        return rows.affectedRows > 0
    } catch (error) {
        throw new Error("Database error at updateMatterNote: " + error.message);
    }
}


const updateMatterResolveStatus = async (matterId, resolve_status) => {
    try {
        let query = 'UPDATE client_matter SET resolve_status = ? WHERE id = ?';
        const values = [resolve_status, matterId];
        const [rows] = await dbConn.query(query, values);
        return rows.affectedRows > 0
    } catch (error) {
        throw new Error("Database error at updateMatterResolveStatus: " + error.message);
    }
}

const updateMatter = async (matterId, matterData) => {
    try {
        let query = 'UPDATE client_matter SET ? WHERE id = ?';
        const values = [matterData, matterId];
        const [rows] = await dbConn.query(query, values);
        return rows.affectedRows > 0
    } catch (error) {
        throw new Error("Database error at updateMatter: " + error.message);
    }
}


const getJournalClientID = async (ledger_client_id) => {
    try {
        let query = `SELECT mfa.client_id FROM manage_firm_accounting AS mfa WHERE mfa.ledger_client_id = ? ORDER BY mfa.id DESC LIMIT 1`;
        const values = [ledger_client_id];
        const [rows] = await dbConn.query(query, values);
        return rows.length <= 0 ? null : rows[0].client_id;
    } catch (error) {
        throw new Error("Database error at getJournalClientID: " + error.message);
    }
}


const getJournalEntryByLien = async (lien_id) => {
    try {
        let query = `SELECT * FROM manage_firm_accounting WHERE lien_id = ?`;
        const values = [lien_id];
        const [rows] = await dbConn.query(query, values);
        return rows.length === 0 ? null : rows[0];
    } catch (error) {
        throw new Error("Database error at getJournalEntryByLien: " + error.message);
    }
}


const getMatterById = async (id) => {
    try {
        const query = `SELECT * FROM client_matter WHERE id = ?`;
        const values = [id];
        const [rows] = await dbConn.query(query, values);
        return rows.length === 0 ? null : rows[0];
    } catch (error) {
        throw new Error("Database error at getMatterById: " + error.message);
    }
};



module.exports = {
    addMatter,
    getMatterByClientId,
    getMatters,
    updateMatterNote,
    updateMatterResolveStatus,
    updateMatter,
    getJournalClientID,
    getJournalEntryByLien,
    getMatterById,
};

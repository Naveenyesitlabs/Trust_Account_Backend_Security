const dbConn = require("../../../dbConfig");


// checkUserByEmail
const isExistsAttorneyByEmail = async (email) => {
    const query = `SELECT * FROM manage_attorneys WHERE email = ?`;
    const [rows] = await dbConn.query(query, [email]);
    return rows.length > 0;
};


const addNewAttorney = async (attorney) => {
    const { attorney_name, email, phone } = attorney;
    const lowerEmail = email.toLowerCase();
    const query = `INSERT INTO manage_attorneys (attorney_name, email, phone) VALUES (?, ?, ?)`;
    const [rows] = await dbConn.query(query, [attorney_name, lowerEmail, phone]);
    return { ...attorney };
}

const getAttorneys = async () => {
    const [rows] = await dbConn.query('SELECT * FROM manage_attorneys');
    return rows;
}

const updateAttorneyById = async (attorneyUpdateData) => {
    const { id, attorney_name, email, phone } = attorneyUpdateData;
    const lowerEmail = email.toLowerCase();
    const query = `UPDATE manage_attorneys SET attorney_name = ?, email = ?, phone = ? WHERE id = ?`;
    const [rows] = await dbConn.query(query, [attorney_name, lowerEmail, phone, id]);
    return { UpdatedId: rows.affectedRows > 0, ...attorneyUpdateData };
}

const deleteAttorneyById = async (id) => {
    const query = `DELETE FROM manage_attorneys WHERE id = ?`;
    const [rows] = await dbConn.query(query, [id]);
    return { DeletedId: rows.affectedRows > 0 }
}



module.exports = {
    isExistsAttorneyByEmail,
    addNewAttorney,
    getAttorneys,
    updateAttorneyById,
    deleteAttorneyById
};

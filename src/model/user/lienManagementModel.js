const dbConn = require("../../../dbConfig");

const newLien = async ({ lien_holder_name, amount, date_of_issue, status, notes, adminId, userId, role }) => {
    const idField = role === 'admin' ? 'adminId' : 'userId';
    const idValue = role === 'admin' ? adminId : userId;
    try {
        // let query = `
        // INSERT INTO lien_management (lien_holder_name, amount, date_of_issue, status, notes, role_scoped_id )
        // VALUES ( ?, ?, ?, ?, ?, ? )
        // `;
        // const result = await dbConn.query(query, [lien_holder_name, amount, date_of_issue, status, notes, idValue]);
        // return result;
    } catch (error) {
        console.error(error);
        return error
    }
}

module.exports = {
    newLien
}

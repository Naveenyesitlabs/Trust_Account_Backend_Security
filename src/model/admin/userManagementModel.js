const dbConn = require('../../../dbConfig');

const isEmailExist = async (email) => {
    try {
        const query = `SELECT COUNT(id) AS count FROM user_management WHERE email = ?`;

        const [rows] = await dbConn.query(query, [email]);
        // Check if count is greater than 0
        return rows[0].count > 0;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};


// creating user
const addUserIntoManagement = async (userData) => {
    try {
        // destructuring data
        const { user_id, name, email, phone, designation, role_id, created_by } = userData;

        // getting todays date
        const sign_up_date = new Date();
        // const assign_role = 'user';
        const access_status = 'granted';
        const suspend_status = 'active';
        const subscription_type = 'basic'

        // building query
        const query = `INSERT INTO user_management 
        (user_id, name, email, sign_up_date, role_id, designation, access, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        // getting values
        const values = [user_id, name, email, sign_up_date, role_id, designation, access_status, created_by];

        // creating into user management
        const [result] = await dbConn.query(
            query,
            values
        );

        return { id: result.insertId };
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
}



const getAllUsersFromManagement = async (admin_id) => {
    try {
        // const query = 'SELECT * FROM user_management';
        const query = `SELECT um.*,r.name as role_name FROM user_management as um 
                        left join role as r on r.id = um.role_id
                        WHERE um.created_by = ? and um.deleted_at is null
                        order by um.id desc`;
        const [rows] = await dbConn.query(query, [admin_id]);
        return rows;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};

const updateUserManagement = async (id, { name, email, phone, assign_role, role_id, designation }) => {
    try {
        const updates = {};

        if (name) {
            updates.name = name;
        }
        if (email) {
            updates.email = email;
        }
        if (phone) {
            updates.phone = phone;
        }
        if (assign_role) {
            updates.assign_role = assign_role;
        }
        if (role_id) {
            updates.role_id = role_id;
        }
        if (designation) {
            updates.designation = designation;
        }

        if (Object.keys(updates).length === 0) {
            throw new Error('No fields to update');
        }

        const [result] = await dbConn.query('UPDATE user_management SET ? WHERE id = ?', [updates, id]);
        return result;

    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};


const checkEmailExist = async (email, id) => {
    try {
        // const query = `SELECT * FROM user_management WHERE email = ?`;
        // const [rows] = await dbConn.query(query, [email]);
        // return rows[0]
        const query = `
            SELECT 1 
            FROM user_management 
            WHERE email = ? AND id != ? 
            LIMIT 1
            `;

        const [rows] = await dbConn.query(query, [email, id]);
        const emailExists = rows.length > 0;
        return emailExists;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
}


// deleteUserById
const deleteUserManagementById = async (id, now, email) => {
    try {
        // const query = `DELETE FROM user_management WHERE id = ?`;
        const query = `update user_management set deleted_at = ?, email = ? where id = ?`;
        const [result] = await dbConn.query(query, [now, email, id]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};


const updateAccessStatusUserManagementById = async (id, access_status) => {
    try {
        const validAccess = ['granted', 'denied'];
        if (!validAccess.includes(access_status)) {
            throw new Error('Invalid access value');
        }

        // const query = `UPDATE user_management SET access = ? WHERE id = ?`;
        const query = `UPDATE user_management SET access = ? WHERE id = ?`;
        const [result] = await dbConn.query(query, [access_status, id]);

        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};


const hasPermission = async (user_id) => {
    try {
        const query = 'SELECT access FROM user_management WHERE user_id = ?';

        const [rows] = await dbConn.query(query, [user_id]);

        return rows[0].access === 'granted';
    } catch (err) {
        throw new Error('Database error at hasPermission: ' + err.message);
    }
};


const getAdminId = async (user_id) => {
    try {
        let query = `SELECT created_by FROM user_management AS um WHERE um.user_id = ? LIMIT 1`;

        const [rows] = await dbConn.query(query, [user_id]);
        return rows[0].created_by || null;
    } catch (err) {
        throw new Error('Database error at getAdminID: ' + err.message);
    }
}


const getLoggedInUserInfo = async (user_id) => {
    try {
        let query = `SELECT * FROM user_management WHERE user_id = ? LIMIT ?`;

        const [rows] = await dbConn.query(query, [user_id, 1]);
        return rows[0] || null;
    } catch (error) {
        throw new Error('Database error at getAdminID: ' + error.message);
    }
}


const getCreatedByUser = async () => {
    try {
        let query = `select u.userid from users as u
                    inner join role as r on r.id = u.role_id
                    where r.name=? and r.name=? and r.name=? 
                    and r.deleted_at is null 
                    and u.deleted_at is null
                    order by u.userid desc limit 1;`;
        const [rows] = await dbConn.query(query, ['admin', 'ADMIN', 'Admin']);
        return rows.length > 0 ? rows[0].userid : null;
    } catch (error) {
        throw new Error('Database error at getCreatedByUser: ' + error.message);
    }
}

const updateUserByAdmin = async (userid, userData) => {
    try {
        let query = `update users set ? where userid = ?`;
        const [rows] = await dbConn.query(query, [userData, userid]);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at updateUserByAdmin: ' + error.message);
    }
}

const getUserIdByUserManagement = async (id) => {
    try {
        let query = `select user_id from user_management where id=?`;
        const [rows] = await dbConn.query(query, [id]);
        return rows.length > 0 ? rows[0].user_id : null;
    } catch (error) {
        throw new Error('Database error at getUserIdByUserManagement: ' + error.message);
    }
}


const deleteUserByAdmin = async (id, now, email) => {
    try {
        let query = `update users set deleted_at = ?, email = ? where userid = ?`;
        const [rows] = await dbConn.query(query, [now, email, id]);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at deleteUserByAdmin: ' + error.message);
    }
}


module.exports = {
    isEmailExist,
    addUserIntoManagement,
    getAllUsersFromManagement,
    updateUserManagement,
    deleteUserManagementById,
    updateAccessStatusUserManagementById,
    hasPermission,
    checkEmailExist,
    getAdminId,
    getLoggedInUserInfo,
    getCreatedByUser,
    updateUserByAdmin,
    getUserIdByUserManagement,
    deleteUserByAdmin,
};

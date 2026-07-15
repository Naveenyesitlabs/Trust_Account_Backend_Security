const dbConn = require('../../../dbConfig');
const bcrypt = require("bcryptjs");

// Method to find a user by email

const findUserByEmail = async (email) => {
    const query = `SELECT users.*, r.name as role FROM users 
    left join role as r on r.id=users.role_id
    WHERE email = ?`;
    try {
        const [rows] = await dbConn.query(query, [email]);
        if (rows.length === 0) {

            return [];
        }

        return rows[0];
    } catch (err) {
        throw new Error('Database error');
    }
};

const addBankDetails = async (bankData) => {
    try {
        let query = `INSERT INTO bank_details SET ?`;

        const [rows] = await dbConn.query(query, bankData);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at addBankDetails: ' + error.message);
    }
}


const updateBankDetails = async (id, bankData) => {
    try {
        let query = `UPDATE bank_details SET ? WHERE id = ?`;

        const [rows] = await dbConn.query(query, [bankData, id]);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at updateBankDetails: ' + error.message);
    }
}


const updateUserLogin = async (userId, loginData) => {
    try {
        const query = 'UPDATE users SET ? WHERE userid = ?';
        const [result] = await dbConn.query(query, [loginData, userId]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error at updateUserLogin: ' + err.message);
    }
}

const updateUserDetails = async (id, data) => {
    try {
        const query = 'UPDATE user_management SET ? WHERE id = ?';
        const [result] = await dbConn.query(query, [data, id]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error at updateUserDetails: ' + err.message);
    }
}

const updateFirmDetails = async (id, data) => {
    try {
        const query = 'UPDATE manage_firm SET ? WHERE id = ?';
        const [result] = await dbConn.query(query, [data, id]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error at updateFirmDetails: ' + err.message);
    }
}

const updateUserProfileData = async (id, data) => {
    try {
        const query = 'UPDATE users SET ? WHERE userid = ?';
        const [result] = await dbConn.query(query, [data, id]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error at updateUserProfileData: ' + err.message);
    }
}


const createUser = async (userData) => {
    const { name, email, password, role_id, phone, created_by } = userData;
    const query = 'INSERT INTO users (name, email, password, phone, role_id, created_by) VALUES (?, ?, ?, ?, ?, ?)';
    try {
        const result = await dbConn.query(query, [name, email, password, phone, role_id, created_by]);
        return result;
    } catch (err) {
        throw err;
    }
};




// Method to update the user password
const updateUserPassword = async (userId, hashedPassword) => {
    const query = 'UPDATE users SET password = ? WHERE userid = ?';
    try {
        const [result] = await dbConn.query(query, [hashedPassword, userId]);
        return result;
    } catch (err) {
        throw new Error('Error updating password');
    }
};

// Method to update OTP (if you're using OTP functionality)
const updateUserOtp = async (userId, otp) => {
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);
    const query = 'UPDATE users SET otp = ?, otp_expiry = ? WHERE userid = ?';
    try {
        const [result] = await dbConn.query(query, [otp, otpExpiry, userId]);
        return result;
    } catch (err) {
        throw new Error('Error updating OTP');
    }
};

const clearUserOtp = async (userId) => {
    const query = 'UPDATE users SET otp = NULL, otp_expiry = NULL WHERE userid = ?';
    try {
        const [result] = await dbConn.query(query, [userId]);
        return result;
    } catch (err) {
        throw new Error('Error clearing OTP');
    }
};


// Get user with bank details by user ID
const getUserWithBankDetailsById = async (userid) => {
    try {
        const query = `
            SELECT
                u.userid,
                u.name,
                u.email,
                u.phone,
                u.role_id,
                bd.id AS bank_detail_id,
                bd.full_name,
                bd.bank_name,
                bd.account_no,
                bd.routing_no,
                bd.created_at AS bank_created_at,
                bd.updated_at AS bank_updated_at
            FROM users AS u
            LEFT JOIN bank_details AS bd
                ON u.userid = bd.userid
                AND bd.deleted_at IS NULL
            WHERE u.userid = ?
              AND u.deleted_at IS NULL
            ORDER BY bd.id DESC
            LIMIT 1
        `;

        const [rows] = await dbConn.query(query, [userid]);
        return rows[0] || [];
    } catch (error) {
        throw new Error('Error fetching user and bank details: ' + error.message);
    }
};

const getBankDetailsByUserId = async (user_id) => {
    try {
        let query = `SELECT * FROM bank_details WHERE userid = ? ORDER BY id LIMIT 1`;

        const [rows] = await dbConn.query(query, [user_id]);
        if (rows.length === 0) return [];

        return rows[0];
    } catch (error) {
        throw new Error('Error fetching user and bank details: ' + error.message);
    }
}


// Update user and bank details together
const updateUserAndBankDetails = async (data) => {
    const {
        userid,
        name,
        email,
        phone,
        full_name,
        bank_name,
        account_no,
        routing_no
    } = data;

    const connection = await dbConn.getConnection();

    try {
        await connection.beginTransaction();

        // Update user details
        await connection.query(
            'UPDATE users SET name = ?, email = ?, phone = ? WHERE userid = ? AND deleted_at IS NULL',
            [name, email, phone, userid]
        );

        const [rows] = await connection.query(
            `SELECT full_name, bank_name, account_no, routing_no 
             FROM bank_details 
             WHERE userid = ? AND deleted_at IS NULL`,
            [userid]
        );

        const bankResults2 = rows;
        if (bankResults2.length === 0) {
            const query = 'INSERT INTO bank_details (userid, bank_name, full_name, routing_no, account_no) VALUES (?, ?, ?, ?,?)';
            await connection.query(query, [userid, full_name, bank_name, account_no, routing_no]);
        } else {
            // Update bank details
            await connection.query(
                `UPDATE bank_details 
             SET full_name = ?, bank_name = ?, account_no = ?, routing_no = ?, updated_at = NOW() 
             WHERE userid = ? AND deleted_at IS NULL`,
                [full_name, bank_name, account_no, routing_no, userid]
            );
        }
        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        throw new Error('Error updating user and bank details: ' + error.message);
    } finally {
        connection.release();
    }
};


// deleteAccount
const deleteAccount = async (userid, role) => {
    const connection = await dbConn.getConnection();
    try {
        await connection.beginTransaction();
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');

        const timestamp =
            now.getFullYear().toString() +
            pad(now.getMonth() + 1) +
            pad(now.getDate()) +
            pad(now.getHours()) +
            pad(now.getMinutes()) +
            pad(now.getSeconds());

        const email = 'DELUSR' + timestamp;

        // Soft delete the user in the users table
        const [userResult] = await connection.query(
            `UPDATE users
             SET email = ?, deleted_at = ?
             WHERE userid = ? AND deleted_at IS NULL`,
            [email, now, userid]
        );

        if (userResult.affectedRows === 0) {
            throw new Error('User not found or already deleted');
        }

        const [bankResult] = await connection.query(
            `UPDATE bank_details
             SET deleted_at = NOW()
             WHERE userid = ? AND deleted_at IS NULL`,
            [userid]
        );

        if (role.toLowerCase() === 'admin') {
            const [firmManageResult] = await connection.query(
                `UPDATE manage_firm
             SET email = ?,deleted_at = ?
             WHERE user_id = ? AND deleted_at IS NULL`,
                [email, now, userid]
            );

            if (firmManageResult.affectedRows === 0) {
                throw new Error('Admin user not found or already deleted');
            }
        } else {
            const [userManageResult] = await connection.query(
                `UPDATE user_management
             SET email = ?,deleted_at = ?
             WHERE user_id = ? AND deleted_at IS NULL`,
                [email, now, userid]
            );

            if (userManageResult.affectedRows === 0) {
                throw new Error('User not found or already deleted');
            }
        }


        await connection.commit();

        return { userResult, bankResult };
    } catch (error) {
        await connection.rollback();
        throw new Error('Error soft deleting account and bank details: ' + error.message);
    } finally {
        connection.release();
    }
};

const addIfDeletedUser = async (userData) => {

    const { email, phone, password, role } = userData;
    try {
        const query = 'UPDATE users SET phone = ?, password = ?, role = ?, deleted_at = NULL WHERE email = ?';
        const [result] = await dbConn.query(query, [phone, password, role, email]);

        return result;
    } catch (error) {
        throw error;
    }
};

const getUserDetails = async (userid) => {
    try {
        let query = `SELECT * FROM user_management AS um INNER JOIN users AS u ON u.userid = um.user_id WHERE um.user_id = ? LIMIT 1`;

        const [rows] = await dbConn.query(query, [userid, 'granted']);
        return rows[0] || [];
    } catch (error) {
        throw new Error('Error fetching user details: ' + error.message);
    }
}

const getFirmDetails = async (userid) => {
    try {
        let query = `SELECT * FROM manage_firm AS mf INNER JOIN users AS u ON u.userid = mf.user_id WHERE mf.user_id = ? LIMIT 1`;

        const [rows] = await dbConn.query(query, [userid, 'granted']);
        return rows[0] || [];
    } catch (error) {
        throw new Error('Error fetching user getFirmDetails: ' + error.message);
    }
}

const checkUserAccess = async (userid) => {
    try {
        let query = `SELECT access FROM user_management WHERE user_id = ? LIMIT ?`;
        const value = [userid, 1];
        const [rows] = await dbConn.query(query, value);
        if (rows.length === 0) return false;
        return rows[0].access === 'granted';
    } catch (error) {
        throw new Error('Error fetching user details: ' + error.message);
    }
}

const checkAdminAccess = async (userid) => {
    try {
        let query = `SELECT access_status FROM manage_firm WHERE user_id = ? LIMIT ?`;
        const value = [userid, 1];
        const [rows] = await dbConn.query(query, value);
        if (rows.length === 0) return false;
        return rows[0].access_status === 'granted';
    } catch (error) {
        throw new Error('Error fetching user details: ' + error.message);
    }
}


const isUsrAccountExistDB = async (userid) => {
    try {
        let query = `select count(*) as count from users where userid = ? and deleted_at is null`;
        const [rows] = await dbConn.query(query, [userid]);
        return rows.length > 0 && rows[0].count > 0;
    } catch (error) {
        throw new Error('Error at isUsrAccountExistDB: ' + error.message);
    }
}

const getCreatedByUserRole = async (user_id) => {
    try {
        const query = `
            SELECT r.name 
            FROM users AS u 
            INNER JOIN role AS r ON r.id = u.role_id 
            WHERE u.userid = ? AND u.deleted_at IS NULL
        `;

        const [rows] = await dbConn.query(query, [user_id]);
        return rows.length > 0 ? rows[0].name : null;
    } catch (err) {
        throw new Error('Error at getCreatedByUserRole: ' + err.message);
    }
};


const getSuperAdminSelectedPlan = async (user_id) => {
    try {
        let query = `select * from manage_firm where user_id=? limit 1`;
        const [rows] = await dbConn.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        throw new Error('Error at getSuperAdminSelectedPlan: ' + err.message);
    }
}


module.exports = {
    findUserByEmail,
    createUser,
    updateUserOtp,
    clearUserOtp,
    updateUserPassword,
    getUserWithBankDetailsById,
    updateUserAndBankDetails,
    deleteAccount,
    addIfDeletedUser,
    getBankDetailsByUserId,
    addBankDetails,
    updateBankDetails,
    getUserDetails,
    updateUserLogin,
    updateUserDetails,
    checkUserAccess,
    updateUserProfileData,
    checkAdminAccess,
    isUsrAccountExistDB,
    getCreatedByUserRole,
    getSuperAdminSelectedPlan,
    updateFirmDetails,
    getFirmDetails,
};

const dbConn = require('../../../dbConfig');

// If Exist
const ifExistByEmail = async ({ email }) => {
    const query = 'SELECT * FROM manage_firm WHERE email = ?';
    try {
        const [rows] = await dbConn.query(query, [email]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    } catch (err) {
        throw new Error('Database error');
    }
};


const isEmailExist = async (email) => {
    try {
        const query = `SELECT COUNT(id) AS count FROM manage_firm WHERE email = ?`;
        const [rows] = await dbConn.query(query, [email]);

        // Check if count is greater than 0
        return rows[0].count > 0;
    } catch (err) {
        throw new Error('Database error: ' + err.message);
    }
};


// ➕ Add Firm
const addFirm = async ({ user_id, name, email, phone, subscription_type, password, sign_up_date }) => {

    const assign_role = 'admin';
    const access_status = 'granted';
    const suspend_status = 'active';

    const query = `INSERT INTO manage_firm 
        (user_id, name, email, phone, password, sign_up_date, assign_role, subscription_type, access_status, suspend_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [user_id, name, email, phone, password, sign_up_date, assign_role, subscription_type, access_status, suspend_status];


    const [result] = await dbConn.query(query, values);

    if (!result) {
        throw new Error('Database error');
    }

    return result.insertId;
};

// 🔁 Update Firm
const updateFirm = async (id, { name, email, phone, subscription_type }) => {

    const [rows] = await dbConn.query('SELECT sign_up_date, assign_role,access_status,suspend_status  FROM manage_firm WHERE id = ?', [id]);
    const sign_up_date = rows[0]?.sign_up_date;

    const [result] = await dbConn.query(
        `UPDATE manage_firm SET 
            name = ?, email = ?, phone = ?, sign_up_date = ?, assign_role = ?, 
            subscription_type = ?, access_status = ?, suspend_status = ?, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [name, email, phone, sign_up_date, rows[0]?.assign_role, subscription_type, rows[0]?.access_status, rows[0]?.suspend_status, id]
    );

    return result;


};

// 🔍 Get Firm by ID
const getFirmById = async () => {
    const [rows] = await dbConn.query(`SELECT mf.*, sp.name as plan_name FROM manage_firm as mf
    left join subscription_plan as sp on sp.id = mf.subscription_type
    where mf.deleted_at is null
    order by id desc`);
    return rows;
};

// ➖ Delete Firm by ID
const deleteFirm = async (id) => {
    const [result] = await dbConn.query('DELETE FROM manage_firm WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
        return false;
    }
    const deleteUser = await dbConn.query(`
        DELETE FROM users WHERE id = (SELECT user_id FROM manage_firm WHERE id = ? LIMIT 1)
        `, [id]);

    return deleteUser.affectedRows > 0;
};

// 🔒 Update Firm Access Status (granted/denied)
const updateFirmAccessStatus = async (id, access_status) => {
    if (access_status !== 'granted' && access_status !== 'denied') {
        throw new Error('Invalid access status. It should be "granted" or "denied".');
    }

    const [result] = await dbConn.query(
        `UPDATE manage_firm SET access_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [access_status, id]
    );

    // 🔍 Check if a row was actually updated
    if (result.affectedRows === 0) {
        return null;
    }

    return { message: `Access status updated to ${access_status}` };
};

// ⏸️ Update Suspend Status
const updateFirmSuspendStatus = async (id, suspend_status) => {
    if (suspend_status !== 'active' && suspend_status !== 'inactive') {
        throw new Error('Invalid suspend status. It should be "active" or "inactive".');
    }

    const [result] = await dbConn.query(
        `UPDATE manage_firm SET suspend_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [suspend_status, id]
    );

    if (result.affectedRows === 0) {
        return null;
    }

    return { message: `Suspend status updated to ${suspend_status}` };
};

// ➕ Add Notification
const addNotification = async (message, notification_for = 'superadmin', type = 'other', title = '', adminId = 0) => {
    const [result] = await dbConn.query(
        'INSERT INTO admin_notification (title, message, type, notification_for, adminId) VALUES (?, ?, ?, ?, ?)',
        [title, message, type, notification_for, adminId]
    );
    return { id: result.insertId };
};

// 📥 Get all notifications
const getAllNotifications = async (notification_for = 'superadmin', adminId) => {
    const [rows] = await dbConn.query(
        `SELECT id, title, message, type, is_read, created_at
   FROM admin_notification
   WHERE notification_for = ? AND adminId = ?
   ORDER BY created_at DESC`,
        [notification_for, adminId] // ✅ pass both parameters
    );
    return rows;

};

// ✅ Mark notification as read
const markNotificationAsRead = async (notification_id) => {
    const [result] = await dbConn.query(
        `UPDATE admin_notification SET is_read = 1 WHERE id = ?`,
        [notification_id]
    );
    return result;
};


/**
 * Checkng notification is exist or not
 * @param {*} id 
 * @returns 
 */
const isNotificationExist = async (id) => {
    try {
        // building query
        const query = `SELECT id FROM admin_notification WHERE id = ?`;

        const values = [id];
        // doing update in db
        const [rows] = await dbConn.query(query, values);
        // returning
        return rows.length > 0;
    } catch (err) {
        throw new Error('Database error at isNotificationExist');
    }
}

const updateSubscriptionType = async (user_id, subscription_type) => {
    try {
        const query = `UPDATE manage_firm SET subscription_type = ? WHERE user_id = ?`;
        const values = [subscription_type, user_id];
        const [rows] = await dbConn.query(query, values);
        return rows.affectedRows > 0;
    } catch (err) {
        throw new Error('Database error at updateSubscriptionType: ' + err.message);
    }
}


const getFirmRoleDB = async (req, res) => {
    try {
        // building query to get admin role id
        const [rows] = await dbConn.query(`select * from role where name in ('admin','ADMIN','Admin') and deleted_at is null order by id desc limit 1`);
        return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
        throw new Error('Database error at getFirmRoleDB: ' + error.message);
    }
}

const getFirmDetailsById = async (id) => {
    try {
        const query = `SELECT * FROM manage_firm WHERE id = ?`;
        const [rows] = await dbConn.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        throw new Error('Database error at getFirmDetailsById: ' + err.message);
    }
}

const updateUserFirmDB = async (user_id, updateData) => {
    try {
        let query = `UPDATE users SET ? WHERE userid = ?`;
        const [rows] = await dbConn.query(query, [updateData, user_id]);
        return rows.affectedRows > 0;
    } catch (error) {
        throw new Error('Database error at updateUserFirm: ' + error.message);
    }
}


module.exports = {
    addFirm,
    updateFirm,
    getFirmById,
    deleteFirm,
    updateFirmAccessStatus,
    updateFirmSuspendStatus,
    addNotification,
    getAllNotifications,
    markNotificationAsRead,
    ifExistByEmail,
    isNotificationExist,
    isEmailExist,
    updateSubscriptionType,
    getFirmRoleDB,
    getFirmDetailsById,
    updateUserFirmDB,
};

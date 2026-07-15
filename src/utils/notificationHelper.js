const dbConn = require('../../dbConfig');

const sendAdminNotification = async ({ title, message, type = 'other', user_id }) => {
    try {
        await dbConn.query(
            `INSERT INTO admin_notification (title, message, type, adminId)
             VALUES (?, ?, ?, ?)`,
            [title, message, type, user_id]
        );
    } catch (error) {
        console.error('Error sending admin notification:', error.message);
    }
};


/**
 * Adds a notification to the admin notification table
 * @param {string} title - The title of the notification
 * @param {string} message - The message of the notification
 * @param {string} type - The type of the notification (default: 'other')
 * @param {string} notification_for - The notification for which user ('superadmin', 'admin', or 'user') (default: 'superadmin')
 * @param {number} user_id - The ID of the user to which the notification belongs
 * @returns {Promise<boolean>} - A promise that resolves to true if the notification was added successfully
 */
const addNotification = async (title, message, type = 'other', notification_for = 'superadmin', user_id) => {
    try {
        console.log('Adding notification:', { title, message, type, notification_for, user_id });
        let query = 'insert into admin_notification set ?';
        const [rows] = await dbConn.query(query, { title, message, type, notification_for, adminId: user_id });
        return rows.affectedRows > 0;
    } catch (error) {
        console.error('Error sending admin notification:', error.message);
        return false;
    }
}

module.exports = {
    sendAdminNotification,
    addNotification
};

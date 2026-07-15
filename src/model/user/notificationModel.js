const dbConn = require("../../../dbConfig");

const getNotificationsDB = async (user_id) => {
  try {
    let query = `select an.* from admin_notification as an 
              where an.notification_for = ? and an.adminId = ? 
              order by an.created_at desc`;
    const values = ['user', user_id];

    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (error) {
    throw new Error("Database error at getNotificationsDB: " + error.message);
  }
}

module.exports = {
  getNotificationsDB
}
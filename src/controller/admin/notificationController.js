const { getAllNotifications } = require("../../model/superAdmin/manageFirmModel");

/**
 * to fetch admin notifications
 * @param {*} req 
 * @param {*} res 
 */
const fetchAdminNotifications = async (req, res) => {
  try {
    const adminId = req?.user?.userid;

    // fetching notification from db
    const notifications = await getAllNotifications('admin', adminId);

    res.status(200).json({
      status: 200,
      success: true,
      message: "Notifications fetched successfully",
      data: notifications
    })
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
}


module.exports = {
  fetchAdminNotifications
}
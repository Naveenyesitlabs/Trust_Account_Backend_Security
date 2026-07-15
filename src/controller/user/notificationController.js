const { getAdminId } = require("../../model/admin/userManagementModel");
const { getNotificationsDB } = require("../../model/user/notificationModel");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");

const getUserNotificationController = async (req, res) => {
  try {
    const userId = req?.user?.userid;
    console.log("User ID:", userId);
    // const adminId = await getAdminId(userId);
    const notifications = await getNotificationsDB(userId);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Notifications fetched successfully", notifications);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  getUserNotificationController,
}
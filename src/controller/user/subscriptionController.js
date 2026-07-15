const { getSubscriptionsDb, getSubscriptionByIdDB, getUaserActiveSubscription } = require("../../model/user/subscriptionModel");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");



/**
 * Retrieves all available subscription plans from the database.
 *
 * This function fetches all available subscription plans from the database and
 * returns them in the response.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 *
 * @returns {void} - Sends a response indicating success or failure of fetching subscriptions.
 * @throws {Error} - If an error occurs during fetching subscriptions, logs the error and sends an internal server error response.
 */
const getSubscriptionController = async (req, res) => {
  try {
    const result = await getSubscriptionsDb();
    return respond(res, true, HTTP_STATUS_CODE.OK, "Subscriptions fetched successfully", result);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


const addSubscriptionController = async (user_id, plan_id) => {
  try {
    const plan = await getSubscriptionByIdDB(plan_id);
    if (!plan) return false;
    const subscription_db_data = {
      user_id,
      plan_id,
      start_date: new Date(),
      is_active: true,
      stripe_subscription_id: null,
      stripe_customer_id: null
    };

  } catch (error) {
    return false;
  }
}


const updateSubscriptionController = async (req, res) => {
  try {

  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


const getUserSubscriptionController = async (req, res) => {
  try {
    const userId = req.user?.userid;
    const subscription = await getUaserActiveSubscription(userId);
    if (!subscription) return res.status(HTTP_STATUS_CODE.OK).json({ success: true, status: HTTP_STATUS_CODE.OK, message: "No active subscription found", data: {} });
    if (subscription.length === 0) return res.status(HTTP_STATUS_CODE.OK).json({ success: true, status: HTTP_STATUS_CODE.OK, message: "No active subscription found", data: {} });
    return res.status(HTTP_STATUS_CODE.OK).json({ success: true, status: HTTP_STATUS_CODE.OK, message: "Active subscription found", data: subscription });
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  getSubscriptionController,
  updateSubscriptionController,
  addSubscriptionController,
  getUserSubscriptionController,
}
const dbConn = require("../../../dbConfig");


/**
 * Retrieves all available subscription plans from the database, including their
 * associated features.
 *
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each
 *   containing the details of a subscription plan and its associated features.
 * @throws {Error} - Throws an error if there is a database error during the retrieval
 *   process.
 */
const getSubscriptionsDb = async () => {
  try {
    // Define the query
    let query = `
      SELECT 
  sp.*, 
  (
    SELECT CONCAT('[', GROUP_CONCAT(QUOTE(sf.feature)), ']')
    FROM subscription_features AS sf
    WHERE sf.plan_id = sp.id
  ) AS features
FROM subscription_plan AS sp;

    `;

    // Execute the query
    const [rows] = await dbConn.query(query);

    // Return the rows or an empty array if no data is found
    return rows || [];
  } catch (error) {

    // Rethrow a custom error for the caller to handle
    throw new Error("Database error at getSubscriptionsDb: " + error.message);
  }
}


/**
 * Retrieves a subscription plan from the database by its ID.
 * 
 * @param {number} plan_id - The ID of the subscription plan to retrieve.
 * @returns {Promise<Object>} - A promise that resolves to the subscription plan object, or an empty object if
 *   the plan does not exist or is inactive.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getSubscriptionByIdDB = async (plan_id) => {
  try {
    // building the query
    let query = `select id, stripe_product_id, name, price, stripe_price_id, duration, currency 
    from subscription_plan where id = ? and is_active = ?`;
    const values = [plan_id, true];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getSubscriptionsDb: " + error.message);
  }
}


/**
 * Retrieves the Stripe customer ID associated with a given user ID from the database.
 * 
 * @param {number} user_id - The ID of the user whose Stripe customer ID is to be retrieved.
 * @returns {Promise<string>} - A promise that resolves to the Stripe customer ID string, or
 *   an empty string if the user does not have a Stripe customer ID.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getUserDataDB = async (user_id) => {
  try {
    let query = `select * from users where userid = ?`;
    const values = [user_id];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getUserDataDB: " + error.message);
  }
}


/**
 * Updates the Stripe customer ID for a user in the database.
 * 
 * @param {number} user_id - The ID of the user whose Stripe customer ID is to be updated.
 * @param {string} stripe_customer_id - The new Stripe customer ID to be associated with the user.
 * @returns {Promise<boolean>} - A promise that resolves to true if the update was successful, otherwise false.
 * @throws {Error} - Throws an error if there is a database error during the update process.
 */

const updateUserCustomerDB = async (user_id, stripe_customer_id) => {
  try {
    let query = `update users set stripe_customer_id = ? where userid = ?`;
    const values = [stripe_customer_id, user_id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateUserCustomerDB: " + error.message);
  }
}


/**
 * Retrieves the ID of the user associated with a given Stripe customer ID from the database.
 * 
 * @param {string} stripeCustomerId - The Stripe customer ID to retrieve the user ID for.
 * @returns {Promise<number>} - A promise that resolves to the ID of the user associated with the given Stripe customer ID, or
 *   an empty array if no such user exists.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getUserByStripeCustomerId = async (stripeCustomerId) => {
  try {
    let query = `SELECT userid FROM users WHERE stripe_customer_id = ?`;
    const values = [stripeCustomerId];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getUserByStripeCustomerId: " + error.message);
  }
};


/**
 * Retrieves a subscription plan from the database by its associated Stripe product ID.
 * 
 * @param {string} stripe_product_id - The Stripe product ID to retrieve the plan for.
 * @returns {Promise<Object>} - A promise that resolves to the subscription plan object, or an empty array if
 *   the plan does not exist or is inactive.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getPlanByProductIdDB = async (stripe_price_id) => {
  try {
    let query = `select * from subscription_plan where stripe_price_id = ?`;
    const values = [stripe_price_id];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getPlanByProductIdDB: " + error.message);
  }
}


/**
 * Saves a user's subscription data in the database.
 *
 * @param {Object} subscriptionData - An object containing the subscription data to be inserted into the database.
 * @returns {Promise<boolean>} - A promise that resolves to true if the subscription data was successfully saved, otherwise false.
 * @throws {Error} - Throws an error if there is a database error during the insertion process.
 */
const saveUserSubscriptionDB = async (subscriptionData) => {
  if (!subscriptionData) {
    throw new Error("Subscription data is required");
  }

  try {
    const query = `INSERT INTO subscriptions SET ?`;
    const [result] = await dbConn.query(query, subscriptionData);

    if (result.affectedRows > 0) {
      return result.insertId; // Return the new ID
    }
    return null; // No rows were inserted
  } catch (error) {
    // Include the original error in the stack trace
    throw new Error(`Database error at saveUserSubscriptionDB: ${error.message}`);
  }
};


/**
 * Saves a payment transaction for a user's subscription in the database.
 *
 * @param {Object} paymentData - An object containing the payment data to be inserted into the database.
 * @returns {Promise<number>} - A promise that resolves to the ID of the newly inserted transaction, or null if no rows were inserted.
 * @throws {Error} - Throws an error if there is a database error during the insertion process.
 */
const saveSubscriptionPaymentDB = async (paymentData) => {
  if (!paymentData) {
    throw new Error("Transactions data is required");
  }

  try {
    const query = `INSERT INTO transactions SET ?`;
    const [result] = await dbConn.query(query, paymentData);

    if (result.affectedRows > 0) {
      return result.insertId; // Return the new ID
    }
    return null; // No rows were inserted
  } catch (error) {
    // Include the original error in the stack trace
    throw new Error(`Database error at saveSubscriptionPaymentDB: ${error.message}`);
  }
};


const getSubscriptionByStripeIdDB = async (stripe_subscription_id) => {
  try {
    let query = `select * from subscriptions where stripe_subscription_id = ?`;
    const values = [stripe_subscription_id];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getSubscriptionByStripeIdDB: " + error.message);
  }
}


const updateSubscriptionEndDateDB = async (id, end_date) => {
  try {
    let query = `update subscriptions set end_date = ? where id = ?`;
    const values = [end_date, id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateSubscriptionEndDateDB: " + error.message);
  }
};


const updateSubscriptionStatusDB = async (id, status) => {
  try {
    let query = `update subscriptions set status = ? where id = ?`;
    const values = [status, id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateSubscriptionStatusDB: " + error.message);
  }
}


const updateSubscriptionDB = async (id, subscriptionData) => {
  try {
    let query = `update subscriptions set ? where id = ?`;
    const values = [subscriptionData, id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateSubscriptionDB: " + error.message);
  }
}


const updateInvoiceIdByPaymentMethodIdDB = async (stripe_payment_method_id, stripe_invoice_id) => {
  try {
    let query = `update transactions set stripe_invoice_id = ? where stripe_payment_method_id = ?`;
    const values = [stripe_invoice_id, stripe_payment_method_id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateSubscriptionDB: " + error.message);
  }
}


const getTransactionByStripeInvoiceIdDB = async (stripe_invoice_id) => {
  try {
    let query = `select * from transactions where stripe_invoice_id = ?`;
    const values = [stripe_invoice_id];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getTransactionByStripeInvoiceIdDB: " + error.message);
  }
}

const updateTransactionDB = async (id, transactionData) => {
  try {
    let query = `update transactions set ? where id = ?`;
    const values = [transactionData, id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateTransactionDB: " + error.message);
  }
}


const getUaserActiveSubscription = async (user_id) => {
  try {
    let query = `select 
                      s.id as subscription_id, 
                      s.plan_id, 
                      s.stripe_subscription_id, 
                      s.start_date, 
                      s.end_date, 
                      s.created_at, 
                      s.status as is_subscription_active, 
                      t.stripe_invoice_url,
                      t.stripe_invoice_pdf, 
                      t.stripe_payment_id, 
                      sp.name as plan_name 
                  from 
                      subscriptions as s 
                  inner join 
                      transactions as t on t.subscription_id = s.id 
                  inner join 
                      subscription_plan as sp on sp.id = s.plan_id 
                  where 
                      t.transaction_type = ? 
                      and t.status = ? 
                      and s.status = ? 
                      and s.end_date >= DATE(NOW()) 
                      and s.user_id = ?
                  order by 
                      s.created_at desc 
                  limit ?`;


    const values = ["subscription", "paid", "active", user_id, 1];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0] : [];
  } catch (error) {
    throw new Error("Database error at getUaserActiveSubscription: " + error.message);
  }
}


module.exports = {
  getSubscriptionsDb,
  getSubscriptionByIdDB,
  getUserDataDB,
  updateUserCustomerDB,
  getUserByStripeCustomerId,
  saveUserSubscriptionDB,
  getPlanByProductIdDB,
  saveSubscriptionPaymentDB,
  getSubscriptionByStripeIdDB,
  updateSubscriptionEndDateDB,
  updateSubscriptionStatusDB,
  updateSubscriptionDB,
  updateInvoiceIdByPaymentMethodIdDB,
  getTransactionByStripeInvoiceIdDB,
  updateTransactionDB,
  getUaserActiveSubscription,
};
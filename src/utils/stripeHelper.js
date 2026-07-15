const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a new Stripe customer using the provided user information.
 *
 * @param {string} user_id - The unique identifier of the user.
 * @param {string} name - The name of the user.
 * @param {string} email - The email address of the user.
 * @returns {Promise<string>} - A promise that resolves to the newly created Stripe customer ID.
 * @throws {Error} - Throws an error if there is an issue during the Stripe customer creation process.
 */

const createStripeCustomer = async (user_id, name, email) => {
  try {
    const customer = await stripe.customers.create({
      name: name,
      email: email,
      metadata: {
        user_id: user_id
      }
    });
    if (customer) {
      return customer.id;
    }
  } catch (error) {
    throw new error("Helper error at createStripeCustomer: " + error.message);
  }
}


/**
 * Creates a new Stripe subscription for the given customer and price.
 *
 * @param {string} customer_id - The Stripe customer ID to create the subscription for.
 * @param {string} price_id - The Stripe price ID to use for the subscription.
 * @returns {Promise<Stripe.Subscription>} - A promise that resolves to the newly created Stripe subscription.
 * @throws {Error} - Throws an error if there is an issue during the Stripe subscription creation process.
 */
const createStripeSubscription = async (customer_id, price_id) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customer_id,
      items: [
        {
          price: price_id,
        },
      ],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });
    return subscription;
  } catch (error) {
    throw new error("Helper error at createStripeSubscription: " + error.message);
  }
}


const getPaymentIdFromSubscription = async (subscriptionId) => {
  try {
    // Step 1: Retrieve the subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Step 2: Get the latest invoice
    const invoiceId = subscription.latest_invoice;
    if (!invoiceId) {
      throw new Error('No invoice found for this subscription.');
    }

    const invoice = await stripe.invoices.retrieve(invoiceId);

    // Step 3: Get the Payment Intent (payment ID)
    const paymentIntentId = invoice.payment_intent;
    if (!paymentIntentId) {
      throw new Error('No payment intent found for this invoice.');
    }

    // Optional Step 4: Retrieve payment intent to get more details
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Optional Step 5: If you want charge_id
    const chargeId = paymentIntent.charges.data[0]?.id;

    return {
      invoice_id: invoiceId,
      payment_intent_id: paymentIntentId,
      charge_id: chargeId
    };
  } catch (error) {
    throw error;
  }
};



const getPaymentIntentByInvoiceId = async (invoiceId) => {
  try {
    // Step 1: Retrieve the invoice
    const invoice = await stripe.invoices.retrieve(invoiceId);

    // Step 2: Get the payment_intent ID
    const paymentIntentId = invoice.payment_intent;

    if (!paymentIntentId) {
      return null;
    }

    // Step 3: Retrieve the Payment Intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return paymentIntent;
  } catch (error) {
    throw error;
  }
};


module.exports = {
  createStripeCustomer,
  createStripeSubscription,
  getPaymentIdFromSubscription,
  getPaymentIntentByInvoiceId
}
const { updateSubscriptionType } = require('../../model/superAdmin/manageFirmModel');
const { getSubscriptionByIdDB, getUserDataDB, updateUserCustomerDB, getUserByStripeCustomerId, getPlanByProductIdDB, saveUserSubscriptionDB, saveSubscriptionPaymentDB, getSubscriptionByStripeIdDB, updateSubscriptionEndDateDB, updateSubscriptionStatusDB, updateSubscriptionDB, updateInvoiceIdByPaymentMethodIdDB, getTransactionByStripeInvoiceIdDB, updateTransactionDB } = require('../../model/user/subscriptionModel');
const { logToFile } = require('../../utils/logger');
const { addNotification } = require('../../utils/notificationHelper');
const { respond, HTTP_STATUS_CODE, getCaliforniaDateTime } = require('../../utils/reponseHelper');
const { createStripeCustomer, getPaymentIdFromSubscription, getPaymentIntentByInvoiceId } = require('../../utils/stripeHelper');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// const endpointSecret = 'whsec_e6479f52e123a434fc234f51fe676e47b2a1d7c2d3ff44d28a22b9b4b99da664'; // Use your real webhook secret
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Use your real webhook secret


/**
 * Creates a new Stripe checkout session for the given user and subscription plan.
 *
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} - Throws an error if there is a problem creating the Stripe checkout session.
 */
const createCheckoutSession = async (req, res) => {
    try {
        const { user_id, plan_id } = req.body;
        const subbscriptionPlan = await getSubscriptionByIdDB(plan_id);

        if (!subbscriptionPlan || !subbscriptionPlan.stripe_price_id) {
            return res.status(400).json({ error: 'Invalid subscription plan' });
        }

        // Get user data
        const customer = await getUserDataDB(user_id);

        let stripe_customer_id = null;
        if (!customer || customer.length <= 0) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "User not found");
        }

        if (customer.stripe_customer_id) {
            stripe_customer_id = customer.stripe_customer_id;
        } else {
            stripe_customer_id = await createStripeCustomer(user_id, customer.name, customer.email);

            if (!stripe_customer_id) {
                return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Stripe customer id not found");
            }

            const updated = await updateUserCustomerDB(user_id, stripe_customer_id);
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: stripe_customer_id, // Link session to a specific Stripe customer
            payment_method_types: ['card'],
            line_items: [
                {
                    price: subbscriptionPlan.stripe_price_id,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });


        return respond(res, true, HTTP_STATUS_CODE.OK, "Checkout session created successfully", {
            checkoutUrl: session.url
        });

    } catch (err) {
        return respond(
            res,
            false,
            HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
            "Stripe session creation failed: " + (err.message || "Unknown error")
        );
    }
};


/**
 * Handles incoming Stripe webhook events.
 *
 * This function is responsible for receiving and processing Stripe webhook events.
 * It verifies the event signature to ensure that it is from Stripe, logs the event,
 * and performs actions based on the event type, such as processing subscription 
 * completions, updates, deletions, and handling payment failures.
 *
 * @param {Object} req - The request object containing the incoming event.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 *
 * @returns {void} - Sends a response indicating the success or failure of processing the webhook.
 *
 * @throws {Error} - If signature verification fails or if an error occurs during event processing,
 * logs the error and sends an appropriate HTTP response.
 */
const stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    } catch (err) {

        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;
            case 'charge.succeeded':
                await handleChargeSucceeded(event.data.object);
                break;
            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
        }

        res.json({ received: true });
    } catch (err) {
        res.status(500).send('Webhook processing failed.');
    }
};

/**
 * Handles the successful charge event from Stripe.
 *
 * This function processes the charge.succeeded event received from Stripe's webhook.
 * It extracts relevant transaction details from the charge object, constructs a 
 * transaction data object, and saves it to the database.
 *
 * @param {Object} charge - The charge object received from Stripe, containing details 
 *                          about the payment transaction.
 *
 * @throws {Error} Logs an error and sends a 500 response if an error occurs during
 *                 the transaction data processing or database saving.
 */
async function handleChargeSucceeded(charge) {
    try {
        const transactionData = {
            stripe_charge_id: charge.id,
            stripe_payment_id: charge.payment_intent,
            stripe_payment_method_id: charge.payment_method,
            total_amount: (charge.amount / 100),//.toFixed(2),
            transaction_type: 'subscription',
            payment_method: 'Stripe',
            status: 'paid',
            paid_at: new Date(charge.created * 1000),
            created_at: new Date(),
        }

        await saveSubscriptionPaymentDB(transactionData);
    } catch (err) {

        res.status(500).send('Webhook processing failed.');
    }
}

/**
 * Calculates the end date of a subscription based on its start date and plan interval.
 *
 * This function takes a subscription object, extracts its start date and plan interval details,
 * and calculates the end date based on the plan interval. It supports day, week, month and year
 * intervals, and throws an error if an unsupported interval is encountered.
 *
 * @param {Object} subscription - The subscription object containing start date and plan interval details.
 *
 * @returns {Object} - An object containing the start date and calculated end date.
 *
 * @throws {Error} - If the plan interval is unsupported.
 */
const calculateEndDate = (subscription) => {
    try {
        const start_date = new Date(subscription.start_date * 1000);
        let end_date = new Date(start_date); // Clone start_date

        const count = subscription.plan.interval_count;
        const interval = subscription.plan.interval;

        switch (interval) {
            case 'day':
                end_date.setDate(end_date.getDate() + count);
                break;
            case 'week':
                end_date.setDate(end_date.getDate() + (count * 7));
                break;
            case 'month':
                end_date.setMonth(end_date.getMonth() + count);
                break;
            case 'year':
                end_date.setFullYear(end_date.getFullYear() + count);
                break;
            default:
                throw new Error(`Unsupported interval type: ${interval}`);
        }

        return { start_date, end_date };

    } catch (err) {
        throw err;
    }
}

/**
 * Retrieves a Stripe invoice and returns its hosted invoice URL and PDF URL.
 *
 * @param {string} invoiceId - The ID of the Stripe invoice to retrieve.
 *
 * @returns {Object} - An object containing the hosted invoice URL and PDF URL.
 *
 * @throws {Error} - If there is an error retrieving the invoice.
 */
const getInvoiceLinks = async (invoiceId) => {
    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);

        return {
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf
        };
    } catch (err) {
        throw err;
    }
};


/**
 * Handles a Stripe checkout session completed event.
 *
 * @param {object} session - The Stripe CheckoutSession object.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} - If there is an error during the processing of the event, logs the
 * error and sends an appropriate HTTP response.
 */
async function handleCheckoutSessionCompleted(session) {
    // Retrieve the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const stripe_invoice_id = session.invoice;
    // Get the customer and plan details
    const customerId = session.customer;
    const priceId = subscription.items.data[0].price.id;

    // Get user from your DB using customerId
    const user = await getUserByStripeCustomerId(customerId);
    if (!user) {
        return;
    }

    // Get plan from your DB using priceId
    const plan = await getPlanByProductIdDB(priceId);
    if (!plan) {
        return;
    }
    const invoiceLinks = await getInvoiceLinks(stripe_invoice_id);
    const { start_date, end_date } = calculateEndDate(subscription); //{start_date,end_date}
    // Create subscription record
    const subscriptionData = {
        user_id: user.userid,
        plan_id: plan.id,
        stripe_subscription_id: subscription.id,
        stripe_invoice_url: invoiceLinks.hosted_invoice_url,
        stripe_invoice_pdf: invoiceLinks.invoice_pdf,
        stripe_price_id: priceId,
        total_amount: (subscription.items.data[0].price.unit_amount / 100),//.toFixed(2),
        start_date,
        end_date,
        status: subscription.status,
        created_at: new Date(),
    };
    const newSubscription = await saveUserSubscriptionDB(subscriptionData);
    if (!newSubscription) {
        return;
    }
    // Create initial transaction record
    const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
    const transaction = await getTransactionByStripeInvoiceIdDB(stripe_invoice_id);


    const transactionData = {
        subscription_id: newSubscription,
        stripe_invoice_id,
        stripe_invoice_url: invoiceLinks.hosted_invoice_url,
        stripe_invoice_pdf: invoiceLinks.invoice_pdf,
        status: 'paid',
        paid_at: new Date(invoice.status_transitions.paid_at * 1000),
        created_at: new Date(),
    };
    await updateTransactionDB(transaction.id, transactionData);

    // getting subscription plan name
    const subscriptionPlan = await getSubscriptionByIdDB(plan.id);
    if (subscriptionPlan) {
        await updateSubscriptionType(user.userid, plan.id);
    }

    //title, message, type = 'other', notification_for = 'superadmin', user_id
    addNotification(`New Subscription.`, 'You have a new subscription.', 'subscription');
}


/**
 * Handles the Stripe invoice paid event by updating the subscription end date
 * and recording the payment transaction.
 *
 * This function retrieves the subscription associated with the given invoice
 * from the database, updates the subscription's end date based on the invoice
 * period end, and creates a transaction record for the recurring payment.
 *
 * @param {Object} invoice - The Stripe invoice object containing details of the payment.
 *
 * @returns {Promise<void>} - A promise that resolves once the subscription end date is updated
 * and the payment transaction is recorded.
 *
 * @throws {Error} - If the subscription is not found in the database or if there is an error
 * updating the subscription end date or recording the transaction.
 */
async function handleInvoicePaid(invoice) {
    // Get subscription from your DB
    const subscription = await getSubscriptionByStripeIdDB(invoice.parent.subscription_details.subscription);
    if (!subscription) {
        return;
    }

    // Update subscription end date
    const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);
    await updateSubscriptionEndDateDB(subscription.id, periodEnd);


}


/**
 * Handles a Stripe invoice payment failed event.
 *
 * @param {Object} invoice - The Stripe invoice object containing details of the payment.
 *
 * @returns {Promise<void>} - A promise that resolves once the subscription status is updated
 * and the failed transaction is recorded.
 *
 * @throws {Error} - If the subscription is not found in the database or if there is an error
 * updating the subscription status or recording the transaction.
 */
async function handleInvoicePaymentFailed(invoice) {
    const subscription = await getSubscriptionByStripeIdDB(invoice.subscription);
    if (!subscription) return;

    // Update subscription status
    await updateSubscriptionStatusDB(subscription.id, 'pending');

    // Create failed transaction record
    const transactionData = {
        subscription_id: subscription.id,
        total_amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        transaction_type: 'subscription',
        payment_method: 'Stripe',
        stripe_invoice_id: invoice.id,
        status: 'failed',
        created_at: new Date(),
    };
    await saveSubscriptionPaymentDB(transactionData);
}


/**
 * Handles the Stripe subscription updated event.
 *
 * This function updates the subscription record in the database
 * with the latest status and end date from the Stripe subscription
 * object. If the subscription is being cancelled at the end of the
 * period, it also sets the cancelled_at timestamp.
 *
 * @param {Object} subscription - The Stripe subscription object
 * containing the latest status and end date.
 *
 * @returns {Promise<void>} - A promise that resolves once the
 * subscription record is updated.
 *
 * @throws {Error} - If the subscription is not found in the
 * database or if there is an error updating the subscription
 * record.
 */
async function handleSubscriptionUpdated(subscription) {
    const sub = await getSubscriptionByStripeIdDB(subscription.id);
    if (!sub) return;

    const updateData = {
        status: subscription.status,
        end_date: new Date(subscription.current_period_end * 1000),
        updated_at: new Date()
    };

    if (subscription.cancel_at_period_end) {
        updateData.cancelled_at = new Date();
    }

    await updateSubscriptionDB(sub.id, updateData);
}


/**
 * Handles the Stripe subscription deleted event by updating the subscription status
 * to 'canceled' and setting the cancelled_at timestamp to the current time.
 *
 * @param {Object} subscription - The Stripe subscription object containing the
 * deleted subscription details.
 *
 * @returns {Promise<void>} - A promise that resolves once the subscription record
 * is updated.
 *
 * @throws {Error} - If the subscription is not found in the database or if there
 * is an error updating the subscription record.
 */
async function handleSubscriptionDeleted(subscription) {
    const sub = await getSubscriptionByStripeIdDB(subscription.id);
    if (!sub) return;

    await updateSubscriptionDB(sub.id, {
        status: 'canceled',
        cancelled_at: new Date(),
        updated_at: new Date()
    });
}



/**
 * Handles the Stripe subscription created event by updating the
 * invoice_id for the payment method in the database.
 *
 * @param {Object} subscription - The Stripe subscription object
 * containing the default payment method and the latest invoice.
 *
 * @returns {Promise<void>} - A promise that resolves once the
 * payment method record is updated.
 *
 * @throws {Error} - If there is an error updating the payment
 * method record.
 */
async function handleSubscriptionCreated(subscription) {
    try {
        const stripe_payment_method_id = subscription.default_payment_method;
        const stripe_invoice_id = subscription.latest_invoice;

        await updateInvoiceIdByPaymentMethodIdDB(stripe_payment_method_id, stripe_invoice_id);
    } catch (err) {
        throw err;
    }
}


module.exports = {
    createCheckoutSession,
    stripeWebhook,
}

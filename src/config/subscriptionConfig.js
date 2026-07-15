const dbConn = require('../../dbConfig');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * SUBSCRIPTION_PLAN
 * An array of default subscription plans to be inserted into the database.
 */
const SUBSCRIPTION_PLAN = [
  {
    name: "Basic",
    subscription_features: [
      'Includes core features such as client trust account management, reconciliations, and basic reporting.',
      'Includes core features such as client trust account management, reconciliations, and basic reporting.',
    ],
    amount: 100,
    currency: "usd",
    duration: 'month',
    display_order: 0,
    is_featured: false,
  },
  {
    name: "Premium",
    subscription_features: [
      'Includes advanced features like automated notifications, integration with other law practice management software, enhanced security features, and more comprehensive reporting and analytics.',
    ],
    amount: 299,
    currency: "usd",
    duration: 'month',
    display_order: 1,
    is_featured: true,
  }
]



/**
 * INIT_SUBSCRIPTION_PLAN
 * Inserts default subscription plans into the database if they do not already exist.
 * This function is executed during application startup.
 */
const INIT_SUBSCRIPTION_PLAN = async () => {
  try {
    // Building query to check how many plans currently exist in the database
    let query = 'select count(*) as count from subscription_plan';
    const [rows] = await dbConn.query(query);

    // If there are no plans or fewer than the defined SUBSCRIPTION_PLAN array length, insert missing plans
    if (rows.length > 0 && (rows[0].count <= 0 || rows[0].count < SUBSCRIPTION_PLAN.length)) {
      console.log('There is no default subscription plan...');
      console.log('Inserting default subscription plan...');

      // Fetch existing plans for comparison
      let fetchQuery = 'select * from subscription_plan';
      const [existing_plans] = await dbConn.query(fetchQuery);

      // Loop through all default subscription plans
      for (let i = 0; i < SUBSCRIPTION_PLAN.length; i++) {
        console.log(`Inserting ${SUBSCRIPTION_PLAN[i].name} plan...`);

        // Skip plan if it already exists in the database
        if (existing_plans.length > 0 && existing_plans.find(plan => plan.name === SUBSCRIPTION_PLAN[i].name)) {
          console.log(`${SUBSCRIPTION_PLAN[i].name} plan already exists...`);
          console.log(`Skipping ${SUBSCRIPTION_PLAN[i].name} plan...`);
          continue;
        }

        // Prepare data for subscription_plan table
        const plan_db_data = {
          name: SUBSCRIPTION_PLAN[i].name,
          price: SUBSCRIPTION_PLAN[i].amount,
          currency: SUBSCRIPTION_PLAN[i].currency,
          duration: SUBSCRIPTION_PLAN[i].duration,
          display_order: SUBSCRIPTION_PLAN[i].display_order,
          is_featured: SUBSCRIPTION_PLAN[i].is_featured
        }

        // Create a new Stripe Price & Product
        const price = await stripe.prices.create({
          currency: SUBSCRIPTION_PLAN[i].currency,
          unit_amount: Number(SUBSCRIPTION_PLAN[i].amount) * 100, // Convert amount to cents
          recurring: {
            interval: SUBSCRIPTION_PLAN[i].duration,
          },
          product_data: {
            name: SUBSCRIPTION_PLAN[i].name,
          },
        });

        // Save Stripe product and price IDs in DB data if creation was successful
        if (price && price.id) {
          plan_db_data['stripe_price_id'] = price.id;
          plan_db_data['stripe_product_id'] = price.product;
        }

        // Insert new subscription plan into the database
        let query = `insert into subscription_plan set ?`;
        const [result] = await dbConn.query(query, [plan_db_data]);

        // If plan insertion was successful, insert its features
        if (result.affectedRows > 0) {
          const plan_id = result.insertId;
          const featureInsertQuery = `insert into subscription_features set ?`;

          // Insert each feature belonging to the subscription plan
          for (const feature of SUBSCRIPTION_PLAN[i].subscription_features) {
            const subscription_features_db_data = { plan_id, feature };
            await dbConn.query(featureInsertQuery, [subscription_features_db_data]);
          }

          console.log(`${SUBSCRIPTION_PLAN[i].name} subscription plan inserted successfully...`);
        }
      }
      console.log('Default subscription plan inserted successfully...');
    } else {
      // Plans already exist, so no insertion is needed
      console.log('Default subscription plan already exists...');
    }
  } catch (error) {
    // Log any errors that occur during execution
    console.error("Error inserting default subscription plan: ", error);
  }
}


module.exports = {
  SUBSCRIPTION_PLAN,
  INIT_SUBSCRIPTION_PLAN
}
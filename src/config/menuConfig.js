const dbConn = require('../../dbConfig');

/**
 * User portal app menu
 * 
 * This array contains the menu items for the user portal app. The react component for each menu item is specified in the 'component' field. The url is specified in the 'url' field in user portal.
 */
const USER_APP_MENU = [
  {
    name: 'Bank Statement',
    url: '/bank-statement',
    component: 'BankStatement',
    icon: 'ds-side-icon-1.svg',
    module: 'BANK_STATEMENT',
    display_order: 0,
    is_sidebar_menu: true
  },
  {
    name: 'Client Trust Entry',
    url: '/client-trust-entry',
    component: 'ClientTrustEntry',
    icon: 'ds-side-icon-2.svg',
    module: 'BANK_STATEMENT',
    display_order: 1,
    is_sidebar_menu: true
  },
  {
    name: 'Trust Account Journals',
    url: '/trust-account-journal',
    component: 'TrustAccountJournal',
    icon: 'ds-side-icon-4.svg',
    module: 'JOURNAL',
    display_order: 2,
    is_sidebar_menu: true
  },
  {
    name: 'Individual Client Ledger',
    url: '/individual-ledger',
    component: 'IndividualClientLedger',
    icon: 'ds-side-icon-3.svg',
    module: 'LEDGER',
    display_order: 3,
    is_sidebar_menu: true
  },
  {
    name: 'All Clients',
    url: '/all-clients',
    component: 'AllClients',
    icon: 'ds-side-icon-5.svg',
    module: 'CLIENT',
    display_order: 4,
    is_sidebar_menu: true
  },
  {
    name: 'Bank Charges Ledger',
    url: '/bank-charges-ledgers',
    component: 'BankChargesLedgers',
    icon: 'ds-side-icon-6.svg',
    module: 'LEDGER',
    display_order: 5,
    is_sidebar_menu: true
  },
  {
    name: 'Outstanding Deposits',
    url: '/outstanding-deposits',
    component: 'OutstandingDeposits',
    icon: 'ds-side-icon-7.svg',
    module: 'OUTSTANDING',
    display_order: 6,
    is_sidebar_menu: true
  },
  {
    name: 'Outstanding Disbursements',
    url: '/outstanding-disbursement',
    component: 'OutstandingDisbursements',
    icon: 'ds-side-icon-8.svg',
    module: 'OUTSTANDING',
    display_order: 7,
    is_sidebar_menu: true
  },
  {
    name: 'Reconciliation',
    url: '/reconciliation',
    component: 'Reconciliation',
    icon: 'ds-side-icon-9.svg',
    module: 'RECONCILIATION',
    display_order: 8,
    is_sidebar_menu: true
  },
  {
    name: 'Client Ledger Summary',
    url: '/client-leader-summary',
    component: 'ClientLeaderSummary',
    icon: 'ds-side-icon-10.svg',
    module: 'CLIENT',
    display_order: 9,
    is_sidebar_menu: true
  },
  {
    name: 'Lien Management',
    url: '/lien-management',
    component: 'LienManagement',
    icon: 'ds-side-icon-11.svg',
    module: 'LIEN',
    display_order: 10,
    is_sidebar_menu: true
  },
  {
    name: 'Scheduler or Report',
    url: '/scheduler-for-reports',
    component: 'SchedulerReports',
    icon: 'Schedule.png',
    module: 'REPORT',
    display_order: 11,
    is_sidebar_menu: true
  },
  {
    name: 'Lien Transactions',
    url: '/lien-transactions',
    component: 'LienTransactionsTable',
    icon: '',
    module: 'LIEN',
    display_order: 99,
    is_sidebar_menu: false
  },
  {
    name: 'My Profile',
    url: '/my-profile',
    component: 'MyProfile',
    icon: '',
    module: 'USER',
    display_order: 99,
    is_sidebar_menu: false
  },
  {
    name: 'My Subscriptions',
    url: '/subscription-plan',
    component: 'SubscriptionPlan',
    icon: '',
    module: 'USER',
    display_order: 99,
    is_sidebar_menu: false
  },
]


/**
 * Checks if the menu table is empty and if so, inserts the default user app menu items into the menu table. Actually due to number of menu is static. For this reason, we are creating the menu in the db table 'menu' at the time of api server start, if db table 'menu' is empty. Because we are fetching menu with permission according to role at the time of login. Based on that user can access the menu in user portal
 * @returns {Promise<void>} - A promise that resolves if the default menu items were inserted successfully, or rejects if there was an error.
 */
const INIT_DEFAULT_MENU = async () => {
  try {
    console.log("Checking for default menu for user portal...");
    // building query to check already menu exists or not
    let query = 'select count(*) as count from menu';
    const [rows] = await dbConn.query(query);
    // now checking menu count and matching with user app menu array length.
    // if count 0 or count is less than user app menu length then inserting default menu
    if (rows.length > 0 && (rows[0].count <= 0 || rows[0].count < USER_APP_MENU.length)) {
      console.log('There is no default menu for user portal...');
      console.log('Inserting default menu for user portal...');
      const fetchQuery = 'select * from menu';
      const [existing_menus] = await dbConn.query(fetchQuery);
      // looping over user app menu array
      for (let i = 0; i < USER_APP_MENU.length; i++) {
        // checking menu already exists or not. If exists then skipping
        if (existing_menus.length > 0 && existing_menus.find(menu => menu.name === USER_APP_MENU[i].name)) {
          console.log(`${USER_APP_MENU[i].name} menu already exists...`);
          console.log(`Skipping ${USER_APP_MENU[i].name} menu...`);
          continue;
        }
        console.log(`Inserting ${USER_APP_MENU[i].name} menu...`);
        // inserting default menu
        let query = `insert into menu set ?`;
        await dbConn.query(query, USER_APP_MENU[i]);
        console.log(`${USER_APP_MENU[i].name} menu inserted successfully...`);
      }
      console.log('Default menu inserted successfully for user portal...');
    } else {
      console.log('Default menu already exists for user portal...');
    }
  } catch (error) {
    console.error("Error inserting default menu for user portal: ", error);
  }
}


module.exports = {
  USER_APP_MENU,
  INIT_DEFAULT_MENU
}
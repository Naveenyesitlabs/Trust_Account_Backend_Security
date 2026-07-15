const dbConn = require('../../dbConfig');

/**
 * An array of default roles to be inserted into the database.
 */
const DEFAULT_ROLES = [
  {
    "name": "Super Admin",
    "description": "Super Admin"
  },
  {
    "name": "Admin",
    "description": "Admin"
  }
]

/**
 * Checks if the role table is empty and if so, inserts the default roles into the role table. Actually due to number of role is static. For this reason, we are creating the role in the db table 'role' at the time of api server start, if db table 'role' is empty. Because we are fetching role with permission according to role at the time of login. Based on that user can access the role in user portal
 * @returns {Promise<void>} - A promise that resolves if the default roles were inserted successfully, or rejects if there was an error.
 */
const INIT_DEFAULT_ROLE = async () => {
  try {
    console.log("Checking for default roles...");
    // building query to check already menu exists or not
    let query = 'select count(*) as count from role';
    const [rows] = await dbConn.query(query);
    // now checking menu count and matching with user app menu array length.
    // if count 0 or count is less than user app menu length then inserting default menu
    if (rows.length > 0 && (rows[0].count <= 0 || rows[0].count < DEFAULT_ROLES.length)) {
      console.log('There is no default role...');
      console.log('Inserting default role...');
      const fetchQuery = 'select * from role';
      const [existing_roles] = await dbConn.query(fetchQuery);
      // looping over user app menu array
      for (let i = 0; i < DEFAULT_ROLES.length; i++) {
        // checking menu already exists or not. If exists then skipping
        if (existing_roles.length > 0 && existing_roles.find(role => role.name === DEFAULT_ROLES[i].name)) {
          console.log(`${DEFAULT_ROLES[i].name} role already exists...`);
          console.log(`Skipping ${DEFAULT_ROLES[i].name} role...`);
          continue;
        }
        console.log(`Inserting ${DEFAULT_ROLES[i].name} role...`);
        // inserting default menu
        let insertQuery = `insert into role set ?`;
        const [result] = await dbConn.query(insertQuery, DEFAULT_ROLES[i]);
        console.log(`${DEFAULT_ROLES[i].name} role inserted successfully...`);
        let role_id = result.insertId;

        console.log("Mapping for role Admin and Super Admin...");
        if (DEFAULT_ROLES[i].name === "Super Admin" || DEFAULT_ROLES[i].name === "Admin") {
          // getting all menu
          console.log("Fetching all menus...");
          const [menus] = await dbConn.query(`select * from menu`);
          for (let j = 0; j < menus.length; j++) {
            const rolePermissionData = {
              role_id: role_id,
              menu_id: menus[j].id,
              has_read_permission: 1,
              has_add_permission: 1,
              has_edit_permission: 1,
              has_delete_permission: 1
            }
            // inserting default menu
            await dbConn.query(`insert into role_menu_map set ?`, rolePermissionData);
            console.log(`${menus[j].name} menu mapped successfully...`);
          }
        }
      }
      console.log('Default role inserted successfully...');
    } else {
      console.log('Default role already exists...');
    }
  } catch (error) {
    console.error("Error inserting default role: ", error);
  }
}

module.exports = {
  INIT_DEFAULT_ROLE
}
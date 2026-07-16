const dbConn = require('../../../dbConfig');



/**
 * Fetches all menu items that are not deleted from the database.
 * @returns {Promise<Array<Object>>} 
 * @throws {Error} - Throws an error if there is a database error while fetching the menu items.
 */
const getMenusDB = async () => {
  try {
    const [rows] = await dbConn.query('select id, name, url, component from menu where deleted_at is NULL order by display_order asc');
    return rows || [];
  } catch (err) {
    throw new Error('Database error at getMenuDB: ' + err.message);
  }
}


/**
 * Fetches all distinct modules from the menu table in the database.
 * @returns {Promise<Array<Object>>} 
 * @throws {Error} - Throws an error if there is a database error while fetching the modules.
 */

const getModulesDb = async () => {
  try {
    const [rows] = await dbConn.query('select distinct module from menu where deleted_at is NULL');
    return rows || [];
  } catch (err) {
    throw new Error('Database error at getModulesDb: ' + err.message);
  }
}


/**
 * Fetches the menu items and its permissions for a given module.
 * @param {string} module - The module name for which the menu items and its permissions are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the menu item details and its permissions.
 * @throws {Error} - Throws an error if there is a database error while fetching the menu items and its permissions.
 */
const getMenuPermissionsByModuleDB = async (modulesArray, role_id) => {
  try {
    let query = `
      SELECT
        m.id,
        m.name,
        MAX(m.url) as url,
        MAX(m.icon) as icon,
        MAX(m.component) as component,
        MAX(COALESCE(rmm.has_read_permission, false)) as has_read_permission,
        MAX(COALESCE(rmm.has_add_permission, false)) as has_add_permission,
        MAX(COALESCE(rmm.has_edit_permission, false)) as has_edit_permission,
        MAX(COALESCE(rmm.has_delete_permission, false)) as has_delete_permission,
        MAX(m.is_sidebar_menu) as is_sidebar_menu
      FROM
        menu AS m
      LEFT JOIN
        role_menu_map AS rmm
        ON rmm.menu_id = m.id AND rmm.role_id = ?
      WHERE
        m.deleted_at IS NULL
    `;

    const values = [role_id];

    if (modulesArray && modulesArray.length > 0) {
      const placeholders = modulesArray.map(() => '?').join(', ');
      query += ` AND m.module IN (${placeholders})`;
      values.push(...modulesArray);
    }

    query += `
      GROUP BY m.id, m.name
      ORDER BY MAX(m.display_order) ASC
    `;

    const [rows] = await dbConn.query(query, values);
    return rows || [];
  } catch (err) {
    throw new Error('Database error at getMenuPermissionsByModuleDB: ' + err.message);
  }
};




/**
 * Fetches the id of the existing role_menu_map entry for the given role_id and menu_id.
 * @param {number} role_id - The ID of the role.
 * @param {number} menu_id - The ID of the menu item.
 * @returns {Promise<number|Null>} - The id of the role_menu_map entry or null if not present.
 * @throws {Error} - Throws an error if there is a database error while fetching the role_menu_map entry.
 */
const getRoleMenuPermissionsDB = async (role_id, menu_id) => {
  try {
    let query = `select id from role_menu_map where role_id = ? and menu_id = ? limit 1`;
    const [rows] = await dbConn.query(query, [role_id, menu_id]);
    return rows.length > 0 ? rows[0].id : null;
  } catch (err) {
    throw new Error('Database error at getRoleMenuPermissionsDB: ' + err.message);
  }
}

/**
 * Deletes all role_menu_map entries for a given role_id from the database.
 * @param {number} role_id - The ID of the role.
 * @returns {Promise<boolean>} - True if role_menu_map entries were successfully deleted, false otherwise.
 * @throws {Error} - Throws an error if there is a database error while deleting the role_menu_map entries.
 */
const deleteRoleMenuPermissionDB = async (role_id) => {
  try {
    let query = `delete from role_menu_map where role_id = ?`;
    const [rows] = await dbConn.query(query, [role_id]);
    return rows.affectedRows > 0;
  } catch (err) {
    throw new Error('Database error at deleteRoleMenuPermissionDB: ' + err.message);
  }
}


/**
 * Inserts a new role_menu_map entry into the database.
 * @param {Object} data - An object containing the role_id, menu_id, and permissions (has_read_permission, has_add_permission, has_edit_permission, has_delete_permission) of the role_menu_map entry to be inserted.
 * @returns {Promise<boolean>} - True if the role_menu_map entry was successfully inserted, false otherwise.
 * @throws {Error} - Throws an error if there is a database error while inserting the role_menu_map entry.
 */
const insertRoleMenuPermissionsDB = async (data) => {
  try {
    let query = `insert into role_menu_map set ?`;
    const [rows] = await dbConn.query(query, data);
    return rows.affectedRows > 0;
  } catch (err) {
    throw new Error('Database error at insertRoleMenuPermissionsDB: ' + err.message);
  }
}


/**
 * Updates an existing role_menu_map entry in the database.
 * @param {number} id - The ID of the role_menu_map entry to be updated.
 * @param {Object} data - An object containing the updated role_menu_map entry data.
 * @returns {Promise<boolean>} - True if the role_menu_map entry was successfully updated, false otherwise.
 * @throws {Error} - Throws an error if there is a database error while updating the role_menu_map entry.
 */

const updateRoleMenuPermissionDB = async (id, data) => {
  try {
    let query = `update role_menu_map set ? where id = ?`;
    const [rows] = await dbConn.query(query, [data, id]);
    return rows.affectedRows > 0;
  } catch (err) {
    throw new Error('Database error at updateRoleMenuPermissionDB: ' + err.message);
  }
}



module.exports = {
  getMenusDB,
  getRoleMenuPermissionsDB,
  getMenuPermissionsByModuleDB,
  getModulesDb,
  insertRoleMenuPermissionsDB,
  updateRoleMenuPermissionDB,
  deleteRoleMenuPermissionDB,
}

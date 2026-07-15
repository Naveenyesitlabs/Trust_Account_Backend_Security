const dbConn = require('../../../dbConfig');


/**
 * Inserts a new role into the 'role' table in the database
 * @param {Object} data - The role data to be inserted
 * @returns {Promise<number>} - The id of the newly inserted role
 */

const insertRole = async (data) => {
  try {
    const query = `INSERT INTO role SET ?`;
    const [rows] = await dbConn.query(query, [data]);
    return rows.affectedRows > 0 ? rows.insertId : null;
  } catch (error) {
    throw new Error('Database error at insertRole: ' + error.message);
  }
};


/**
 * Fetches all roles from the 'role' table in the database.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each representing a role.
 * @throws {Error} - Throws an error if there is a database error while fetching the roles.
 */

const getRolesDB = async (user_id) => {
  try {
    const query = `SELECT id, name, description FROM role where created_by = ? and deleted_at is null`;
    const [rows] = await dbConn.query(query, [user_id]);
    return rows;
  } catch (error) {
    throw new Error('Database error at getRolesDB: ' + error.message);
  }
};



/**
 * Updates an existing role in the 'role' table in the database.
 * @param {number} id - The ID of the role to be updated.
 * @param {Object} data - An object containing the updated role data.
 * @returns {Promise<boolean>} - True if the role was successfully updated, false otherwise.
 * @throws {Error} - If there is a database error during the update operation.
 */

const updateRoleDB = async (id, data) => {
  try {
    let query = `update role set ? where id=?`;
    const values = [data, id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error('Database error at updateRoleDB: ' + error.message);
  }
}



/**
 * Soft deletes a role from the 'role' table in the database by setting the 'deleted_at' column to the current timestamp.
 * @param {number} id - The ID of the role to be deleted.
 * @returns {Promise<boolean>} - True if the role was successfully deleted, false otherwise.
 * @throws {Error} - If there is a database error during the deletion operation.
 */
const softDeleteRoleDB = async (id) => {
  try {
    // let query = `update role set deleted_at = now() where id=?`;
    let query = `delete from role where id=?`;
    const values = [Number(id)];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error('Database error at deleteRoleDB: ' + error.message);
  }
}


/**
 * Permanently deletes a role from the 'role' table in the database.
 * @param {number} id - The ID of the role to be deleted.
 * @returns {Promise<boolean>} - True if the role was successfully deleted, false otherwise.
 * @throws {Error} - If there is a database error during the deletion operation.
 */

const deleteRoleDB = async (id) => {
  try {
    let query = `delete from role where id=?`;
    const values = [id];
    const [rows] = await dbConn.query(query, values);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error('Database error at deleteRoleDB: ' + error.message);
  }
}


const getUserWisePermissionsDB = async (admin_id) => {
  try {
    let query = `SELECT
                    u.name AS user_name,
                    r.name AS role_name,
                    m.module AS module_name,
                    m.name AS menu_name,
                    rmm.has_read_permission,
                    rmm.has_add_permission,
                    rmm.has_edit_permission,
                    rmm.has_delete_permission
                FROM
                    users u
                LEFT JOIN
                    role r ON u.role_id = r.id
                LEFT JOIN
                    role_menu_map rmm ON rmm.role_id = r.id
                LEFT JOIN
                    menu m ON m.id = rmm.menu_id
                WHERE
                    (m.is_sidebar_menu = ? OR m.id IS NULL)
                    AND r.created_by IS NOT NULL
                    AND u.created_by = ?
                    AND u.deleted_at IS NULL
                    AND (r.deleted_at IS NULL OR r.id IS NULL)
                    AND (m.deleted_at IS NULL OR m.id IS NULL)`;
    const [rows] = await dbConn.query(query, [true, admin_id]);
    return rows;
  } catch (error) {
    throw new Error("Database error at getUserWisePermissionsDB: " + error.message);
  }
}

const getRoleDetails = async (role_id = null, role_name = null) => {
  try {
    let query = `select * from role where id = ?`;
    if (role_name) {
      query = `select * from role where name = ?`;
      const [rows] = await dbConn.query(query, [role_name]);
      return rows[0];
    }
    const [rows] = await dbConn.query(query, [role_id]);
    return rows[0];
  } catch (error) {
    throw new Error("Database error at getRoleDetails: " + error.message);
  }
}


const getSignUpRole = async () => {
  try {
    let query = `
      SELECT id, name FROM role 
      WHERE LOWER(name) = 'admin' AND deleted_at IS NULL 
      ORDER BY id ASC 
      LIMIT 1
    `;
    const [rows] = await dbConn.query(query);
    return rows.length > 0 ? { role_id: rows[0].id, role_name: rows[0].name } : null;
  } catch (error) {
    throw new Error("Database error at getSignUpRole: " + error.message);
  }
};


const getSelectedModuleDB = async (role_id) => {
  try {
    let query = `select distinct m.module from role_menu_map as rmm 
    inner join menu as m on rmm.menu_id = m.id 
    where rmm.role_id = ?`;
    const [rows] = await dbConn.query(query, [role_id]);
    return rows || [];
  } catch (error) {
    throw new Error("Database error at getSelectedModuleDB: " + error.message);
  }
}


const getProfileMenuDB = async () => {
  try {
    let query = `select id from menu where name = ? order by id desc limit ?`;
    const [rows] = await dbConn.query(query, ['My Profile', 1]);
    return rows.length > 0 ? rows[0].id : null;
  } catch (err) {
    throw new Error("Database error at getProfileMenuDB: " + err.message);
  }
}

const deleteRoleFromUserAndPermissionsDB = async (role_id) => {
  const connection = await dbConn.getConnection();
  try {
    await connection.beginTransaction();
    // Soft delete the user in the users table
    const [userResult] = await connection.query(
      `update users set role_id = null where role_id = ?`,
      [role_id]
    );

    const [userManageResult] = await connection.query(
      `update user_management set role_id = null, assign_role = null where role_id = ?`,
      [role_id]
    );

    const [roleMenuMapResult] = await connection.query(
      `delete from role_menu_map where role_id = ?`,
      [role_id]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw new Error("Database error at deleteRoleFromUserAndPermissionsDB: " + err.message);
  } finally {
    connection.release();
  }
}


const getRoleByIdDB = async (role_id) => {
  try {
    let query = `select * from role where id = ?`;
    const [rows] = await dbConn.query(query, [role_id]);
    return rows.length > 0 ? rows[0] : [];
  } catch (err) {
    throw new Error("Database error at getRoleByIdDB: " + err.message);
  }
}


module.exports = {
  insertRole,
  getRolesDB,
  updateRoleDB,
  softDeleteRoleDB,
  deleteRoleDB,
  getUserWisePermissionsDB,
  getRoleDetails,
  getSignUpRole,
  getSelectedModuleDB,
  getProfileMenuDB,
  deleteRoleFromUserAndPermissionsDB,
  getRoleByIdDB,
};
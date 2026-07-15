const { getMenusDB, getMenuPermissionsByModuleDB, getModulesDb, getRoleMenuPermissionsDB, insertRoleMenuPermissionsDB, updateRoleMenuPermissionDB, deleteRoleMenuPermissionDB } = require("../../model/admin/menuModel");
const { insertRole, getRolesDB, updateRoleDB, softDeleteRoleDB, getUserWisePermissionsDB, getSelectedModuleDB, getProfileMenuDB, deleteRoleFromUserAndPermissionsDB, getRoleByIdDB } = require("../../model/admin/roleModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");



/**
 * Adds a new role to the system.
 * @param {Object} req - The request object containing role data in its body.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of role addition.
 * @throws {Error} - If an error occurs during role addition, logs the error and sends an internal server error response.
 */
const addRoleController = async (req, res) => {
  try {
    // getting logged in user id
    const userId = req.user.userid;
    // getting data from request
    const { name, description } = req.body;
    // checking required fields
    if (!name) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // creating role
    const role_id = await insertRole({ name, description, created_by: userId });
    // adding role
    if (!role_id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Error adding role");
    }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Role added successfully");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches all roles from the system.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching roles.
 * @throws {Error} - If an error occurs during fetching roles, logs the error and sends an internal server error response.
 */
const getRolesController = async (req, res) => {
  try {
    // getting logged in user id
    const userId = req.user.userid;
    // fetching roles
    const roles = await getRolesDB(userId);
    // adding serial number
    const dataWithSerialNo = await addSerialNoComman(roles);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Roles fetched successfully", dataWithSerialNo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}



/**
 * Updates an existing role in the system.
 * @param {Object} req - The request object containing role ID in params and updated role data in its body.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of role update.
 * @throws {Error} - If an error occurs during role update, logs the error and sends an internal server error response.
 */
const updateRoleController = (req, res) => {
  try {
    // getting id from param
    const { id } = req.params;
    // getting data from request
    const { name, description } = req.body;
    // checking required fields
    if (!id || !name) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // updating role
    const result = updateRoleDB(id, { name, description });
    // checking result
    if (!result) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Error updating role");
    }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Role updated successfully");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}



/**
 * Soft deletes a role from the system.
 * @param {Object} req - The request object containing role ID in params.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of role deletion.
 * @throws {Error} - If an error occurs during role deletion, logs the error and sends an internal server error response.
 */
const deleteRoleController = async (req, res) => {
  try {
    // getting id from param
    const { id } = req.params;
    // checking required fields
    if (!id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // soft deleting role
    const result = softDeleteRoleDB(id);
    if (!result) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Error deleting role");
    }
    // deleting role from user
    await deleteRoleFromUserAndPermissionsDB(id);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Role deleted successfully");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches all menu items that are not deleted from the database and returns them in the response.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching menu.
 * @throws {Error} - If an error occurs during fetching menu, logs the error and sends an internal server error response.
 */
const getMenuController = async (req, res) => {
  try {
    // fetching menu
    const result = await getMenusDB();
    // adding serial number
    const dataWithSerialNo = await addSerialNoComman(result);
    if (!result) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Error fetching menu");
    }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Menu fetched successfully", dataWithSerialNo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches all modules from the database and returns them in the response.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching modules.
 * @throws {Error} - If an error occurs during fetching modules, logs the error and sends an internal server error response.
 */
const getModuleController = async (req, res) => {
  try {
    // fetching modules
    const result = await getModulesDb();
    return respond(res, true, HTTP_STATUS_CODE.OK, "Modules fetched successfully", result);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches menu items with permissions for a given list of modules and role ID from the database and returns them in the response.
 * @param {Object} req - The request object containing menu_module and role_id in its body.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching menu with permission.
 * @throws {Error} - If an error occurs during fetching menu with permission, logs the error and sends an internal server error response.
 */
const getMenuListByModuleController = async (req, res) => {
  try {
    const { menu_module, role_id } = req.body;

    // Validate inputs
    if (!menu_module || !role_id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }

    // Ensure menu_module is an array (can accept single value or array)
    const modulesArray = Array.isArray(menu_module) ? menu_module : [menu_module];
    // getting menu along with permission
    const result = await getMenuPermissionsByModuleDB(modulesArray, role_id);

    if (!result || result.length === 0) {
      return respond(res, false, HTTP_STATUS_CODE.NOT_FOUND, "No menu found for selected modules");
    }

    return respond(res, true, HTTP_STATUS_CODE.OK, "Menu with permission fetched successfully", result);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
};



/**
 * Gives or updates access to a role to a particular menu item.
 * @param {Object} req - The request object containing role_id, menu_id, has_read_permission, has_add_permission, has_edit_permission, has_delete_permission in its body.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of giving access to role.
 * @throws {Error} - If an error occurs during giving access to role, logs the error and sends an internal server error response.
 */
const roleMenuPermissionController = async (req, res) => {
  try {
    const { role_id, permissions } = req.body;
    if (!role_id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // deleteing previously assigned permission
    const deletePermissions = await deleteRoleMenuPermissionDB(role_id);
    // inserting new permission
    for (const permission of permissions) {
      const { menu_id, has_read_permission, has_add_permission, has_edit_permission, has_delete_permission } = permission;
      if (has_read_permission || has_add_permission || has_edit_permission || has_delete_permission) {
        const inserted = await insertRoleMenuPermissionsDB({ role_id, menu_id, has_read_permission, has_add_permission, has_edit_permission, has_delete_permission });
        if (!inserted) {
          return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Error to give access to role");
        }
      }
    }

    return respond(res, true, HTTP_STATUS_CODE.OK, "Access given to role successfully");
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches all user wise permissions from the database and returns them in the response.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching user wise permissions.
 * @throws {Error} - If an error occurs during fetching user wise permissions, logs the error and sends an internal server error response.
 */
const getUsrWiseRolePermissionController = async (req, res) => {
  try {
    // getting logged in user id
    const adminId = req?.user?.userid;
    // fetching user wise permissions
    const userPermissions = await getUserWisePermissionsDB(adminId);
    const result = {};
    // mapping user wise permissions
    userPermissions.forEach(row => {
      const {
        user_name,
        role_name,
        module_name,
        menu_name,
        has_read_permission,
        has_add_permission,
        has_edit_permission,
        has_delete_permission
      } = row;

      // Initialize user object if not exists
      if (!result[user_name]) {
        result[user_name] = {
          user_name,
          role: role_name,
          assigned_modules: [],
          assigned_permissions: []
        };
      }

      // Add module to assigned_modules if not already added
      if (!result[user_name].assigned_modules.includes(module_name)) {
        result[user_name].assigned_modules.push(module_name);
      }

      // Check if module entry already exists in assigned_permissions
      let modulePermissions = result[user_name].assigned_permissions.find(
        (mod) => mod.module_name === module_name
      );
      // checking permission
      if (!modulePermissions) {
        modulePermissions = {
          module_name,
          permissions: []
        };
        result[user_name].assigned_permissions.push(modulePermissions);
      }

      // Add the permission entry for the menu
      modulePermissions.permissions.push({
        menu_name,
        has_read_permission,
        has_add_permission,
        has_edit_permission,
        has_delete_permission
      });
    });

    // return as array or object based on requirement
    return respond(res, true, HTTP_STATUS_CODE.OK, "User wise permissions fetched successfully", Object.values(result));
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


/**
 * Fetches all the selected modules for a given role ID.
 * @param {Object} req - The request object containing role ID in params.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching selected modules.
 * @throws {Error} - If an error occurs during fetching selected modules, logs the error and sends an internal server error response.
 */
const getSelectedModuleController = async (req, res) => {
  try {
    // getting role id from params
    const { role_id } = req.params;
    // checking required field
    if (!role_id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // fetching selected modules
    const result = await getSelectedModuleDB(role_id);
    // returning response with only modules
    const data = result.map(row => row.module);
    return respond(res, true, HTTP_STATUS_CODE.OK, "Selected modules fetched successfully", data);
  } catch (err) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
  }
}


/**
 * Fetches a role by its ID from the database and returns it in the response.
 * @param {Object} req - The request object containing role ID in params.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of fetching role.
 * @throws {Error} - If an error occurs during fetching role, logs the error and sends an internal server error response.
 */
const getRoleByIdController = async (req, res) => {
  try {
    // getting id from params
    const { id } = req.params;
    if (!id) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // fetching role
    const result = await getRoleByIdDB(id);
    if (!result) {
      return respond(res, false, HTTP_STATUS_CODE.NOT_FOUND, "Role not found");
    }
    return respond(res, true, HTTP_STATUS_CODE.OK, "Role fetched successfully", result);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  addRoleController,
  getRolesController,
  updateRoleController,
  deleteRoleController,
  getMenuController,
  getModuleController,
  // getRoleMenuPermissions,
  roleMenuPermissionController,
  getMenuListByModuleController,
  getUsrWiseRolePermissionController,
  getSelectedModuleController,
  getRoleByIdController,
}
const { getRoleDetails } = require('../../model/admin/roleModel');
const {
    isEmailExist,
    addUserIntoManagement,
    updateUserManagement,
    deleteUserManagementById,
    getAllUsersFromManagement,
    updateAccessStatusUserManagementById,
    checkEmailExist,
    updateUserByAdmin,
    getUserIdByUserManagement,
    deleteUserByAdmin
} = require('../../model/admin/userManagementModel');
const { createUser } = require('../../model/user/userModel');
const { sendEmail } = require('../../services/emailService');
const addSerialNoComman = require('../../utils/addSerialNoComman');
const bcrypt = require("bcryptjs");


/**
 * @function addUserManagementController
 * @description Adds a new user to the system (admin facing)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise} - A promise resolving to the response object
 * @throws {Error} - If an error occurs during execution
 * @example
 * adding new user. only from admin
 */
const addUserManagementController = async (req, res) => {
    // getting data from request
    const { name, email, designation, password, role_id } = req.body;
    // checking required fields
    if (!name || !email || !designation || !password) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Missing required fields'
        });
    }
    // getting logged in user id
    const created_by = req?.user?.userid
    try {
        // 🔍 Check for existing email
        const hasEmail = await isEmailExist(email);
        if (hasEmail) {
            return res.status(409).json({
                status: 409,
                success: false,
                message: 'User already exists'
            });
        }
        // hashing password
        const hashedPassword = await bcrypt.hash(password, 10);
        const [newLoginUser] = await createUser({ name, email, password: hashedPassword, role_id, created_by });

        // checking user actaually created or not
        if (!newLoginUser.insertId) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'An error occurred while creating the user'
            });
        }

        // getting last created user id
        const user_id = newLoginUser.insertId;

        // ✅ Proceed to insert if email doesn't exist
        const newUser = await addUserIntoManagement({ user_id, name, email, designation, role_id, created_by });

        // configuring mail options
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Onboarding in Trust Recociliation Portal',
            text: `Welcome to Trust Recociliation Portal! Your account has been created successfully. `,
            html: `<p> Welcome to Trust Recociliation Portal! Your account has been created successfully.</p> `,
        };

        // finally sending mail to created user's mail id
        await sendEmail(mailOptions, 3);

        return res.status(201).json({
            status: 201,
            success: true,
            message: 'User added successfully',
            data: newUser
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while adding the user',
            error: err.message
        });
    }
};


/**
 * @description Get all users from user management
 * @route GET /user-management
 * @access private
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @returns {Object} Response object containing user management data
 * fetching all users based on logged in admin
 */
const getUserManagementController = async (req, res) => {
    try {
        // getting logged in admin id
        const admin_id = req?.user?.userid;
        // getting all users
        const users = await getAllUsersFromManagement(admin_id);
        // adding serial number
        const addSerialNo = await addSerialNoComman(users);
        if (!users?.length) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No user management data found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User management data fetched successfully',
            data: addSerialNo
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while fetching user data',
            error: err.message
        });
    }
};


/**
 * @description Update user in user management
 * @route PUT /user-management/:id
 * @access private
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @param {String} id User id to be updated
 * @param {Object} updatedData Data to be updated
 * @property {String} name Name of user
 * @property {String} email Email of user
 * @property {String} phone Phone number of user
 * @property {String} role_id Role id of user
 * @property {String} password Password of user (optional)
 * @returns {Object} Response object containing user management data
 * 
 * updating user based on logged in admin
 */
const updateUserManagementController = async (req, res) => {
    // getting logged in admin id
    const { id } = req.params;
    // getting request data
    const updatedData = req.body;
    const { email } = req.body;
    // checking email is alredy exist or not
    const isEmail = await checkEmailExist(email, id)
    // getting role data
    const roleData = await getRoleDetails(updatedData.role_id);
    // assigning role
    updatedData.assign_role = roleData?.name
    // checking email is alredy exist or not
    if (isEmail) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Email already exist',
        });
    }
    // checking id
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'ID is required'
        });
    }

    try {
        // getting user by id
        const userid = await getUserIdByUserManagement(id);
        // preparing data to update
        const updateUserData = {
            name: updatedData.name,
            email: updatedData.email,
            phone: updatedData.phone,
            role_id: updatedData.role_id,
            role: 'Admin',
        }
        // hashing password if provided
        if (updatedData.password && updatedData.password.length > 0) {
            const hashedPassword = await bcrypt.hash(updatedData.password, 10);
            updateUserData.password = hashedPassword
        }
        // updating user  in users table
        const userUpdate = await updateUserByAdmin(userid, updateUserData);
        // updating user in user_management table
        const success = await updateUserManagement(id, updatedData);
        // updating user in user_role_map table
        if (!success) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }
        // sending mail to updated user's mail id
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User updated successfully'
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while updating the user',
            error: err.message
        });
    }
};


/**
 * @description Delete user from user management
 * @route DELETE /user-management/:id
 * @access private
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @returns {Object} Response object containing user management data
 * The controller will delete the user from the user management table and users table, and also send a email to the user's email id
 */
const deleteUserManagementController = async (req, res) => {
    // getting logged in admin id
    const { id } = req.params;
    // checking id
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'ID is required'
        });
    }
    try {
        // getting user by id
        const userid = await getUserIdByUserManagement(id);
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        // preparing data to update
        const timestamp =
            now.getFullYear().toString() +
            pad(now.getMonth() + 1) +
            pad(now.getDate()) +
            pad(now.getHours()) +
            pad(now.getMinutes()) +
            pad(now.getSeconds());
        // creating timestamp with a prefix. because it will replce the current email. because email is unique, if this user will create account with same email in future, then this user can easily create account and re-login but will not hamper the data related to this user
        const email = 'DELUSR' + timestamp;
        // updating user  in users table
        const userUpdate = await deleteUserByAdmin(userid, now, email)
        // updating user in user_management table
        const success = await deleteUserManagementById(id, now, email);
        if (!success) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }
        // sending response
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while deleting the user',
            error: err.message
        });
    }
};



/**
 * @description Change access status of a user in user management
 * @route PUT /change-access-status
 * @access private
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @returns {Object} Response object containing user management data
 * The controller will update the access status of the user in the user management table.
 * If the user does not exist, it will return 404.
 * If there is any error while updating the access status, it will return 500.
 */
const changeAccessStatusController = async (req, res) => {
    const { id, access_status } = req.body;  // Now we expect "id" and "access" in the body
    if (!id || !access_status) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'ID and access are required'
        });
    }
    // Validate that access value is either "Granted" or "Denied"
    const validAccess = ['granted', 'denied'];
    if (!validAccess.includes(access_status)) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Invalid access value. Allowed values are "granted" or "denied".'
        });
    }

    try {
        // Update the access status
        const success = await updateAccessStatusUserManagementById(id, access_status);
        if (!success) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: `Access status updated to ${access_status} successfully`
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while updating the access status',
            error: err.message
        });
    }
};

module.exports = {
    addUserManagementController,
    getUserManagementController,
    updateUserManagementController,
    deleteUserManagementController,
    changeAccessStatusController
};
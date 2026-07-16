const {
    addFirm,
    updateFirm,
    getFirmById,
    deleteFirm,
    updateFirmAccessStatus,
    updateFirmSuspendStatus,
    getAllNotifications,
    markNotificationAsRead,
    isEmailExist,
    addNotification,
    getFirmRoleDB,
    getFirmDetailsById,
    updateUserFirmDB
} = require('../../model/superAdmin/manageFirmModel');
const { createUser } = require('../../model/user/userModel');
const { sendEmail } = require('../../services/emailService');
const addSerialNoComman = require('../../utils/addSerialNoComman');
const { sendAdminNotification } = require('../../utils/notificationHelper');
const { escapeHtml } = require('../../utils/pathSafety');
const bcrypt = require("bcryptjs");



/**
 * @function addFirmController
 * @description Creates a new firm and its corresponding user in the system.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The response object with the status and message
 * @throws {Error} - When there is an error while creating the user or firm
 * 
 * to create new firm/admin
 */
const addFirmController = async (req, res) => {
    const { email, phone, subscription_type, name } = req.body;
    if (!email || !phone || !subscription_type || !name) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'All fields (email, phone, role, name) are required'
        });
    }

    try {
        // 🔍 Check for existing email
        const hasEmail = await isEmailExist(email);
        if (hasEmail) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Email already exists'
            });
        }

        const role_id = await getFirmRoleDB();

        // creating new user for login purpose
        const password = 'Welcome#Admin$2025';
        const hashedPassword = await bcrypt.hash(password, 10);
        const [newLoginUser] = await createUser({ name, email, phone, password: hashedPassword, role: 'admin', role_id, created_by: req?.user?.userid });

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


        const newFirm = await addFirm({ user_id, name, email, phone, subscription_type, created_by: req?.user?.userid });

        if (!newFirm) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'An error occurred while creating the firm'
            });
        }

        // adding notification for newly created firm
        await addNotification("You account has been created successfully", "admin", 'subscription', 'Welcome Admin!', user_id);

        // sending mail to user with password
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Onboarding in Trust Recociliation Portal',
            text: `Hello ${name}, Welcome to Trust Recociliation Portal! Your firm has been created successfully. Here is your password to login in Trust Recociliation Portal: ${password}`,
            html: `<p>Welcome to Trust Recociliation Portal! Your firm has been created successfully.</p>
                    <p> Your email to login in Your Trust Recociliation Portal Login Credentials: </p>
                    <p> Email: <strong>${escapeHtml(email)}</strong></p>
                    <p> Password: <strong>${escapeHtml(password)}</strong></p>`,
        };

        // finally sending mail to created user's mail id
        await sendEmail(mailOptions, 3);
        await sendAdminNotification('New Account', "You account has been created successfully, by admin", "admin", user_id)
        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Firm created successfully',
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error adding user',
        });
    }
};


/**
 * @function updateFirmController
 * @description Updates a firm in the system.
 * @param {Object} req - The request object containing the firm details.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - The response object with the status and message.
 * @throws {Error} - When there is an error while updating the firm.
 * 
 * to update existing firm
 */
const updateFirmController = async (req, res) => {
    // getting request data
    const { id, email, phone, subscription_type, name } = req.body;
    // checking required fields
    if (!id || !email || !phone || !subscription_type || !name) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'All fields are required'
        });
    }
    try {
        // checking firm exist or not
        const firm = await getFirmDetailsById(id);
        // checking firm exist or not
        if (!firm) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Firm not found'
            });
        }
        // getting user id if firm found
        const user_id = firm.user_id

        const result = await updateFirm(id, { email, phone, subscription_type, name });

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No user found with the provided id'
            });
        }

        // updatig user according to firm
        await updateUserFirmDB(user_id, { name, email, phone })

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User updated successfully'
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error updating user',
        });
    }
};



/**
 * @function getFirmByIdController
 * @description Fetches a firm by id.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The response object with the status, success, message and data.
 * The data object contains the firm record.
 * @throws {Error} - It throws an error if an error occurred while fetching the firm.
 */
const getFirmByIdController = async (req, res) => {

    try {
        const firm = await getFirmById();

        if (!firm) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }
        const addSerialNo = await addSerialNoComman(firm)
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User fetched successfully',
            data: addSerialNo
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error fetching user',
        });
    }
};


// ➖ Delete Firm by id
const deleteFirmController = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'user id is required'
        });
    }

    try {
        const firm = await deleteFirm(id);

        if (!firm) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error deleting firm',
        });
    }
};



// 🔒 Update Firm Access Status
const updateFirmAccessStatusController = async (req, res) => {
    const { id, access_status } = req.body;

    if (!id || !access_status) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'User id and access_status are required'
        });
    }

    try {
        if (access_status !== 'granted' && access_status !== 'denied') {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Invalid access status. Only "granted" or "denied" are allowed.'
            });
        }

        const result = await updateFirmAccessStatus(id, access_status);

        if (!result) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No user found with the provided id'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: result.message
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error updating access status',
        });
    }
};


// ⏸️ Suspend Status Update Controller
// const updateFirmSuspendStatusController = async (req, res) => {
//     const { id, suspend_status } = req.body;

//     if (!id || !suspend_status) {
//         return res.status(400).json({
//             status: 400,
//             success: false,
//             message: 'user id and suspend_status are required'
//         });
//     }

//     if (suspend_status !== 'active' && suspend_status !== 'inactive') {
//         return res.status(400).json({
//             status: 400,
//             success: false,
//             message: 'Invalid suspend_status. Only "active" or "inactive" are allowed'
//         });
//     }

//     try {
//         const result = await updateFirmSuspendStatus(id, suspend_status);

//         if (!result) {
//             return res.status(404).json({
//                 status: 404,
//                 success: false,
//                 message: 'No user found with the provided id'
//             });
//         }

//         return res.status(200).json({
//             status: 200,
//             success: true,
//             message: result.message
//         });

//     } catch (err) {
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: err.message || 'Error updating suspend status',
//         });
//     }
// };

const updateFirmSuspendStatusController = async (req, res) => {
    const { id, suspend_status } = req.body;

    if (!id || !suspend_status) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'user id and suspend_status are required'
        });
    }

    if (suspend_status !== 'active' && suspend_status !== 'inactive') {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Invalid suspend_status. Only "active" or "inactive" are allowed'
        });
    }

    try {
        const result = await updateFirmSuspendStatus(id, suspend_status);

        if (!result) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No user found with the provided id'
            });
        }

        // ✅ Send notification
        await sendAdminNotification({
            title: 'Firm Suspension Status Updated',
            message: `Firm with ID ${id} has been marked as "${suspend_status}".`,
            type: 'security',
            id
        });

        return res.status(200).json({
            status: 200,
            success: true,
            message: result.message
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error updating suspend status',
        });
    }
};



// ➕ Add a new admin notification
const addNotificationController = async (req, res) => {
    const { message } = req.body;

    if (!message || message.trim() === '') {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Notification message is required'
        });
    }

    try {
        const result = await addNotification(message);
        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Notification added successfully',
            data: { id: result.id, message }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || 'Error adding notification',
        });
    }
};

// 📥 Get all notifications
const getAllNotificationsController = async (req, res) => {
    try {
        const notifications = await getAllNotifications();
        return res.status(200).json({
            status: 200,
            success: true,
            data: notifications
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || 'Error fetching notifications',
        });
    }
};

// ✅ Mark notification as read
const markNotificationAsReadController = async (req, res) => {
    const { notification_id } = req.body;

    if (!notification_id) {
        return res.status(400).json({
            success: false,
            message: 'notification_id is required'
        });
    }

    try {
        const result = await markNotificationAsRead(notification_id);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Error updating notification status',
        });
    }
};

module.exports = {
    addFirmController,
    updateFirmController,
    getFirmByIdController,
    deleteFirmController,
    updateFirmAccessStatusController,
    updateFirmSuspendStatusController,
    addNotificationController,
    getAllNotificationsController,
    markNotificationAsReadController
};

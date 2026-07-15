const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const User = require('../../model/user/userModel');
const {
    createUser,
    findUserByEmail,
    clearUserOtp,
    getUserWithBankDetailsById,
    updateUserAndBankDetails,
    deleteAccount
} = require('../../model/user/userModel');

const { ifExistByEmail, addFirm } = require('../../model/superAdmin/manageFirmModel');
const { respond } = require('../../utils/reponseHelper');
const { hasPermission, getAdminId, getCreatedByUser, addUserIntoManagement } = require('../../model/admin/userManagementModel');
// const { sendOtpEmail } = require('../../services/twilioMail');
const { getMenuPermissionsByModuleDB } = require('../../model/admin/menuModel');
const { addNotification } = require('../../utils/notificationHelper');
const { getUaserActiveSubscription } = require('../../model/user/subscriptionModel');
const { getRoleDetails, getSignUpRole } = require('../../model/admin/roleModel');
const { sendOtpEmail } = require('../../services/emailService');

const JWT_SECRET = process.env.SECRET_KEY;
const sanitizeProfilePayload = (userData = {}) => {
    const {
        password,
        otp,
        otp_expiry,
        deleted_at,
        created_by,
        stripe_customer_id,
        ...safeData
    } = userData;

    return safeData;
};


// Login Controller
const login = async (req, res) => {
    const { email, password, keepMeLoggedIn, rememberMe } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const user = await User.findUserByEmail(email);
        if (!user || !(user.deleted_at === null)) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Wrong Email or Password'
            });
        }
        const role_id = user?.role_id;

        const roleData = await getRoleDetails(role_id);

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Wrong Email or Password'
            });
        }
        const persistSession = Boolean(rememberMe ?? keepMeLoggedIn);
        const tokenExpiry = persistSession ? '30d' : '12h';

        const token = jwt.sign(
            { userid: user.userid, role: roleData?.name, created_by: user.created_by, role_id: role_id },
            JWT_SECRET,
            { expiresIn: tokenExpiry }
        );
        // Set token in HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: persistSession ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000
        });
        user.role = roleData?.name.toLowerCase();
        user['super_admin_selected_plan'] = null;
        if (roleData?.name.toLowerCase() === 'admin') {

            const isAdmin = await ifExistByEmail({ email: email })
            const permissions = await getMenuPermissionsByModuleDB(null, role_id);
            if (permissions.length <= 0) {
                return respond(res, false, 403, "Access denied! This role has no permission");
            }
            let subscription = {};
            subscription = await getUaserActiveSubscription(user.userid);
            // if (subscription && Object.keys(subscription).length <= 0) {
            //     return res.status(403).json({
            //         status: 403,
            //         success: false,
            //         message: "Access denied! you have no subscription plan. Please subscribe to a plan to access your account"
            //     });
            // }
            user['super_admin_selected_plan'] = subscription && Object.keys(subscription).length > 0 ? null : user.created_by === null ? null : 1;
            const { password, deleted_at, created_by, otp_expiry, otp, created_at, ...finalUserData } = user;
            if (isAdmin) {

                if (isAdmin.access_status === 'granted') {

                    return res.status(200).json({
                        status: 200,
                        success: true,
                        message: "User logged in successfully",
                        role: user.role,
                        userData: finalUserData,
                        subscription: subscription && Object.keys(subscription).length > 0 ? subscription : {},
                        menuPermissions: permissions
                    });

                } else {
                    return res.status(403).json({
                        status: 403,
                        success: false,
                        message: "Access denied! you don't have access to admin account"
                    });
                }
            } else {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: "Access denied! you are not admin"
                })
            }
        } else if (roleData?.name.toLowerCase() === 'super admin') {
            user.role = roleData?.name.toLowerCase().split(" ").join("");
            const { password, deleted_at, created_by, otp_expiry, otp, created_at, ...finalUserData } = user;
            return res.status(200).json({
                status: 200,
                success: true,
                message: "User logged in successfully",
                role: user.role,
                role_id: user.role_id,
                userData: finalUserData,
                // subscription: subscription,
                // menuPermissions: permissions
            });
        } else {
            const adminId = await getAdminId(user.userid);

            // getting permission
            const hasAccess = await User.checkUserAccess(user.userid);

            if (!hasAccess) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: "Access denied! you don't have access to your account"
                });
            }
            const adminHasAccess = await User.checkAdminAccess(adminId);

            if (!adminHasAccess) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: "Access denied! you don't have access to your account"
                });
            }
            const permissions = await getMenuPermissionsByModuleDB(null, user.role_id);
            if (permissions.length <= 0) {
                return respond(res, false, 403, "Access denied! your role has no permission. Contact admin for permission");
            }

            let subscription = {};
            if (adminId !== null) {
                subscription = await getUaserActiveSubscription(adminId);
            }
            // if (subscription && Object.keys(subscription).length <= 0) {
            //     return res.status(403).json({
            //         status: 403,
            //         success: false,
            //         message: "Access denied! you have no subscription plan. Please subscribe to a plan to access your account"
            //     });
            // }

            const { password, deleted_at, created_by, otp_expiry, otp, created_at, ...finalUserData } = user;
            return res.status(200).json({
                status: 200,
                success: true,
                message: "User logged in successfully",
                role: user.role,
                role_id: user.role_id,
                userData: finalUserData,
                subscription: subscription && Object.keys(subscription).length > 0 ? subscription : {},
                menuPermissions: permissions,
            });

        }
    } catch (err) {

        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred during the login process',
            error: err.message
        });
    }
};

// Signup Controller
const signup = async (req, res) => {
    const { email, phone, password, confirmPassword, agreeToTerms } = req.body;

    if (!email || !phone || !password || !confirmPassword || agreeToTerms !== true) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'All fields are required and you must agree to terms'
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Passwords do not match'
        });
    }
    const { role_id, role_name } = await getSignUpRole();
    try {
        const existingUser = await findUserByEmail(email);
        if (existingUser.length > 0) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'User already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        if (existingUser && existingUser.length > 0) {

            if (existingUser.deleted_at !== null) {

                const newUser = {
                    email,
                    phone,
                    role: role_name,
                    password: hashedPassword,
                    role_id: role_id, // Default role can be 'user', 'admin', etc.
                };
                await User.addIfDeletedUser(newUser);
            } else {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'User already exists'
                });
            }
        } else {

            const newUser = {
                name: email.split('@')[0].replace(/[^a-zA-Z0-9]+/g, ' ').trim(),
                email,
                phone,
                role: role_name,
                password: hashedPassword,
                role_id: role_id, // Default role can be 'user', 'admin', etc.
            };
            const newUserRes = await createUser(newUser);

            const created_by = await getCreatedByUser();


            await addFirm({
                user_id: newUserRes.length > 0 ? newUserRes[0].insertId : null,
                name: email.split('@')[0],
                email,
                sign_up_date: new Date(),
                phone,
                subscription_type: null
            });
        }
        await addNotification('New user registered', `A new user with email ${email} has been registered.`, 'subscription', 'superadmin');

        return res.status(201).json({
            status: 201,
            success: true,
            message: 'User registered successfully'
        });
    } catch (err) {

        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred during the signup process', error: err.message
        });
    }
};


// Generate a 6-digit OTP
const generateOtp = () => {
    return Math.floor(1000 + Math.random() * 9000);
};

// forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Email is required'
        });
    }

    try {
        const user = await User.findUserByEmail(email);
        if (!user || user.deleted_at !== null) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found with provided email'
            });
        }
        if (user?.role.toLowerCase() === 'admin') {
            const adminHasAccess = await User.checkAdminAccess(user.userid);
            if (!adminHasAccess) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: "Access denied! you don't have access to your account"
                });
            }
        } else {
            const hasAccess = await User.checkUserAccess(user.userid);
            if (!hasAccess) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: "Access denied! you don't have access to your account"
                });
            }
            const adminId = await getAdminId(user.userid);
            const adminHasAccess = await User.checkAdminAccess(adminId);
            if (!adminHasAccess) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: "Access denied! you don't have access to your account"
                });
            }
        }


        const otp = generateOtp();
        await User.updateUserOtp(user.userid, otp);
        await sendOtpEmail(user.email, otp);

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'OTP sent successfully to your email',
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while processing the request', error: err.message,
        });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Email and OTP are required',
        });
    }

    try {
        const user = await User.findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found with provided email'
            });
        }

        // Check if OTP has expired
        const currentTime = new Date();
        const otpExpiryTime = new Date(user.otp_expiry);

        if (currentTime > otpExpiryTime) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'OTP has expired'
            });
        }

        if (user.otp !== parseInt(otp)) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Invalid OTP'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (err) {

        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while verifying OTP', error: err.message
        });
    }
};


// Reset Password
const resetPassword = async (req, res) => {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Email, OTP, new password, and confirm password are required'
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Passwords do not match'
        });
    }

    try {
        const user = await User.findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'User not found with provided email'
            });
        }

        const otpExpiryTime = user?.otp_expiry ? new Date(user.otp_expiry) : null;
        if (!otpExpiryTime || Number.isNaN(otpExpiryTime.getTime()) || new Date() > otpExpiryTime) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'OTP has expired'
            });
        }

        if (user.otp !== parseInt(otp, 10)) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Invalid OTP'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateUserPassword(user.userid, hashedPassword);
        await clearUserOtp(user.userid);
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'An error occurred while resetting the password'
        });
    }
};


//profile details
const getUserProfile = async (req, res) => {
    const userid = req?.user?.userid;
    try {
        const userData = await getUserWithBankDetailsById(userid);

        if (!userData) {
            return res.status(404).json({
                success: false,
                status: 404,
                message: 'User not found or deleted'
            });
        }

        res.status(200).json({
            success: true,
            status: 200,
            message: 'Data Fetch Successfully',
            data: sanitizeProfilePayload(userData)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 500,
            message: 'Error fetching user details',
            error: error.message
        });
    }
};

// updateUserProfileAndBankDetails

const updateProfile = async (req, res) => {
    const {
        name,
        email,
        phone,
        old_password,
        new_password,
        full_name,
        bank_name,
        account_no,
        routing_no
    } = req.body;
    const userid = req?.user?.userid;
    const normalizedRole = req?.user?.role?.toLowerCase().replace(/\s+/g, '');
    const isFirmLevelUser = normalizedRole === 'admin' || normalizedRole === 'superadmin';

    try {
        if (!userid) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Unauthorized request'
            });
        }

        const existUser = email ? await User.findUserByEmail(email) : [];
        if (existUser?.userid && existUser.userid !== userid) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Email already exists. Please use a different email'
            });
        }

        const wantsToChangePassword = old_password && new_password;

        if (!isFirmLevelUser && wantsToChangePassword) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'You are not authorized to update profile password'
            });
        }
        let userData = null;
        if (isFirmLevelUser) {
            userData = await User.getFirmDetails(userid);
            if (!userData || Object.keys(userData).length === 0) {
                return res.status(404).json({
                    success: false,
                    status: 404,
                    message: 'User not found'
                });
            }
        } else {
            userData = await User.getUserDetails(userid);
            if (!userData || Object.keys(userData).length === 0) {
                return res.status(404).json({
                    success: false,
                    status: 404,
                    message: 'User not found'
                });
            }
        }


        const bankData = await User.getBankDetailsByUserId(userid);
        const bankInputs = { userid, full_name, bank_name, account_no, routing_no };

        if (!bankData || !bankData.id) {
            const insertBankData = await User.addBankDetails(bankInputs);
            if (!insertBankData) {
                return res.status(500).json({
                    success: false,
                    status: 500,
                    message: 'Error inserting bank details'
                });
            }
        } else {
            const updateBank = await User.updateBankDetails(bankData?.id, bankInputs);
            if (!updateBank) {
                return res.status(500).json({
                    success: false,
                    status: 500,
                    message: 'Error updating bank details'
                });
            }
        }

        if (isFirmLevelUser && wantsToChangePassword) {
            const match = await bcrypt.compare(old_password, userData?.password);
            if (!match) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Old password does not match'
                });
            }

            const hashedPassword = await bcrypt.hash(new_password, 10);
            const updateLoginData = await User.updateUserLogin(userData?.userid, {
                name,
                email,
                phone,
                password: hashedPassword
            });

            if (!updateLoginData) {
                return res.status(500).json({
                    success: false,
                    status: 500,
                    message: 'Error updating login details'
                });
            }
        }
        if (isFirmLevelUser) {
            const updateUser = await User.updateFirmDetails(userData?.id, {
                name,
                email,
                phone
            })
            if (!updateUser) {
                return res.status(500).json({
                    success: false,
                    status: 500,
                    message: 'Error updating user details'
                });
            }
        } else {
            const updateUser = await User.updateUserDetails(userData?.id, {
                name,
                email,
                phone,
            });
            if (!updateUser) {
                return res.status(500).json({
                    success: false,
                    status: 500,
                    message: 'Error updating user details'
                });
            }
        }

        await User.updateUserProfileData(userid, {
            name,
            email,
            phone
        });

        res.status(200).json({
            success: true,
            status: 200,
            message: 'User and bank details updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 500,
            message: 'Error updating details',
            error: error.message
        });
    }
};


// softDeleteAccount
const deleteUserAccount = async (req, res) => {
    const userid = req?.user?.userid;
    const role = req?.user?.role;

    try {
        const result = await deleteAccount(userid, role);
        if (result.userResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                status: 404,
                message: 'User not found or already deleted'
            });
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: 'Account Deleted Successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: 'Error deleting account',
            error: error.message
        });
    }
};


const checkUserHasPermission = async (req, res) => {
    try {
        const userid = req.user?.userid;
        const hasAccess = await User.checkUserAccess(userid);

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                status: 403,
                message: 'You do not have permission to access this resource',
                data: { hasAccess }
            });
        }
        return res.status(200).json({
            success: true,
            status: 200,
            message: 'You have permission to access this resource',
            data: { hasAccess }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: 'Internal server error: ' + error.message,
            error: error.message
        });
    }
}


/**
 * @function trackUserPermissionController
 * @description This endpoint is used to track the user permission
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} - The response object with a JSON payload
 * @throws {Error} - If any error occurs
 */
const trackUserPermissionChangeController = async (req, res) => {
    try {
        const role = req.user?.role;
        const roleData = await getRoleDetails(null, role);
        const role_id = req.user?.role_id;
        const permissions = await getMenuPermissionsByModuleDB(null, role_id);
        if (permissions.length <= 0) {
            return respond(res, false, 403, "Access denied! This role has no permission");
        }
        return res.status(200).json({
            success: true,
            status: 200,
            message: 'User permission fetched successfully',
            data: { permissions }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: 'Internal server error: ' + error.message,
            error: error.message
        });
    }
}


module.exports = {
    login,
    signup,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getUserProfile,
    updateProfile,
    deleteUserAccount,
    checkUserHasPermission,
    trackUserPermissionChangeController,
};

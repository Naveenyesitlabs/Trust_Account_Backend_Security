const { getAdminId } = require('../model/admin/userManagementModel');
const User = require('../model/user/userModel');

// Middleware to check user access based on role and admin permissions
const userAccessMiddleware = async (req, res, next) => {
  // Extract the user id from the request object (populated by authentication middleware)
  const userid = req.user?.userid;

  // Check if the user is an admin
  if (req.user?.role.toLowerCase() === 'admin') {
    // For admin, check if they have explicit access to this resource
    const adminHasAccess = await User.checkAdminAccess(userid);

    // If admin doesn't have access, respond with 401 Unauthorized
    if (!adminHasAccess) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'You do not have permission to access this resource. Contact Admin',
        data: { hasAccess: false }
      });
    }

    // If admin has access, continue to the next middleware or route handler
    return next();
  }

  // For non-admin users, check if their account exists in the database
  const isAccountExist = await User.isUsrAccountExistDB(userid);
  if (!isAccountExist) {
    // If account doesn't exist, respond with 401 Unauthorized
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'You do not have permission to access this resource',
      data: { hasAccess: false }
    });
  }

  // Get the admin id associated with the user
  const adminId = await getAdminId(userid);

  // Check if the user has access to this resource
  const hasAccess = await User.checkUserAccess(userid);

  // Check if the associated admin has access
  const adminHasAccess = await User.checkAdminAccess(adminId);

  // If either user or admin does not have access, respond with 401 Unauthorized
  if (!hasAccess || !adminHasAccess) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'You do not have permission to access this resource',
      data: { hasAccess: false }
    });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
};

// Export the middleware for use in routes
module.exports = { userAccessMiddleware }

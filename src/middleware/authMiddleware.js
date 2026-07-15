const jwt = require('jsonwebtoken');
const getJwtSecret = () => process.env.SECRET_KEY;

const normalizeRole = (role = '') => role.toString().toLowerCase().replace(/\s+/g, '');

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
    // Extract token from Authorization header first, then fall back to HttpOnly cookie
    const bearerToken = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    const cookieToken = req.cookies?.token;
    const token = bearerToken || cookieToken;

    // If no token is provided, respond with 401 Unauthorized
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify the token using the secret key
    jwt.verify(token, getJwtSecret(), (err, user) => {
        if (err) {
            // If token is invalid or expired, respond with 403 Forbidden
            return res.status(403).json({ message: 'Invalid token.' });
        }
        // Attach the decoded user payload to the request object for use in subsequent middleware/routes
        req.user = user;
        // Call next middleware or route handler
        next();
    });
};

// Middleware factory to authorize access based on user roles
const authorizeRole = (allowedRoles) => {
    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));

    // Return a middleware function
    return (req, res, next) => {
        // Check if the user's role is included in the allowedRoles array
        if (normalizedAllowedRoles.includes(normalizeRole(req.user.role))) {
            // Role is allowed, proceed
            next();
        } else {
            // Role not allowed, respond with 403 Forbidden
            return res.status(403).json({ message: 'You do not have access to this route' });
        }
    };
};

// Export authentication and authorization middleware for use in routes
module.exports = { authenticateToken, authorizeRole, normalizeRole };

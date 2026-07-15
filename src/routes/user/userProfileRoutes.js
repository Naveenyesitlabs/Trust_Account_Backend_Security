const express = require('express');
const {
    login,
    signup,
    forgotPassword,
    verifyOtp,
    resetPassword,
    getUserProfile,
    updateProfile,
    deleteUserAccount,
    trackUserPermissionChangeController
} = require('../../controller/user/userController');
const { authenticateToken, authorizeRole } = require('../../middleware/authMiddleware');
const router = express.Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/get-profile', authenticateToken, getUserProfile);
router.put('/update-profile', authenticateToken, updateProfile);
router.delete('/delete-account', authenticateToken, deleteUserAccount);
router.get('/check-user-permission-update', authenticateToken, trackUserPermissionChangeController)



router.get('/protected', authenticateToken, authorizeRole(['user', 'admin', 'superadmin']), (req, res) => {
    res.json({
        message: 'You have access to this protected route',
        user: req.user,
    });
});

module.exports = router;

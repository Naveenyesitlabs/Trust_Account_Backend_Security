const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeRole } = require('../../middleware/authMiddleware');

const {
    addFirmController,
    updateFirmController,
    getFirmByIdController,
    deleteFirmController,
    updateFirmAccessStatusController,
    updateFirmSuspendStatusController,
    addNotificationController,
    getAllNotificationsController,
    markNotificationAsReadController
} = require('../../controller/superAdmin/manageFirmController');

// ➕ Add a new firm
router.post('/add-firm', authenticateToken, authorizeRole(['superadmin']), addFirmController);

// 🔁 Update an existing firm
router.put('/update-firm', authenticateToken, authorizeRole(['superadmin']), updateFirmController);

// 🔍 Get a firm by ID
router.get('/get-allfirm', authenticateToken, authorizeRole(['superadmin']), getFirmByIdController);

// 🗑️ Delete a firm by ID
router.delete('/delete-firm/:id', authenticateToken, authorizeRole(['superadmin']), deleteFirmController);

// 🔒 Update firm access status (granted/denied)
router.put('/update-access-status', authenticateToken, authorizeRole(['superadmin']), updateFirmAccessStatusController);

// ⏸️ Update suspend status route
router.put('/update-suspend-status', authenticateToken, authorizeRole(['superadmin']), updateFirmSuspendStatusController);

// ➕ Add notification
router.post('/add-notification', authenticateToken, authorizeRole(['superadmin']), addNotificationController);

// 📥 Get all notifications
router.get('/get-notifications', authenticateToken, authorizeRole(['superadmin']), getAllNotificationsController);

// ✅ Mark as read
router.put('/mark-as-read', authenticateToken, authorizeRole(['superadmin']), markNotificationAsReadController);



module.exports = router;

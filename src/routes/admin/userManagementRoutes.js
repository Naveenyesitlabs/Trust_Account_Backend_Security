const express = require('express');
const { authenticateToken } = require('../../middleware/authMiddleware');
const {
    addUserManagementController,
    getUserManagementController,
    updateUserManagementController,
    deleteUserManagementController,
    changeAccessStatusController
} = require('../../controller/admin/userManagementController');
const {
    addClientTrustAccountController,
    updateClientTrustAccountController,
    getAllClientTrustAccountsController,
    deleteClientTrustAccountController
} = require('../../controller/admin/clientTrustAccountController');
const { getJurnalEntryController, addJurnalEntryController, updateJurnalEntryController, deleteJurnalEntryController, getAllJurnalEntryController, updateJournalupdateReconciledToLedgersController, updateReconciledToLedgersController, updateReconciledToBankController, addNotesToJournalEntryController } = require('../../controller/admin/JournalEntryController');
const { addClientLedgerController, getAllClientLedgersController, getClientLedgersController, updateClientLedgersController, deleteClientLedgerController, getAllFirmNamesController, getFirms, getClientsByFirm, getClientInfoById, getClientList } = require('../../controller/admin/clientLedgerController');
const { fetchAdminNotifications } = require('../../controller/admin/notificationController');
const { markNotificationAsReadController } = require('../../controller/superAdmin/manageFirmController');
const { addRoleController, getRolesController, deleteRoleController, updateRoleController, getMenuController, getModuleController, getMenuListByModuleController, roleMenuPermissionController, getUsrWiseRolePermissionController, getSelectedModuleController, getRoleByIdController } = require('../../controller/admin/roleController');
const { userAccessMiddleware } = require('../../middleware/accessMiddleware');
const { getCaseInfoById } = require('../../controller/user/caseController');

const router = express.Router();


// Manage_Users__
router.post('/add-usermanagement', authenticateToken, userAccessMiddleware, addUserManagementController);

router.get('/get-usermanagement', authenticateToken, userAccessMiddleware, getUserManagementController);

router.put('/update-usermanagement/:id', authenticateToken, userAccessMiddleware, updateUserManagementController);

router.delete('/delete-usermanagement/:id', authenticateToken, userAccessMiddleware, deleteUserManagementController);

router.patch('/change/access', authenticateToken, userAccessMiddleware, changeAccessStatusController);


// Manage_Clients_Trust_Accounts__
router.post('/add-client-account', authenticateToken, userAccessMiddleware, addClientTrustAccountController);

router.put('/update-client-account/:clientId', authenticateToken, userAccessMiddleware, updateClientTrustAccountController);

router.get('/get-client-accounts', authenticateToken, userAccessMiddleware, getAllClientTrustAccountsController);

router.delete('/delete-client-account/:clientId', authenticateToken, userAccessMiddleware, deleteClientTrustAccountController);

/*                                  * * * * * * * * *  *                                               */
/*----------------------------------* Satyaprakash Roy *---------------------------------------------- */
/*                                  * * * * * * * * *  *                                               */

// Journal_Entry_____
router.post('/add-journal-entry', authenticateToken, userAccessMiddleware, addJurnalEntryController);

router.post('/get-journal-entries', authenticateToken, userAccessMiddleware, getJurnalEntryController);

router.patch('/journal-update_reconciled_to_ledgers/:id', authenticateToken, userAccessMiddleware, updateReconciledToLedgersController);

router.patch('/update-reconciled_to_bank/:id', authenticateToken, userAccessMiddleware, updateReconciledToBankController);

router.put('/trust-journal-add_notes/:id', authenticateToken, userAccessMiddleware, addNotesToJournalEntryController)

router.put('/update-journal-entry/:id', authenticateToken, userAccessMiddleware, updateJurnalEntryController)

router.delete('/delete-journal-entry/:id', authenticateToken, userAccessMiddleware, deleteJurnalEntryController)

router.get('/get-all-journal-entries', authenticateToken, userAccessMiddleware, getAllJurnalEntryController)

// Client Ledger___________
router.post('/add-client-ledger', authenticateToken, userAccessMiddleware, addClientLedgerController);

router.get('/get-all-clienft-ledgers', authenticateToken, userAccessMiddleware, getAllClientLedgersController)

router.post('/get-client-ledger', authenticateToken, userAccessMiddleware, getClientLedgersController);

router.put('/update-client-ledger/:id', authenticateToken, userAccessMiddleware, updateClientLedgersController)

router.delete('/delete-client-ledger/:id', authenticateToken, userAccessMiddleware, deleteClientLedgerController)

router.get('/get-allClient', authenticateToken, userAccessMiddleware, getAllFirmNamesController)

router.get('/get-firms', authenticateToken, userAccessMiddleware, getFirms)

router.post('/get-clients-by-firm', authenticateToken, userAccessMiddleware, getClientsByFirm)

router.get('/get-ledger-clients', authenticateToken, userAccessMiddleware, getClientList)


router.get('/get-client-info/:id', authenticateToken, userAccessMiddleware, getClientInfoById);

// notification routes 
router.get('/get-admin-notifications', authenticateToken, userAccessMiddleware, fetchAdminNotifications);
router.put('/mark-notification-as-read', authenticateToken, userAccessMiddleware, markNotificationAsReadController);


// role routes
router.post('/add-role', authenticateToken, userAccessMiddleware, addRoleController);
router.get('/get-roles', authenticateToken, userAccessMiddleware, getRolesController);
router.put('/update-role/:id', authenticateToken, userAccessMiddleware, updateRoleController);
router.put('/delete-role/:id', authenticateToken, userAccessMiddleware, deleteRoleController);

// menu routes
router.get('/get-menu', authenticateToken, userAccessMiddleware, getMenuController);
router.get('/get-modules', authenticateToken, userAccessMiddleware, getModuleController);
router.post('/get-menu-by-module', authenticateToken, userAccessMiddleware, getMenuListByModuleController);
router.post('/role-menu-permission', authenticateToken, userAccessMiddleware, roleMenuPermissionController);
router.get('/get-user-permissions', authenticateToken, userAccessMiddleware, getUsrWiseRolePermissionController);
router.get('/get-module-by-role/:role_id', authenticateToken, userAccessMiddleware, getSelectedModuleController);
router.get('/role/:id', authenticateToken, userAccessMiddleware, getRoleByIdController);

module.exports = router;
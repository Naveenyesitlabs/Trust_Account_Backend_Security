const express = require('express');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { getOutstandingDepositsAmount } = require('../../controller/user/outstandingDeposits');
const { getOutstandingDisbursementAmount } = require('../../controller/user/outstandingDisbursement');
const { addLedgerClient, getLedgerClients, ledgerClientList } = require('../../controller/user/allClients');
const { getLedgers, updateClient } = require('../../controller/user/clientController');
const { addJurnalEntryController, updateJurnalEntryController, getJurnalEntryController, getAllJurnalEntryController } = require('../../controller/admin/JournalEntryController');
const { clientTrustEntry, clientTrustEntryRecentDocuments } = require("../../controller/user/clientTrustEntryController");
// const multer = require("multer");
const { uploadBankStatement, fetchBankStatements, getLastUploadedBankStatement } = require('../../controller/user/bankStatementController');
const upload = require('../../utils/fileUploader');
const { getClientLedgerSummary, getAllLedgersClient } = require('../../controller/user/clientLedgerSummery');
const { getAllBankLedgers, getBankChargesLedgerClients } = require('../../controller/user/bankLedger');
const { addClientLedgerController } = require('../../controller/admin/clientLedgerController');
const { prepareReconcilement, discardReconciliation, getReconciliationDiscardReasons, confirmReconciliation } = require('../../controller/user/reconciliationController');
const { createMatter, getMatterByClient, addMatterNote, updateResolveStatus, updateLien } = require('../../controller/user/matterController');
const { getModules, fetchReports } = require('../../controller/user/reportController');
const { runMonthlyTask } = require('../../jobs/cronJobs');
const { getLiensController, addLienController, addLienTransactionController, getLienTransactionController } = require('../../controller/user/lienController');
const { getSubscriptionController, initSubscriptionController, getUserSubscriptionController } = require('../../controller/user/subscriptionController');
const { createCheckoutSession, stripeWebhook } = require('../../controller/user/paymentController');
const { getUserNotificationController } = require('../../controller/user/notificationController');
const { checkUserHasPermission } = require('../../controller/user/userController');
const { userAccessMiddleware } = require('../../middleware/accessMiddleware');
const { createCase, getAllCase, getClientsByCase, getCaseInfoById } = require('../../controller/user/caseController');
// Use multer memory storage so we can move files manually in controller
// const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();




router.get('/check-user-has-access', authenticateToken, checkUserHasPermission);

router.get('/outstanding-deposits', authenticateToken, userAccessMiddleware, getOutstandingDepositsAmount);

router.get('/outstanding-disbursement', authenticateToken, userAccessMiddleware, getOutstandingDisbursementAmount);


router.get('/all-clients', authenticateToken, userAccessMiddleware, getLedgerClients);
router.get('/ledger-client-list', authenticateToken, userAccessMiddleware, ledgerClientList);
router.post('/individual-ledgers', authenticateToken, userAccessMiddleware, getLedgers);


router.put('/update/:id', authenticateToken, userAccessMiddleware, updateClient);

// Jurnal Entry Routes

// router.post("/create", addNewJournalEntry);
router.post("/create-jurnal", authenticateToken, userAccessMiddleware, addJurnalEntryController);

router.post("/update-jurnal/:id", authenticateToken, userAccessMiddleware, updateJurnalEntryController);
// router.get("/all", getJournalList);
router.post("/all-jurnals", authenticateToken, userAccessMiddleware, getJurnalEntryController);
router.get('/get-all-banks', authenticateToken, userAccessMiddleware, getAllJurnalEntryController);


// all ledger clients 
router.post("/create-client", authenticateToken, userAccessMiddleware, addLedgerClient);
router.get("/get-all-clients", authenticateToken, userAccessMiddleware, getLedgerClients);
router.post('/add-client-matter', authenticateToken, userAccessMiddleware, createMatter);
router.get('/get-matter-by-client/:ledger_client_id', authenticateToken, userAccessMiddleware, getMatterByClient);


// POST route for uploading client trust entry documents
router.post("/client-trust-entry/upload", authenticateToken, userAccessMiddleware, upload.single('document'), clientTrustEntry);
router.get("/client-trust-entry", authenticateToken, userAccessMiddleware, clientTrustEntryRecentDocuments);


// bank statement routes
router.post('/bank-statement/upload', authenticateToken, userAccessMiddleware, upload.single('statement'), uploadBankStatement);
router.get('/bank-statement', authenticateToken, userAccessMiddleware, fetchBankStatements);
router.get('/get-last-bank-statement', authenticateToken, userAccessMiddleware, getLastUploadedBankStatement);


// Client Ledger Summary Routes
router.post("/client-ledger-summary", authenticateToken, userAccessMiddleware, getClientLedgerSummary);
router.get('/all-ledger-client', authenticateToken, userAccessMiddleware, getAllLedgersClient)


//Bank Ledger
router.post('/get-all-bank-ledger', authenticateToken, userAccessMiddleware, getAllBankLedgers);
router.post('/add-bank-ledger', authenticateToken, userAccessMiddleware, addClientLedgerController)
router.get('/get-bank-ledger-firms', authenticateToken, userAccessMiddleware, getBankChargesLedgerClients);

// Reconciliation
router.post('/genrate-reconciliation', authenticateToken, userAccessMiddleware, prepareReconcilement);
router.post('/save-discard-reason', authenticateToken, userAccessMiddleware, discardReconciliation);
router.post('/get-discard-reason', authenticateToken, userAccessMiddleware, getReconciliationDiscardReasons);
router.post('/save-reconcile-confirmation', authenticateToken, userAccessMiddleware, confirmReconciliation);


// Lien Management 
router.post('/add-lien', authenticateToken, userAccessMiddleware, addLienController);
router.get('/get-lien', authenticateToken, userAccessMiddleware, getLiensController);
router.post('/add-lien-transaction', authenticateToken, userAccessMiddleware, addLienTransactionController);
router.get('/get-lien-transaction/:lien_id', authenticateToken, userAccessMiddleware, getLienTransactionController);
router.put('/update-lien/:id', authenticateToken, userAccessMiddleware, updateLien);
router.put('/add-lien-notes/:id', authenticateToken, userAccessMiddleware, addMatterNote);
router.put('/update-lien-status/:id', authenticateToken, userAccessMiddleware, updateResolveStatus);


// report routes
router.get('/test-report', authenticateToken, userAccessMiddleware, runMonthlyTask);
router.get('/get-report-modules', authenticateToken, userAccessMiddleware, getModules);
router.post('/get-reports', authenticateToken, userAccessMiddleware, fetchReports);


// subscription routes
router.get('/get-subscriptions', getSubscriptionController);
router.post('/init-subscription-payment', authenticateToken, createCheckoutSession);
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.get('/check-user-subscription', authenticateToken, getUserSubscriptionController);


// notification routes
router.get('/get-notification', authenticateToken, userAccessMiddleware, getUserNotificationController);

// case routes
router.post('/case/create', authenticateToken, userAccessMiddleware, createCase);
router.get('/case', authenticateToken, userAccessMiddleware, getAllCase);
router.get('/case/clients/:caseId', authenticateToken, userAccessMiddleware, getClientsByCase);
router.get('/get-case-info/:caseId', authenticateToken, userAccessMiddleware, getCaseInfoById);

router.post('/test-route', authenticateToken, (req, res) => {
  res.json({ message: 'Test route working fine!' });
});


module.exports = router;
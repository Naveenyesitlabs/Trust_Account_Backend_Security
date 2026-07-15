const express = require('express');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { userAccessMiddleware } = require('../../middleware/accessMiddleware');
const { createBankStatementController, getBankStatementsController } = require('../../controller/user/accountsController');
const upload = require('../../utils/fileUploader');

const router = express.Router();

router.post('/upload-statement', authenticateToken, userAccessMiddleware, upload.single('file'), createBankStatementController);
router.get('/get-statement', authenticateToken, userAccessMiddleware, getBankStatementsController);

module.exports = router;

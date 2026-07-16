const fs = require('fs');
const path = require('path');
const { extractPdfData, extractExcelData, extractImageData, extractOfxData } = require('../../utils/extractData');
const { createBankStatement, getBankStatements } = require('../../model/user/accountsModel');
const { resolvePathWithin, sanitizePathSegment } = require('../../utils/pathSafety');






const createBankStatementController = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const safeFileName = sanitizePathSegment(req.file.filename);
        // nosemgrep: uploaded filename is normalized and constrained to the uploads directory.
        const filePath = resolvePathWithin(path.join(process.cwd(), 'src/uploads'), safeFileName);
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        let parsedData;

        if (fileExt === ".pdf") {
            parsedData = await extractPdfData(filePath);
        } else if (fileExt === ".xlsx" || fileExt === ".xls") {
            parsedData = await extractExcelData(filePath);
        } else if ([".png", ".jpg", ".jpeg"].includes(fileExt)) {
            parsedData = await extractImageData(filePath);
        } else if (fileExt === ".ofx" || fileExt === ".qbo") {
            parsedData = await extractOfxData(filePath);
        } else {
            throw new Error("Unsupported file type");
        }

        if (!parsedData || !parsedData.customer_details || !parsedData.account_details) {
            throw new Error('Failed to extract valid data from file.');
        }
        const bankStatementData = {
            user_name: parsedData.customer_details?.customer_name || null,
            bank_name: parsedData.account_details?.bank_name || null,
            account_number: parsedData.account_details?.account_number || null,
            statement_period: parsedData.account_details?.statement_period || null,
            ending_balance: parsedData.balances?.closing_balance || null,
            transaction_details: JSON.stringify(parsedData.transactions) || null,
            daily_balance: parsedData.balances?.opening_balance || null
        };

        const bankStatement = await createBankStatement(bankStatementData);
        res.status(201).json({
            message: 'Bank statement created successfully',
            id: bankStatement.id,
            status: 201,
        });

    } catch (error) {
        res.status(500).json({ message: 'Error creating bank statement: ' + error.message });
    }
};

// getBankStatements

const getBankStatementsController = async (req, res) => {
    try {
        const bankStatements = await getBankStatements();

        if (bankStatements.length === 0) {
            return res.status(404).json({ message: 'No bank statements found.' });
        }
        res.status(200).json({
            status: 200,
            message: 'Bank statement data fetched successfully',
            data: bankStatements
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching bank statements: ' + error.message });
    }
};

module.exports = { createBankStatementController, getBankStatementsController };

const fs = require("fs");
const path = require("path");
const pdf2img = require("node-poppler");
const Tesseract = require("tesseract.js");
const xlsx = require("xlsx");
const { parse: parseOfx } = require("ofx-js");
const { resolvePathWithin, sanitizePathSegment } = require("./pathSafety");


const extractPdfData = async (filePath) => {
    try {

        // nosemgrep: temp_images is a fixed application-owned directory.
        const outputDir = resolvePathWithin(__dirname, "temp_images");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const opts = {
            format: "png",
            out_dir: outputDir,
            out_prefix: "bank_statement",
            page: null // Convert all pages
        };

        await pdf2img.convert(filePath, opts);

        // Get all images from the temp folder
        const images = fs.readdirSync(outputDir)
            .filter(file => file.startsWith("bank_statement") && file.endsWith(".png"))
            .map(file => resolvePathWithin(outputDir, sanitizePathSegment(file)));

        if (images.length === 0) throw new Error("No images found after conversion!");

        let extractedText = "";
        for (const imagePath of images) {
            const { data: { text } } = await Tesseract.recognize(imagePath, "eng");

            extractedText += "\n" + text;
        }


        if (!extractedText.trim()) throw new Error("OCR did not extract any text.");

        return parseBankStatement(extractedText);
    } catch (error) {
        throw new Error("Failed to extract data from scanned PDF.");
    }
};

const parseBankStatement = (text) => {

    const bankStatement = {
        customer_details: { customer_name: null },
        account_details: { bank_name: null, account_number: null, statement_period: null },
        balances: { opening_balance: null, closing_balance: null },
        transactions: []
    };

    const lines = text.split("\n").map(line => line.trim()).filter(line => line);

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("Account Number:")) {
            bankStatement.account_details.account_number = lines[i].split(":")[1].trim();
        } else if (lines[i].includes("Period Covered:")) {
            bankStatement.account_details.statement_period = lines[i].split(":")[1].trim();
        } else if (lines[i].includes("Account Holder:")) {
            bankStatement.customer_details.customer_name = lines[i].split(":")[1].trim();
        } else if (lines[i].includes("Bank Name:")) {
            bankStatement.account_details.bank_name = lines[i].split(":")[1].trim();
        } else if (lines[i].includes("Opening Balance:")) {
            bankStatement.balances.opening_balance = lines[i].split(":")[1].trim();
        } else if (lines[i].includes("Closing Balance:")) {
            bankStatement.balances.closing_balance = lines[i].split(":")[1].trim();
        } else if (lines[i].match(/^\d{2}\/\d{2}\/\d{4}/)) {
            const parts = lines[i].split(/\s{2,}/);
            if (parts.length >= 3) {
                const transaction = {
                    date: parts[0],
                    description: parts[1],
                    debit: parts.length > 3 ? parts[2] : null,
                    credit: parts.length > 3 ? parts[3] : parts[2],
                    balance: parts.length > 3 ? parts[4] : parts[3]
                };
                bankStatement.transactions.push(transaction);
            }
        }
    }

    return bankStatement;
};

// ___

const extractExcelData = async (filePath) => {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        const bankStatement = {
            customer_details: {
                customer_name: jsonData[0]?.["Account Holder"] || "Unknown"
            },
            account_details: {
                bank_name: jsonData[0]?.["Bank Name"] || "Unknown",
                account_number: jsonData[0]?.["Account Number"] || "000-000-000",
                statement_period: jsonData[0]?.["Period Covered"] || "Unknown"
            },
            balances: {
                opening_balance: jsonData[0]?.["Opening Balance"] || "0.00",
                closing_balance: jsonData[jsonData.length - 1]?.["Closing Balance"] || "0.00"
            },
            transactions: jsonData.map(row => ({
                date: row["Date"],
                description: row["Description"],
                debit: row["Debit"] || null,
                credit: row["Credit"] || null,
                balance: row["Balance"] || null
            }))
        };

        return bankStatement;
    } catch (error) {
        throw new Error("Failed to extract data from Excel.");
    }
};

// ___

const extractImageData = async (imagePath) => {
    try {

        if (!fs.existsSync(imagePath)) throw new Error("Image not found");

        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");

        if (!text || !text.trim()) throw new Error("No text extracted from image");

        const parseBankStatement = require('./extractData').parseBankStatement;
        return parseBankStatement(text);
    } catch (error) {
        throw new Error("Failed to extract data from image.");
    }
};

// __
const extractOfxData = async (filePath) => {
    try {
        const ofxContent = fs.readFileSync(filePath, "utf8");
        const { data } = await parseOfx(ofxContent);

        const bankInfo = data?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;

        if (!bankInfo) {
            throw new Error("OFX file is missing required STMTRS section.");
        }

        const transactions = bankInfo?.BANKTRANLIST?.STMTTRN || [];

        const bankStatement = {
            customer_details: {
                customer_name: "Unknown"
            },
            account_details: {
                bank_name: bankInfo.BANKACCTFROM?.BANKID || "Unknown",
                account_number: bankInfo.BANKACCTFROM?.ACCTID || "Unknown",
                statement_period: `${bankInfo.BANKTRANLIST?.DTSTART || "Unknown"} - ${bankInfo.BANKTRANLIST?.DTEND || "Unknown"}`
            },
            balances: {
                opening_balance: bankInfo.LEDGERBAL?.BALAMT || "0.00",
                closing_balance: bankInfo.AVAILBAL?.BALAMT || "0.00"
            },
            transactions: transactions.map(txn => ({
                date: txn.DTPOSTED,
                description: txn.MEMO || txn.NAME || "N/A",
                debit: txn.TRNAMT?.startsWith('-') ? txn.TRNAMT : null,
                credit: !txn.TRNAMT?.startsWith('-') ? txn.TRNAMT : null,
                balance: null
            }))
        };

        return bankStatement;
    } catch (error) {
        throw new Error("Failed to extract data from OFX/QBO file.");
    }
};


module.exports = { extractPdfData, extractExcelData, extractImageData, parseBankStatement, extractOfxData };



// New_updates____
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const bankConfigs = require('../config/bankConfigs');
const { respond, HTTP_STATUS_CODE, extractSection, countMonths, cleanDescription } = require('../utils/reponseHelper');

// define logs directory
const logsDir = path.join(__dirname, '../../src/logs');

// create logs directory if not exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// safe file path
const responseLogFilePath = path.join(
  logsDir,
  `responseLog_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.txt`
);

if (!fs.existsSync(responseLogFilePath)) {
  fs.writeFileSync(responseLogFilePath, '');
}

let _worker = null;
async function getWorker() {
  if (_worker) return _worker;

  try {
    // Use a simple logger function instead of null
    const logger = (m) => console.log(m); // Or use a no-op function: () => {}

    _worker = await Tesseract.createWorker({ logger });
    await _worker.load();

    // Try both approaches with error handling
    try {
      await _worker.loadLanguage('eng');
    } catch (e) {
      // Fallback for older versions
      await _worker.loadLanguage(['eng']);
    }

    await _worker.initialize('eng');

    await _worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO, //Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.$,%/- '
    });

    return _worker;
  } catch (error) {
    console.error('Worker creation failed:', error);
    throw error;
  }
}


const extractIOLTAData = (rawText) => {
  console.log("rawText", rawText);
  fs.appendFileSync(responseLogFilePath, `Raw Text: ${rawText}\n\n`);
  const ownerData = {
    accountNumber: '',
    accountName: '',
    statementPeriod: ''
  };

  // === Extract Metadata (from extractIOLTAData2) ===
  // const accountNumberMatch = rawText.match(/Account\s*Number:\s*~*\s*([0-9]{10,})/i);
  const accountNumberMatch = rawText.match(/Account\s*Number[:\s]*~*\s*([0-9]{10,})/i);
  if (accountNumberMatch) ownerData.accountNumber = accountNumberMatch[1];

  const statementPeriodMatch = rawText.match(/([A-Za-z]+\s\d{1,2},\s\d{4})\s+through\s+([A-Za-z]+\s\d{1,2},\s\d{4})/i);
  if (statementPeriodMatch) {
    const startDate = new Date(statementPeriodMatch[1]);
    const endDate = new Date(statementPeriodMatch[2]);
    ownerData.statementPeriod = {
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
      months: countMonths(startDate, endDate)
    };
  }

  const nameLines = rawText.split('\n');
  for (let i = 0; i < nameLines.length; i++) {
    const line = nameLines[i].trim();
    const nameMatch = line.match(/^([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)$/);
    if (nameMatch) {
      const nextLine = nameLines[i + 1]?.trim() || '';
      const nextNextLine = nameLines[i + 2]?.trim() || '';
      const addressIndicators = [
        /street/i, /avenue/i, /road/i, /lane/i, /drive/i, /boulevard/i,
        /city/i, /state/i, /zip/i, /[A-Z]{2}\s+\d{5}/, /\d{5,6}/,
        /[A-Z][a-z]+,\s+[A-Z]{2}/, /[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z]{2}/
      ];
      const isAddressLine = addressIndicators.some(regex =>
        regex.test(nextLine) || regex.test(nextNextLine)
      );
      if (isAddressLine) {
        ownerData.accountName = nameMatch[1].trim();
        break;
      }
    }
  }

  if (!ownerData.accountName) {
    const index = nameLines.findIndex(line => /Account\s*Number:/i.test(line));
    for (let i = Math.max(0, index - 3); i < Math.min(nameLines.length, index + 3); i++) {
      const line = nameLines[i].trim();
      const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/);
      if (nameMatch && !/statement|account|number|page|chase|bank/i.test(line)) {
        ownerData.accountName = nameMatch[1].trim();
        break;
      }
    }
  }

  if (!ownerData.accountName && nameLines[9]) {
    const match = nameLines[9].trim().match(/^([A-Z][a-z]{2,})\b/);
    if (match) ownerData.accountName = match[1].trim();
  }

  // === Below this line, everything is from extractIOLTAData1 ===
  const statementMonthYear = statementPeriodMatch ? new Date(statementPeriodMatch[2]) : new Date();

  const parseAmount = (amountStr) => {
    const num = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? null : num;
  };

  const formatDate = (dayMonth, referenceDate) => {
    const [month, day] = dayMonth.split('/');
    const date = new Date(referenceDate);
    date.setMonth(parseInt(month) - 1);
    date.setDate(parseInt(day));
    return date.toISOString().split('T')[0];
  };

  const cleanDescription = (desc) => desc.replace(/\s+/g, ' ').trim();

  // const isTotalLine = (desc) => /^\s*Total\s+/i.test(desc);
  const isTotalLine = (desc) => /^\s*Total\s+/i.test(desc) || /Total\s+Checks\s+Paid/i.test(desc);
  const isCheckLine = (desc) => /^\d{4,6}(\s+\*?A)?$/.test(desc);

  const extractSection = (text, start, ends) => {
    const upperText = text.toUpperCase();
    const startIndex = upperText.indexOf(start.toUpperCase());
    if (startIndex === -1) return '';
    const endIndex = Math.min(...ends.map(h =>
      upperText.indexOf(h.toUpperCase(), startIndex + start.length)).filter(i => i !== -1));
    return text.substring(startIndex + start.length, endIndex !== Infinity ? endIndex : undefined).trim();
  };

  const transactions = [];


  // const depositsSection = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
  const depositsSectionOnly = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
  const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);
  const depositsSection = [depositsSectionOnly, withdrawalsSection].filter(Boolean).join('\n');
  // Step 1: Fix reversed check lines (e.g., "5,814.00 1662 * A 01/29")
  // Fix reversed check lines: "$4,571.00 1658 * A 01/26"
  const reversedCheckLineRegex = /^\$?([\d,]+\.\d{2})\s+(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/gm;
  let reversedCheckMatches = [];
  let reversedMatch;

  while ((reversedMatch = reversedCheckLineRegex.exec(depositsSection)) !== null) {
    const [fullLine, amountStr, checkNumber, dateStr] = reversedMatch;
    const amount = parseAmount(amountStr);
    if (amount !== null) {
      transactions.push({
        date: formatDate(dateStr, statementMonthYear),
        checkNumber: checkNumber,
        description: 'Check payment',
        debit: amount,
        credit: 0,
        balance: 0,
        type: 'debit'
      });
      reversedCheckMatches.push(fullLine.replace(/\s+/g, ' ').trim());

    }
  }
  // Handle check lines like: 1658 * A 01/29 4,571.00
  const checkNumberFirstPattern = /^(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;
  let matchCheckNumberFirst;
  while ((matchCheckNumberFirst = checkNumberFirstPattern.exec(depositsSection)) !== null) {
    const [fullLine, checkNumber, dayMonth, amountStr] = matchCheckNumberFirst;
    const amount = parseAmount(amountStr);
    if (amount !== null) {
      transactions.push({
        date: formatDate(dayMonth, statementMonthYear),
        checkNumber: checkNumber,
        description: 'Check payment',
        debit: amount,
        credit: 0,
        balance: 0,
        type: 'debit'
      });
      reversedCheckMatches.push(fullLine.replace(/\s+/g, ' ').trim());
    }
  }


  if (depositsSection) {
    const depositRegex = /(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})/g;

    let match;
    // while ((match = depositRegex.exec(depositsSection)) !== null) {
    //     const [_, dayMonth, description, amount] = match;

    //     if (isTotalLine(description)) continue;
    //     if (isCheckLine(description.trim())) continue;


    //     const parsedAmount = parseAmount(amount);
    //     if (parsedAmount === null) continue;
    //     const reversedCheckMatch = description.match(/^(\d{4,6})(?:\s+\*?A)?$/);
    //     if (reversedCheckMatch) {
    //         const parsedAmount = parseAmount(amount);
    //         if (parsedAmount === null) return;

    //         transactions.push({
    //             date: formatDate(dayMonth, statementMonthYear),
    //             checkNumber: reversedCheckMatch[1],
    //             description: 'Check payment',
    //             debit: parsedAmount,
    //             credit: 0,
    //             balance: 0,
    //             type: 'debit'
    //         });
    //         continue;
    //     }
    //     const checkNumberMatch = description.trim().match(/^(\d{3,6})(\s+\*?A)?$/i);
    //     // if (checkNumberMatch) {
    //     //     transactions.push({
    //     //         date: formatDate(dayMonth, statementMonthYear),
    //     //         checkNumber: checkNumberMatch[1],
    //     //         description: 'Check payment',
    //     //         debit: parsedAmount,
    //     //         credit: 0,
    //     //         balance: 0,
    //     //         type: 'debit'
    //     //     });
    //     // } else {
    //     //     transactions.push({
    //     //         date: formatDate(dayMonth, statementMonthYear),
    //     //         description: cleanDescription(description),
    //     //         debit: 0,
    //     //         credit: parsedAmount,
    //     //         balance: 0,
    //     //         type: 'credit'
    //     //     });
    //     // }
    //     transactions.push({
    //         date: formatDate(dayMonth, statementMonthYear),
    //         description: cleanDescription(description),
    //         debit: 0,
    //         credit: parsedAmount,
    //         balance: 0,
    //         type: 'credit'
    //     });

    // }
    while ((match = depositRegex.exec(depositsSection)) !== null) {
      const [_, dayMonth, description, amount] = match;
      // Skip if line was already processed by reversedCheckLineRegex
      const cleanedLine = match[0].replace(/\s+/g, ' ').trim();
      if (reversedCheckMatches.includes(cleanedLine)) continue;

      if (isTotalLine(description)) continue;
      if (isCheckLine(description.trim())) continue;

      const parsedAmount = parseAmount(amount);
      if (parsedAmount === null) continue;

      const reversedCheckMatch = description.match(/^(\d{4,6})(?:\s+\*?A)?$/);
      if (reversedCheckMatch) {
        transactions.push({
          date: formatDate(dayMonth, statementMonthYear),
          checkNumber: reversedCheckMatch[1],
          description: 'Check payment',
          debit: parsedAmount,
          credit: 0,
          balance: 0,
          type: 'debit'
        });
        continue;
      }

      const checkInlineMatch = description.match(/(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/);
      if (checkInlineMatch) {
        const checkNo = checkInlineMatch[1];
        const realDate = formatDate(checkInlineMatch[2], statementMonthYear);
        transactions.push({
          date: realDate,
          checkNumber: checkNo,
          description: 'Check payment',
          debit: parsedAmount,
          credit: 0,
          balance: 0,
          type: 'debit'
        });
        continue;
      }

      transactions.push({
        date: formatDate(dayMonth, statementMonthYear),
        description: cleanDescription(description),
        debit: 0,
        credit: parsedAmount,
        balance: 0,
        type: 'credit'
      });
    }

  }
  // console.log("deposit transactions", transactions);

  const checksSections = [
    extractSection(rawText, 'DATE\nCHECK NO. DESCRIPTION PAID AMOUNT', ['OTHER WITHDRAWALS', 'DAILY ENDING BALANCE']),
    extractSection(rawText, 'CHECKS PAID', ['OTHER WITHDRAWALS', 'DAILY ENDING BALANCE'])
  ].filter(Boolean);
  checksSections.forEach(section => {
    const lineRegex = /^(\d{4,6})\s+\*?A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;
    let match;
    while ((match = lineRegex.exec(section)) !== null) {
      const [_, checkNo, dayMonth, amount] = match;

      if (isTotalLine(checkNo)) continue;

      const parsedAmount = parseAmount(amount);
      if (parsedAmount === null) continue;

      transactions.push({
        date: formatDate(dayMonth, statementMonthYear),
        checkNumber: checkNo.trim(),
        description: 'Check payment',
        debit: parsedAmount,
        credit: 0,
        balance: 0,
        type: 'debit'
      });
    }
  });

  // checksSections.forEach(section => {
  //     const patterns = [
  //         /(\d{3,5})\s+\*?A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/g,
  //         /(\d{2}\/\d{2})\s+(\d{3,5})\s+\$?([\d,]+\.\d{2})/g,
  //         /^(\d{3,5})\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm
  //     ];
  //     for (const regex of patterns) {
  //         let match;
  //         while ((match = regex.exec(section)) !== null) {
  //             let checkNo, dayMonth, amount;
  //             if (match[1].includes('/')) [, dayMonth, checkNo, amount] = match;
  //             else[, checkNo, dayMonth, amount] = match;

  //             if (!checkNo || !dayMonth || !amount) continue;
  //             if (isTotalLine(checkNo)) continue;
  //             const parsedAmount = parseAmount(amount);
  //             if (parsedAmount === null) continue;

  //             transactions.push({
  //                 date: formatDate(dayMonth, statementMonthYear),
  //                 checkNumber: checkNo.trim(),
  //                 description: 'Check payment',
  //                 debit: parsedAmount,
  //                 credit: 0,
  //                 balance: 0,
  //                 type: 'debit'
  //             });
  //         }
  //     }
  // });
  // console.log("check transactions", transactions);

  // const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);
  // if (withdrawalsSection) {
  //     const withdrawalRegex = /(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})/g;
  //     let match;
  //     while ((match = withdrawalRegex.exec(withdrawalsSection)) !== null) {
  //         const [_, dayMonth, description, amount] = match;
  //         if (isTotalLine(description)) continue;

  //         const parsedAmount = parseAmount(amount);
  //         if (parsedAmount === null) continue;

  //         transactions.push({
  //             date: formatDate(dayMonth, statementMonthYear),
  //             description: cleanDescription(description),
  //             debit: parsedAmount,
  //             credit: 0,
  //             balance: 0,
  //             type: 'debit'
  //         });
  //     }
  // } console.log("withdrwals transactions", transactions);

  const seen = new Set();
  const uniqueTransactions = [];
  // transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  // console.log("all transactions", transactions);
  for (const tx of transactions) {
    const id = `${tx.date}-${tx.debit || 0}-${tx.credit || 0}-${tx.checkNumber || ''}`;
    if (!seen.has(id)) {
      seen.add(id);
      uniqueTransactions.push(tx);
    }
  }
  // ✅ Sort transactions by date (ascending)
  uniqueTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log("unique transactions", uniqueTransactions);
  fs.appendFileSync(responseLogFilePath, `Unique transactions: ${uniqueTransactions}\n\n`);
  return {
    ownerData,
    transaction_count: uniqueTransactions.length,
    transactions: uniqueTransactions
  };
};



/**
 * to remove duplicates in transactions
 * @param {*} data 
 * @returns 
 */
function removeDuplicateTransactions(data) {
  const transactions = data.transactions;
  const result = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const amount = tx.debit || tx.credit;
    const date = new Date(tx.date);
    const checkNumber = tx.checkNumber || null;
    const description = tx.description || "";

    let isDuplicate = false;

    for (let j = 0; j < result.length; j++) {
      const existing = result[j];
      const existingAmount = existing.debit || existing.credit;
      const existingCheckNumber = existing.checkNumber || null;
      const existingDescription = existing.description || "";
      const existingDate = new Date(existing.date);

      const amountMatch = existingAmount === amount;

      // Optional: Accept date range of ±3 days
      const dateDiff = Math.abs((existingDate - date) / (1000 * 60 * 60 * 24)); // in days
      const dateCloseEnough = dateDiff <= 3;

      if (amountMatch && dateCloseEnough) {
        // Case 1: current has checkNumber, existing has that number in description
        if (
          checkNumber &&
          existingDescription.includes(checkNumber)
        ) {
          // Remove existing, keep current
          result.splice(j, 1);
          break;
        }

        // Case 2: existing has checkNumber, current has it in description
        if (
          existingCheckNumber &&
          description.includes(existingCheckNumber)
        ) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      result.push(tx);
    }
  }

  return {
    ...data,
    transactions: result,
    transaction_count: result.length
  };
}



/**
 * Parsing detailed data like starting, ending balance from IOLTA bank statement
 * @param {*} rawText 
 * @returns 
 */
const extractIOLTADetails = (rawText) => {
  const result = {
    bankName: '',
    beginningBalance: 0,
    endingBalance: 0,
    interestPaid: 0,
    dailyBalances: [],
    ...extractIOLTAData(rawText)
  };

  // Bank name extraction (unchanged)
  const bankNameMatch = rawText.match(/([A-Za-z ,&-]+Bank[^a-z]*(?:,? N\.?A\.?)?)/i);
  if (bankNameMatch) {
    result.bankName = bankNameMatch[0]
      .replace(/~+/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (result.bankName.endsWith(',')) {
      result.bankName = result.bankName.slice(0, -1).trim();
    }
    if (result.bankName.includes('N.A.')) {
      result.bankName = result.bankName.replace(/\s*N\.?A\.?/i, ', N.A.').trim();
    }
  }

  // Beginning balance extraction (unchanged)
  const beginningBalanceRegex = /(?:Beginning|Starting|Opening)\s+Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i;
  const beginningBalanceMatch = rawText.match(beginningBalanceRegex);
  // console.log("beginningBalanceMatch", beginningBalanceMatch);
  if (beginningBalanceMatch) {
    // console.log("beginningBalanceMatch[1]", beginningBalanceMatch[1]);
    result.beginningBalance = parseFloat(beginningBalanceMatch[1].replace(/,/g, ''));
    // console.log("result.beginningBalance", result.beginningBalance);
  }

  // NEW: Enhanced ending balance extraction
  const endingBalancePatterns = [
    /Ending Balance\s+.*?\$?\s*([\d,]+\.\d{2})/i,  // Matches "Ending Balance 21 $260,618.88"
    /Ending Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /Closing Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /Balance\s+as\s+of\s+.*?\$?\s*([\d,]+\.\d{2})/i,
    /Final Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    /New Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i
  ];

  let endingBalanceMatch = null;
  for (const pattern of endingBalancePatterns) {
    endingBalanceMatch = rawText.match(pattern);
    if (endingBalanceMatch) break;
  }

  if (endingBalanceMatch) {
    result.endingBalance = parseFloat(endingBalanceMatch[1].replace(/,/g, ''));
  }

  // Interest paid extraction (unchanged)
  const interestMatch = rawText.match(/Interest\s+(?:Paid|Earned)\s+(?:This\s+Period|for\s+Period)\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i);
  if (interestMatch) {
    result.interestPaid = parseFloat(interestMatch[1].replace(/,/g, ''));
  }

  // Daily balances extraction
  const dailyBalanceSection = extractSection(rawText, 'DAILY ENDING BALANCE', ['IN CASE OF ERRORS']);
  if (dailyBalanceSection) {
    const balanceRegex = /(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/g;
    let balanceMatch;

    while ((balanceMatch = balanceRegex.exec(dailyBalanceSection)) !== null) {
      const [_, date, amount] = balanceMatch;
      result.dailyBalances.push({
        date: formatDate(date, result.ownerData.statementPeriod ?
          new Date(result.ownerData.statementPeriod.to) :
          new Date()),
        amount: parseFloat(amount.replace(/,/g, ''))
      });
    }

    // Fallback: If ending balance wasn't found elsewhere, use the last daily balance
    if (result.endingBalance === 0 && result.dailyBalances.length > 0) {
      result.endingBalance = result.dailyBalances[result.dailyBalances.length - 1].amount;
    }
  }

  const cleanedData = removeDuplicateTransactions(result);
  // console.log("cleanedData", cleanedData);
  return cleanedData;
};

// Helper function to format dates (reused from your existing code)
const formatDate = (dayMonth, referenceDate) => {
  const [month, day] = dayMonth.split('/');
  const date = new Date(referenceDate);
  date.setMonth(parseInt(month) - 1);
  date.setDate(parseInt(day));
  return date.toISOString().split('T')[0];
};


/**
 * Converts a PDF to a series of high-resolution, OCR-friendly images.
 * Applies image preprocessing for better recognition.
 * @param {string} pdfPath - Path to the PDF file.
 * @param {string} outputDir - Directory to save the output images.
 * @returns {Promise<Array>} - Array of image path objects with page numbers.
 */
const pdfToImage = async (pdfPath, outputDir) => {
  try {
    const fs = require("fs/promises");
    const path = require("path");
    const sharp = require("sharp");
    const { Poppler } = require("node-poppler");

    const imagePaths = [];
    const poppler = new Poppler();
    const outputPrefix = path.join(outputDir, "page");

    await fs.mkdir(outputDir, { recursive: true });
    await poppler.pdfToCairo(pdfPath, outputPrefix, {
      pngFile: true,
      resolutionXYAxis: 300
    });

    const generatedFiles = (await fs.readdir(outputDir))
      .filter((file) => file.startsWith("page") && file.toLowerCase().endsWith(".png"))
      .sort((a, b) => {
        const aNumber = Number((a.match(/(\d+)/) || [0, 0])[1]);
        const bNumber = Number((b.match(/(\d+)/) || [0, 0])[1]);
        return aNumber - bNumber;
      });

    let counter = 1;
    for (const generatedFile of generatedFiles) {
      const rawImagePath = path.join(outputDir, generatedFile);
      const finalImagePath = path.join(outputDir, `processed_${counter}.png`);

      await sharp(rawImagePath)
        .resize({ width: 2400 })   // upsample more for crisper digits
        .grayscale()               // remove color noise
        .normalize()               // boost contrast
        .sharpen()                 // enhance edges around digit loops
        .threshold(190)            // binarize; adjust 170–200 if needed
        .toFile(finalImagePath);

      imagePaths.push({ page: counter, path: finalImagePath });
      counter++;
    }

    return imagePaths;
  } catch (err) {
    console.error("pdfToImage error:", err);
    throw err;
  }
};

/**
 * Uses Tesseract to extract text from a given image.
 * @param {string} imagePath - Path to the image file.
 * @returns {Promise<string>} - Extracted text.
 */
const proccessWithTesseract = async (imagePath) => {
  try {
    // const result = await Tesseract.recognize(imagePath, 'eng');
    // return result.data.text;

    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(imagePath);
    return text;
  } catch (e) {
    console.log(e);
  }
}

/**
 * Main OCR processing pipeline. Converts PDFs to images (if needed), runs OCR,
 * detects account info, and parses transactions.
 * @param {string} filePath - Path to the input file (PDF or image).
 * @param {string} bank_name - Bank name (should match config).
 * @param {string} type - File type: 'pdf' or 'image'.
 * @param {string} outputDir - Directory to store intermediate image files.
 * @returns {Object} - Extracted account and parsed transaction data.
 */
const proccessOcr = async (filePath, type, outputDir = null) => {
  outputDir = path.join(__dirname, '../../src/uploads/pdfToImages');
  // console.log("outputDir: ", outputDir);
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let parsedResult = null;

    if (type === 'pdf' || type === 'application/pdf') {
      // Convert PDF to images
      const pdfToImagePaths = await pdfToImage(filePath, outputDir);

      let fullText = '';
      const textsPerPage = [];

      for (const image of pdfToImagePaths) {
        const text = await proccessWithTesseract(image.path);

        fullText += `\n--- PAGE ${image.page} ---\n${text}`;
        textsPerPage.push({ page: image.page, text });
      }
      console.log("fullText >>> ", fullText);
      // extracting required data from the OCR result raw text
      parsedResult = extractIOLTADetails(fullText)

    } else if (type === 'image') {
      // OCR directly on image
      const text = await proccessWithTesseract(filePath);
      // extracting required data from the OCR result raw text
      parsedResult = extractIOLTADetails(text)
    }
    fs.appendFileSync(responseLogFilePath, `Final Parsed result: ${JSON.stringify(parsedResult, null, 2)}\n\n`);
    return parsedResult;
  } catch (err) {
    console.error("OCR Error:", err);
    return false;
  }
};


module.exports = { proccessOcr };

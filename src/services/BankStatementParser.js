

// New_updates____
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const bankConfigs = require('../config/bankConfigs');
const { respond, HTTP_STATUS_CODE, extractSection, countMonths, cleanDescription } = require('../utils/reponseHelper');
const { resolvePathWithin, sanitizePathSegment } = require('../utils/pathSafety');

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

async function preprocessImage(input, output) {
    await sharp(input)
        .grayscale()
        .normalize()
        .sharpen()
        .threshold(180)
        .png({ quality: 100 })
        .toFile(output);

    return output;
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

        // await _worker.setParameters({
        //     tessedit_pageseg_mode: Tesseract.PSM.AUTO, //Tesseract.PSM.SINGLE_BLOCK,
        //     tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.$,%/- '
        // });
        await _worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
            preserve_interword_spaces: '1'
        });

        return _worker;
    } catch (error) {
        throw error;
    }
}


// const extractIOLTAData = (rawText) => {
//     fs.appendFileSync(responseLogFilePath, `Raw Text: ${rawText}\n\n`);
//     const ownerData = {
//         accountNumber: '',
//         accountName: '',
//         statementPeriod: ''
//     };

//     // === Extract Metadata (from extractIOLTAData2) ===
//     // const accountNumberMatch = rawText.match(/Account\s*Number:\s*~*\s*([0-9]{10,})/i);
//     const accountNumberMatch = rawText.match(/Account\s*Number[:\s]*~*\s*([0-9]{10,})/i);
//     if (accountNumberMatch) ownerData.accountNumber = accountNumberMatch[1];

//     const statementPeriodMatch = rawText.match(/([A-Za-z]+\s\d{1,2},\s\d{4})\s+through\s+([A-Za-z]+\s\d{1,2},\s\d{4})/i);
//     if (statementPeriodMatch) {
//         const startDate = new Date(statementPeriodMatch[1]);
//         const endDate = new Date(statementPeriodMatch[2]);
//         ownerData.statementPeriod = {
//             from: startDate.toISOString().split('T')[0],
//             to: endDate.toISOString().split('T')[0],
//             months: countMonths(startDate, endDate)
//         };
//     }

//     const nameLines = rawText.split('\n');
//     for (let i = 0; i < nameLines.length; i++) {
//         const line = nameLines[i].trim();
//         const nameMatch = line.match(/^([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)$/);
//         if (nameMatch) {
//             const nextLine = nameLines[i + 1]?.trim() || '';
//             const nextNextLine = nameLines[i + 2]?.trim() || '';
//             const addressIndicators = [
//                 /street/i, /avenue/i, /road/i, /lane/i, /drive/i, /boulevard/i,
//                 /city/i, /state/i, /zip/i, /[A-Z]{2}\s+\d{5}/, /\d{5,6}/,
//                 /[A-Z][a-z]+,\s+[A-Z]{2}/, /[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z]{2}/
//             ];
//             const isAddressLine = addressIndicators.some(regex =>
//                 regex.test(nextLine) || regex.test(nextNextLine)
//             );
//             if (isAddressLine) {
//                 ownerData.accountName = nameMatch[1].trim();
//                 break;
//             }
//         }
//     }

//     if (!ownerData.accountName) {
//         const index = nameLines.findIndex(line => /Account\s*Number:/i.test(line));
//         for (let i = Math.max(0, index - 3); i < Math.min(nameLines.length, index + 3); i++) {
//             const line = nameLines[i].trim();
//             const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/);
//             if (nameMatch && !/statement|account|number|page|chase|bank/i.test(line)) {
//                 ownerData.accountName = nameMatch[1].trim();
//                 break;
//             }
//         }
//     }

//     if (!ownerData.accountName && nameLines[9]) {
//         const match = nameLines[9].trim().match(/^([A-Z][a-z]{2,})\b/);
//         if (match) ownerData.accountName = match[1].trim();
//     }

//     // === Below this line, everything is from extractIOLTAData1 ===
//     const statementMonthYear = statementPeriodMatch ? new Date(statementPeriodMatch[2]) : new Date();

//     const parseAmount = (amountStr) => {
//         const num = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
//         return isNaN(num) ? null : num;
//     };

//     // Helper function to format dates and add 1 day
//     const formatDate = (dayMonth, referenceDate) => {
//         const [month, day] = dayMonth.split('/');
//         const date = new Date(referenceDate);
//         date.setMonth(parseInt(month) - 1);
//         date.setDate(parseInt(day));

//         // Add 1 day
//         date.setDate(date.getDate() + 1);

//         return date.toISOString().split('T')[0];
//     };


//     const cleanDescription = (desc) => desc.replace(/\s+/g, ' ').trim();

//     const isTotalLine = (desc) => /^\s*Total\s+/i.test(desc) || /Total\s+Checks\s+Paid/i.test(desc);
//     const isCheckLine = (desc) => /^\d{4,6}(\s+\*?A)?$/.test(desc);

//     const extractSection = (text, start, ends) => {
//         const upperText = text.toUpperCase();
//         const startIndex = upperText.indexOf(start.toUpperCase());
//         if (startIndex === -1) return '';
//         const endIndex = Math.min(...ends.map(h =>
//             upperText.indexOf(h.toUpperCase(), startIndex + start.length)).filter(i => i !== -1));
//         return text.substring(startIndex + start.length, endIndex !== Infinity ? endIndex : undefined).trim();
//     };

//     const transactions = [];

//     const depositsSectionOnly = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
//     const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);
//     const depositsSection = [depositsSectionOnly, withdrawalsSection].filter(Boolean).join('\n');
//     const reversedCheckLineRegex = /^\$?([\d,]+\.\d{2})\s+(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/gm;
//     let reversedCheckMatches = [];
//     let reversedMatch;

//     while ((reversedMatch = reversedCheckLineRegex.exec(depositsSection)) !== null) {
//         const [fullLine, amountStr, checkNumber, dateStr] = reversedMatch;
//         const amount = parseAmount(amountStr);
//         if (amount !== null) {
//             transactions.push({
//                 date: formatDate(dateStr, statementMonthYear),
//                 checkNumber: checkNumber,
//                 description: 'Check payment',
//                 debit: amount,
//                 credit: 0,
//                 balance: 0,
//                 type: 'debit'
//             });
//             reversedCheckMatches.push(fullLine.replace(/\s+/g, ' ').trim());

//         }
//     }
//     // Handle check lines like: 1658 * A 01/29 4,571.00
//     const checkNumberFirstPattern = /^(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;
//     let matchCheckNumberFirst;
//     while ((matchCheckNumberFirst = checkNumberFirstPattern.exec(depositsSection)) !== null) {
//         const [fullLine, checkNumber, dayMonth, amountStr] = matchCheckNumberFirst;
//         const amount = parseAmount(amountStr);
//         if (amount !== null) {
//             transactions.push({
//                 date: formatDate(dayMonth, statementMonthYear),
//                 checkNumber: checkNumber,
//                 description: 'Check payment',
//                 debit: amount,
//                 credit: 0,
//                 balance: 0,
//                 type: 'debit'
//             });
//             reversedCheckMatches.push(fullLine.replace(/\s+/g, ' ').trim());
//         }
//     }

//     if (depositsSection) {
//         const depositRegex = /(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})/g;

//         let match;

//         while ((match = depositRegex.exec(depositsSection)) !== null) {
//             const [_, dayMonth, description, amount] = match;
//             // Skip if line was already processed by reversedCheckLineRegex
//             const cleanedLine = match[0].replace(/\s+/g, ' ').trim();
//             if (reversedCheckMatches.includes(cleanedLine)) continue;

//             if (isTotalLine(description)) continue;
//             if (isCheckLine(description.trim())) continue;

//             const parsedAmount = parseAmount(amount);
//             if (parsedAmount === null) continue;

//             const reversedCheckMatch = description.match(/^(\d{4,6})(?:\s+\*?A)?$/);
//             if (reversedCheckMatch) {
//                 transactions.push({
//                     date: formatDate(dayMonth, statementMonthYear),
//                     checkNumber: reversedCheckMatch[1],
//                     description: 'Check payment',
//                     debit: parsedAmount,
//                     credit: 0,
//                     balance: 0,
//                     type: 'debit'
//                 });
//                 continue;
//             }

//             const checkInlineMatch = description.match(/(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/);
//             if (checkInlineMatch) {
//                 const checkNo = checkInlineMatch[1];
//                 const realDate = formatDate(checkInlineMatch[2], statementMonthYear);
//                 transactions.push({
//                     date: realDate,
//                     checkNumber: checkNo,
//                     description: 'Check payment',
//                     debit: parsedAmount,
//                     credit: 0,
//                     balance: 0,
//                     type: 'debit'
//                 });
//                 continue;
//             }

//             transactions.push({
//                 date: formatDate(dayMonth, statementMonthYear),
//                 description: cleanDescription(description),
//                 debit: 0,
//                 credit: parsedAmount,
//                 balance: 0,
//                 type: 'credit'
//             });
//         }
//     }

//     const checksSections = [
//         extractSection(rawText, 'DATE\nCHECK NO. DESCRIPTION PAID AMOUNT', ['OTHER WITHDRAWALS', 'DAILY ENDING BALANCE']),
//         extractSection(rawText, 'CHECKS PAID', ['OTHER WITHDRAWALS', 'DAILY ENDING BALANCE'])
//     ].filter(Boolean);
//     checksSections.forEach(section => {
//         const lineRegex = /^(\d{4,6})\s+\*?A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;
//         let match;
//         while ((match = lineRegex.exec(section)) !== null) {
//             const [_, checkNo, dayMonth, amount] = match;

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
//     });


//     const seen = new Set();
//     const uniqueTransactions = [];
//     for (const tx of transactions) {
//         const id = `${tx.date}-${tx.debit || 0}-${tx.credit || 0}-${tx.checkNumber || ''}`;
//         if (!seen.has(id)) {
//             seen.add(id);
//             uniqueTransactions.push(tx);
//         }
//     }
//     // ✅ Sort transactions by date (ascending)
//     uniqueTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
//     fs.appendFileSync(responseLogFilePath, `Unique transactions: ${uniqueTransactions}\n\n`);
//     return {
//         ownerData,
//         transaction_count: uniqueTransactions.length,
//         transactions: uniqueTransactions
//     };
// };



// const extractIOLTAData = (rawText) => {
//     fs.appendFileSync(responseLogFilePath, `Raw Text: ${rawText}\n\n`);
//     const ownerData = {
//         accountNumber: '',
//         accountName: '',
//         statementPeriod: ''
//     };

//     // === Extract Metadata ===
//     const accountNumberMatch = rawText.match(/Account\s*Number[:\s]*~*\s*([0-9]{6,})/i);
//     if (accountNumberMatch) ownerData.accountNumber = accountNumberMatch[1];


//     const statementPeriodMatch = rawText.match(/([A-Za-z]+\s\d{1,2},\s\d{4})\s*[-–]\s*([A-Za-z]+\s\d{1,2},\s\d{4})/i)
//         || rawText.match(/Statement\s*Period\s*([A-Za-z]+\s\d{1,2},?\s\d{4})\s*[-–]\s*([A-Za-z]+\s\d{1,2},?\s\d{4})/i);
//     if (statementPeriodMatch) {
//         const startDate = new Date(statementPeriodMatch[1]);
//         const endDate = new Date(statementPeriodMatch[2]);
//         ownerData.statementPeriod = {
//             from: startDate.toISOString().split('T')[0],
//             to: endDate.toISOString().split('T')[0],
//             months: countMonths(startDate, endDate)
//         };
//     }

//     // === Account Name Detection (unchanged, but tolerant) ===
//     const nameLines = rawText.split('\n');
//     for (let i = 0; i < nameLines.length; i++) {
//         const line = nameLines[i].trim();
//         if (/BANK\s*STATEMENT/i.test(line)) continue;
//         const nameMatch = line.match(/^([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)$/);
//         if (nameMatch) {
//             const nextLine = nameLines[i + 1]?.trim() || '';
//             const isAddressLine = /(street|avenue|road|lane|drive|boulevard|california|india|town|po box|p o box)/i.test(nextLine);
//             if (isAddressLine) {
//                 ownerData.accountName = nameMatch[1];
//                 break;
//             }
//         }
//     }

//     // === Account Name Fallback ===
//     if (!ownerData.accountName) {
//         // Take first line after "Account Number" if it looks like a name
//         const accLineIndex = nameLines.findIndex(l => /Account\s*Number/i.test(l));
//         if (accLineIndex !== -1 && nameLines[accLineIndex + 1]) {
//             const line = nameLines[accLineIndex + 1].trim();
//             if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(line)) {
//                 ownerData.accountName = line;
//             }
//         }
//     }



//     // === Helpers ===
//     const statementMonthYear = statementPeriodMatch ? new Date(statementPeriodMatch[2]) : new Date();
//     // Helper function to format dates and add 1 day (used for check date normalization)
//     const formatDate = (dayMonth, referenceDate) => {
//         if (!dayMonth) return null;
//         const [month, day] = dayMonth.split('/');
//         const date = new Date(referenceDate);
//         date.setMonth(parseInt(month) - 1);
//         date.setDate(parseInt(day));

//         // Add 1 day (as per original logic)
//         date.setDate(date.getDate() + 1);

//         return date.toISOString().split('T')[0];
//     };


//     // === Statement Period Fallback (MM/DD/YY) ===
//     if (!ownerData.statementPeriod) {
//         const mmddyyMatch = rawText.match(/(\d{2}\/\d{2}\/\d{2,4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{2,4})/);
//         if (mmddyyMatch) {
//             const startDate = new Date(mmddyyMatch[1]);
//             const endDate = new Date(mmddyyMatch[2]);
//             ownerData.statementPeriod = {
//                 from: startDate.toISOString().split('T')[0],
//                 to: endDate.toISOString().split('T')[0],
//                 months: countMonths(startDate, endDate)
//             };
//         }
//     }



//     const parseAmount = (str) => {
//         if (!str) return null;
//         const num = parseFloat(String(str).replace(/[^\d.-]/g, ''));
//         return isNaN(num) ? null : num;
//     };

//     // date parsing that supports MM/DD, MM/DD/YY, MM/DD/YYYY
//     const parseDateFlexible = (dateStr, referenceDate) => {
//         if (!dateStr) return null;
//         const cleaned = dateStr.trim();
//         // Try MM/DD/YYYY
//         let parts = cleaned.split('/');
//         if (parts.length === 3) {
//             // handle MM/DD/YY or MM/DD/YYYY
//             let [m, d, y] = parts.map(p => p.replace(/\D/g, ''));
//             if (y.length === 2) {
//                 // guess 20xx for 00-49 -> 2000-2049, else 1900+
//                 const yNum = parseInt(y, 10);
//                 y = (yNum <= 49) ? ('20' + y) : ('19' + y);
//             }
//             const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
//             if (!isNaN(dt)) return dt.toISOString().split('T')[0];
//         } else if (parts.length === 2) {
//             // MM/DD — use referenceDate's year
//             const year = referenceDate ? new Date(referenceDate).getFullYear() : new Date().getFullYear();
//             const [m, d] = parts.map(p => p.replace(/\D/g, ''));
//             const dt = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
//             if (!isNaN(dt)) return dt.toISOString().split('T')[0];
//         }
//         // fallback
//         const tryDt = new Date(cleaned);
//         if (!isNaN(tryDt)) return tryDt.toISOString().split('T')[0];
//         return null;
//     };

//     const cleanDescription = (desc) => desc ? desc.replace(/\s+/g, ' ').trim() : '';

//     // === Detect format type ===
//     const isChaseFormat = /DEPOSITS AND ADDITIONS/i.test(rawText) || /CHECKS PAID/i.test(rawText);
//     // Friendly has "Detail Transactions Journal" plus header "Date Transaction Credit Debit Balance"
//     const isFriendlyFormat = /Detail Transactions Journal/i.test(rawText)
//         || /Date\s+Transaction\s+Credit\s+Debit\s+Balance/i.test(rawText)
//         || /Checks Cleared/i.test(rawText);

//     const transactions = [];

//     // === CASE 1: Chase Format (existing logic, slightly enhanced for optional trailing balance) ===
//     if (isChaseFormat) {
//         const depositsSection = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
//         const checkSection = extractSection(rawText, 'CHECKS PAID', ['OTHER WITHDRAWALS', 'DAILY ENDING BALANCE']);
//         const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);

//         const combinedSections = [depositsSection, checkSection, withdrawalsSection].filter(Boolean).join('\n');

//         // allow optional trailing balance after amount
//         const lineRegex = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})(?:\s+\$?([\d,]+\.\d{2}))?/g;
//         let match;
//         while ((match = lineRegex.exec(combinedSections)) !== null) {
//             const [_, dateStr, desc, amt, maybeBalance] = match;
//             const amount = parseAmount(amt);
//             if (amount === null) continue;
//             const type = /(deposit|credit|interest|payment|addition|remote)/i.test(desc) ? 'credit' : 'debit';
//             const date = parseDateFlexible(dateStr, statementMonthYear);
//             transactions.push({
//                 date: date || formatDate(dateStr, statementMonthYear),
//                 description: cleanDescription(desc),
//                 debit: type === 'debit' ? amount : 0,
//                 credit: type === 'credit' ? amount : 0,
//                 balance: maybeBalance ? parseAmount(maybeBalance) : 0,
//                 type
//             });
//         }
//     }


//     // === CASE 2: Friendly Bank (explicit Credit / Debit / Balance columns) ===
//     if (isFriendlyFormat) {
//         // Try to extract the block starting at header. Many variants: "Detail Transactions Journal" or "Date Transaction Credit Debit Balance"
//         let detailSection = extractSection(rawText, 'Detail Transactions Journal', ['Checks Cleared', 'Daily Balances', 'DAILY ENDING BALANCE']);
//         if (!detailSection) {
//             // fallback: find header and take next chunk
//             const headerIndex = rawText.search(/Date\s+Transaction\s+Credit\s+Debit\s+Balance/i);
//             if (headerIndex !== -1) {
//                 detailSection = rawText.substring(headerIndex);
//                 // cut off at Checks Cleared or Daily Balances if present
//                 const endCut = detailSection.search(/Checks Cleared|Daily Balances|DAILY ENDING BALANCE/i);
//                 if (endCut !== -1) detailSection = detailSection.substring(0, endCut);
//             } else {
//                 // last fallback: try "Account Summary" -> "Checks Cleared"
//                 detailSection = extractSection(rawText, 'Account Summary', ['Checks Cleared', 'Daily Balances']) || '';
//             }
//         }

//         // Fallback: if extractSection failed, try to find from "Detail Transactions Journal" manually
//         if (!detailSection || detailSection.trim().length < 20) {
//             const startIdx = rawText.search(/Detail\s+Transactions\s+Journal/i);
//             if (startIdx !== -1) {
//                 // take from header line to either Checks Cleared or Daily Balances
//                 detailSection = rawText.substring(startIdx);
//                 const endIdx = detailSection.search(/Checks\s+Cleared|Daily\s+Balances|DAILY\s+ENDING\s+BALANCE/i);
//                 if (endIdx !== -1) detailSection = detailSection.substring(0, endIdx);
//             }
//         }


//         const lines = detailSection.split('\n').map(l => l.trim()).filter(Boolean);

//         // Several possible row shapes:
//         // 1) Date Transaction Credit Debit Balance  => all three numeric columns present
//         //  e.g. "02/02/24 Check %1000 3,800.00 $28,875.00"  (here credit column maybe present)
//         // 2) Date Transaction Amount Balance (OCR collapsed columns) => use keywords heuristic
//         // We'll attempt to capture (date)(desc)(credit?)(debit?)(balance?)
//         const rowRegexFull = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/;
//         const rowRegexThree = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/;
//         const rowRegexTwo = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+\$?([\d,]+\.\d{2})$/;

//         for (const line of lines) {
//             // skip header-looking lines
//             if (/^Date\s+Transaction/i.test(line)) continue;
//             // try full pattern first
//             let m = line.match(rowRegexFull);
//             if (m) {
//                 const [, dateStr, desc, creditStr, debitStr, balanceStr] = m;
//                 const date = parseDateFlexible(dateStr, statementMonthYear) || parseDateFlexible(dateStr, ownerData.statementPeriod?.to);
//                 const credit = parseAmount(creditStr) || 0;
//                 const debit = parseAmount(debitStr) || 0;
//                 const balance = parseAmount(balanceStr) || 0;
//                 const type = credit > 0 && debit === 0 ? 'credit' : (debit > 0 && credit === 0 ? 'debit' : (debit > credit ? 'debit' : 'credit'));
//                 transactions.push({
//                     date: date || null,
//                     description: cleanDescription(desc),
//                     debit,
//                     credit,
//                     balance,
//                     type
//                 });
//                 continue;
//             }

//             // try 3-column pattern (likely amount + balance OR credit+balance OR debit+balance)
//             m = line.match(rowRegexThree);
//             if (m) {
//                 const [, dateStr, desc, amt1, amt2] = m;
//                 const date = parseDateFlexible(dateStr, statementMonthYear) || parseDateFlexible(dateStr, ownerData.statementPeriod?.to);
//                 const a1 = parseAmount(amt1);
//                 const a2 = parseAmount(amt2);

//                 // Heuristic: if description contains deposit/interest/credit keywords -> a1 is credit
//                 const creditKeywords = /(deposit|credit|interest|earned|payment|remote|deposit check|remote online deposit|clio)/i;
//                 const debitKeywords = /(check|transfer|withdrawal|wire|paid|transfer to operating)/i;

//                 let credit = 0, debit = 0, balance = 0, type = 'debit';

//                 // if both amounts present, a1 likely credit OR debit depending on header; we assume columns credit then debit then balance.
//                 // The two-number pattern might be (credit, balance) or (debit, balance) depending on OCR; but here we treat a2 as balance if a2 makes sense as balance.
//                 // If a2 looks like a plausible running balance (<= 1e9 and fits range), treat amt2 as balance.
//                 if (a2 !== null && a2 !== undefined) {
//                     balance = a2;
//                     // decide if amt1 is credit or debit based on keywords
//                     if (creditKeywords.test(desc)) {
//                         credit = a1 || 0;
//                         type = 'credit';
//                     } else if (debitKeywords.test(desc)) {
//                         debit = a1 || 0;
//                         type = 'debit';
//                     } else {
//                         // fallback: compare to beginning/ending to guess (if beginningBalance exists, but we don't always have)
//                         // default: treat as credit if words like Earned/Deposit present
//                         credit = a1 || 0;
//                         type = credit > 0 ? 'credit' : 'debit';
//                     }
//                 } else {
//                     // fallback: treat a1 as amount, no balance available
//                     if (creditKeywords.test(desc)) {
//                         credit = a1 || 0;
//                         type = 'credit';
//                     } else if (debitKeywords.test(desc)) {
//                         debit = a1 || 0;
//                         type = 'debit';
//                     } else {
//                         // fallback use amount sign guess -> default debit
//                         debit = a1 || 0;
//                         type = 'debit';
//                     }
//                 }

//                 transactions.push({
//                     date: date || null,
//                     description: cleanDescription(desc),
//                     debit,
//                     credit,
//                     balance,
//                     type
//                 });
//                 continue;
//             }

//             // try single-amount line (OCR collapsed). Use keyword heuristics.
//             m = line.match(rowRegexTwo);
//             if (m) {
//                 const [, dateStr, desc, amtStr] = m;
//                 const date = parseDateFlexible(dateStr, statementMonthYear) || parseDateFlexible(dateStr, ownerData.statementPeriod?.to);
//                 const amt = parseAmount(amtStr) || 0;
//                 const creditKeywords = /(deposit|credit|interest|earned|payment|remote|deposit check|remote online deposit|clio|interest earned)/i;
//                 const debitKeywords = /(check|transfer|withdrawal|wire|paid|transfer to operating|transfer to)/i;
//                 let credit = 0, debit = 0, type = 'debit';
//                 if (creditKeywords.test(desc)) {
//                     credit = amt;
//                     type = 'credit';
//                 } else if (debitKeywords.test(desc)) {
//                     debit = amt;
//                     type = 'debit';
//                 } else {
//                     // ambiguous: use description patterns
//                     type = creditKeywords.test(desc) ? 'credit' : (debitKeywords.test(desc) ? 'debit' : 'debit');
//                     if (type === 'credit') credit = amt; else debit = amt;
//                 }
//                 transactions.push({
//                     date: date || null,
//                     description: cleanDescription(desc),
//                     debit,
//                     credit,
//                     balance: 0,
//                     type
//                 });
//                 continue;
//             }

//             // If none matched, try to parse lines like "02/02/24 Check %1000 3,800.00 $28,875.00" with loose splits
//             const looseParts = line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
//             if (looseParts.length >= 3) {
//                 // assume [date, desc, amount, (maybe balance)]
//                 const dateStr = looseParts[0];
//                 const desc = looseParts[1];
//                 const amt = parseAmount(looseParts[2]);
//                 const bal = looseParts[3] ? parseAmount(looseParts[3]) : 0;
//                 const creditKeywords = /(deposit|credit|interest|earned|payment|remote|deposit check|remote online deposit|clio|interest earned)/i;
//                 const debitKeywords = /(check|transfer|withdrawal|wire|paid|transfer to operating|transfer to)/i;
//                 let credit = 0, debit = 0, type = 'debit';
//                 if (creditKeywords.test(desc)) {
//                     credit = amt || 0;
//                     type = 'credit';
//                 } else if (debitKeywords.test(desc)) {
//                     debit = amt || 0;
//                     type = 'debit';
//                 } else {
//                     // fallback assume debit for checks/descriptions not clearly credit
//                     debit = amt || 0;
//                     type = 'debit';
//                 }
//                 transactions.push({
//                     date: parseDateFlexible(dateStr, statementMonthYear) || null,
//                     description: cleanDescription(desc),
//                     debit,
//                     credit,
//                     balance: bal || 0,
//                     type
//                 });
//             }
//         }
//     }

//     // === Remove duplicates & sort ===
//     const seen = new Set();
//     const uniqueTransactions = [];
//     for (const tx of transactions) {
//         const id = `${tx.date || ''}-${tx.description || ''}-${tx.debit || 0}-${tx.credit || 0}-${tx.balance || 0}`;
//         if (!seen.has(id)) {
//             seen.add(id);
//             uniqueTransactions.push(tx);
//         }
//     }
//     uniqueTransactions.sort((a, b) => {
//         const da = a.date ? new Date(a.date) : new Date(0);
//         const db = b.date ? new Date(b.date) : new Date(0);
//         return da - db;
//     });

//     fs.appendFileSync(responseLogFilePath, `Unique transactions: ${JSON.stringify(uniqueTransactions, null, 2)}\n\n`);

//     // === CASE 3: Extract "Checks Cleared" and "Daily Balances" if present ===
//     let checksCleared = [];
//     let dailyBalances = [];

//     // --- Extract "Checks Cleared" Section (global triplet matches) ---
//     const checksClearedSection = extractSection(
//         rawText,
//         'Checks Cleared',
//         ['Daily Balances', 'DAILY ENDING BALANCE', 'Account Summary']
//     );
//     if (checksClearedSection && checksClearedSection.trim().length > 0) {
//         // Find all occurrences of: checkNumber  date  amount   (repeated on same line)
//         // Example found in your text: "1000 02/02/24 3,800.00 1004 02/21/24 18,760.00"
//         const checkTripletRegex = /(\d{3,6})\s+(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/g;
//         let chkMatch;
//         while ((chkMatch = checkTripletRegex.exec(checksClearedSection)) !== null) {
//             const [, checkNo, dateStr, amountStr] = chkMatch;
//             checksCleared.push({
//                 checkNumber: String(checkNo),
//                 amount: parseAmount(amountStr),
//                 date: parseDateFlexible(dateStr, statementMonthYear)
//             });
//         }

//         // If nothing found with the strict triplet regex, try a looser pattern "check amount date" or "check date amount"
//         if (checksCleared.length === 0) {
//             const looseRegex1 = /(\d{3,6})\s+\$?([\d,]+\.\d{2})\s+(\d{2}\/\d{2}(?:\/\d{2,4})?)/g; // check amount date
//             const looseRegex2 = /(\d{3,6})\s+(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/g; // check date amount
//             let m;
//             while ((m = looseRegex1.exec(checksClearedSection)) !== null) {
//                 const [, cno, amt, dstr] = m;
//                 checksCleared.push({ checkNumber: String(cno), amount: parseAmount(amt), date: parseDateFlexible(dstr, statementMonthYear) });
//             }
//             while ((m = looseRegex2.exec(checksClearedSection)) !== null) {
//                 const [, cno, dstr, amt] = m;
//                 checksCleared.push({ checkNumber: String(cno), amount: parseAmount(amt), date: parseDateFlexible(dstr, statementMonthYear) });
//             }
//         }
//     }

//     // --- Extract "Daily Balances" Section (global date+amount pairs) ---
//     const dailyBalancesSection = extractSection(
//         rawText,
//         'Daily Balances',
//         ['DAILY ENDING BALANCE', 'Account Summary']
//     );
//     if (dailyBalancesSection && dailyBalancesSection.trim().length > 0) {
//         // The section often contains multiple pairs per line, like:
//         // "02/02/24 26,675.00 02/05/24 166,675.00 02/09/24 164,825.00"
//         // Use a global regex to capture every (date, amount) pair.
//         const dateAmountRegex = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/g;
//         let daMatch;
//         while ((daMatch = dateAmountRegex.exec(dailyBalancesSection)) !== null) {
//             const [, dateStr, balStr] = daMatch;
//             const parsedDate = parseDateFlexible(dateStr, statementMonthYear);
//             const parsedBal = parseAmount(balStr);
//             // push only valid parses
//             if (parsedDate !== null && parsedBal !== null) {
//                 dailyBalances.push({
//                     date: parsedDate,
//                     balance: parsedBal
//                 });
//             }
//         }

//         // As a fallback if that found nothing (very unlikely), try splitting lines and matching single pairs
//         if (dailyBalances.length === 0) {
//             const balanceLines = dailyBalancesSection.split('\n').map(l => l.trim()).filter(Boolean);
//             const balanceRegex = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/;
//             for (const line of balanceLines) {
//                 const m = line.match(balanceRegex);
//                 if (m) {
//                     const [, dateStr, balStr] = m;
//                     const parsedDate = parseDateFlexible(dateStr, statementMonthYear);
//                     const parsedBal = parseAmount(balStr);
//                     if (parsedDate !== null && parsedBal !== null) {
//                         dailyBalances.push({ date: parsedDate, balance: parsedBal });
//                     }
//                 }
//             }
//         }
//     }


//     // === Checks Cleared Fallback (looser OCR parsing) ===
//     if (checksCleared.length === 0 && checksClearedSection) {
//         const tokens = checksClearedSection.split(/\s+/);
//         for (let i = 0; i < tokens.length - 2; i += 3) {
//             const [cno, dateStr, amtStr] = tokens.slice(i, i + 3);
//             if (/^\d{3,6}$/.test(cno) && /^\d{2}\/\d{2}/.test(dateStr) && /[\d,.]+/.test(amtStr)) {
//                 checksCleared.push({
//                     checkNumber: cno,
//                     date: parseDateFlexible(dateStr, statementMonthYear),
//                     amount: parseAmount(amtStr)
//                 });
//             }
//         }
//     }




//     return {
//         ownerData,
//         transaction_count: uniqueTransactions.length,
//         transactions: uniqueTransactions,
//         checksCleared,
//         dailyBalances
//     };

// };

// Step 1: Normalize raw text to handle Friendly Bank quirks
// const normalizeRawText = (rawText) => {
//     let fixedText = rawText;

//     // Detect Friendly Bank format
//     const isFriendlyBank = /FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText);

//     if (isFriendlyBank) {
//         // Rename section to match what extractIOLTAData expects
//         fixedText = fixedText.replace(/Detail Transactions Journal/i, 'DEPOSITS AND ADDITIONS');

//         // Remove % from check numbers (e.g., %1000 → 1000)
//         fixedText = fixedText.replace(/%(\d{3,6})/g, '$1');
//     }

//     return fixedText;
// };
const normalizeRawText = (rawText) => {
    let fixedText = rawText;

    // Detect Friendly Bank format (same as before, but we'll transform the transaction block)
    const isFriendlyBank = /FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText);

    if (!isFriendlyBank) return fixedText;

    // 1) Replace header so extractSection finds it
    fixedText = fixedText.replace(/Detail Transactions Journal/i, 'DEPOSITS AND ADDITIONS');

    // 2) Remove % from check numbers (e.g., %1000 → 1000)
    fixedText = fixedText.replace(/%(\d{3,6})/g, '$1');

    // 3) Normalize the Detail Transactions Journal block lines into the form:
    //    MM/DD  <description>  <amount>
    //    (remove running balance, preserve check numbers and deposit ids)
    // We'll find the block from the original header (before replacement) boundaries:
    const headerRegex = /DEPOSITS AND ADDITIONS([\s\S]*?)(?=\r?\n(?:Checks Cleared|Checks Cleared|Checks Cleared|Checks Cleared)|\r?\nDaily Balances|\r?\nChecks Cleared|$)/i;
    const blockMatch = fixedText.match(headerRegex);
    if (!blockMatch) return fixedText;

    const block = blockMatch[0];
    const lines = block.split(/\r?\n/);

    const normalizedLines = [];
    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Match lines that start with a full date like 02/02/24 or 02/02/2024
        // and capture: fullDate, middle (description + possibly check num), last number (transaction amount), optional trailing balance
        const txMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+\$?[\d,]+\.\d{2})?$/);
        if (txMatch) {
            const fullDate = txMatch[1];           // e.g. "02/02/24"
            let desc = txMatch[2];                // e.g. "Check %1000" or "Deposit Check 542290"
            const amountStr = txMatch[3];         // e.g. "3,800.00"

            // Clean description: remove stray $ signs, excess spaces; keep check numbers
            desc = desc.replace(/\$/g, '').replace(/\s{2,}/g, ' ').trim();

            // If description contains a trailing running-balance-like token or stray tokens like '$28,875.00' (rare), remove them
            desc = desc.replace(/\s+\d{1,3}(?:,\d{3})*(?:\.\d{2})$/g, '').trim();

            // Convert fullDate to MM/DD (parser expects MM/DD pattern in many places)
            const mmdd = fullDate.split('/').slice(0, 2).join('/'); // "02/02"

            // Build normalized line: "02/02  Check 1000  3,800.00"
            normalizedLines.push(`${mmdd} ${desc} ${amountStr}`);
            continue;
        }

        // If line begins with MM/DD (without year) and already looks ok, keep it
        if (/^\d{2}\/\d{2}\s+/.test(trimmed)) {
            normalizedLines.push(trimmed);
            continue;
        }

        // Keep header lines like "DEPOSITS AND ADDITIONS", "DATE DESCRIPTION AMOUNT"
        normalizedLines.push(trimmed);
    }

    // Replace the original block with normalized block text
    const normalizedBlock = 'DEPOSITS AND ADDITIONS\n' + normalizedLines.join('\n');

    fixedText = fixedText.replace(headerRegex, normalizedBlock);

    return fixedText;
};


const extractIOLTAData = (rawText) => {
    fs.appendFileSync(responseLogFilePath, `Raw Text: ${rawText}\n\n`);

    const ownerData = {
        accountNumber: '',
        accountName: '',
        statementPeriod: ''
    };

    // === Extract Account Number ===
    // const accountNumberMatch = rawText.match(/Account\s*Number[:\s]*~*\s*([0-9]{6,})/i);
    const accountNumberMatch = rawText.match(
        /Account\s*Number[^\d]*([0-9]{10,})/i
    );
    if (accountNumberMatch) ownerData.accountNumber = accountNumberMatch[1];

    // === Extract Statement Period ===
    let statementPeriodMatch = rawText.match(/([A-Za-z]+\s\d{1,2},\s\d{4})\s*[-–]\s*([A-Za-z]+\s\d{1,2},\s\d{4})/i)
        || rawText.match(/Statement\s*Period\s*([A-Za-z]+\s\d{1,2},?\s\d{4})\s*[-–]\s*([A-Za-z]+\s\d{1,2},?\s\d{4})/i)
        || rawText.match(/([A-Za-z]+\s\d{1,2},\s\d{4})\s+through\s+([A-Za-z]+\s\d{1,2},\s\d{4})/i);

    if (statementPeriodMatch) {
        const startDate = new Date(statementPeriodMatch[1]);
        const endDate = new Date(statementPeriodMatch[2]);
        ownerData.statementPeriod = {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0],
            months: countMonths(startDate, endDate)
        };
    }

    // === Extract Account Name ===
    // const nameLines = rawText.split('\n');
    // for (let i = 0; i < nameLines.length; i++) {
    //     const line = nameLines[i].trim();
    //     if (/BANK\s*STATEMENT/i.test(line)) continue;

    //     // const nameMatch = line.match(/^([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)$/);
    //     // const nameMatch = line.match(
    //     //     /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/
    //     // );
    //     const nameMatch = line.match(
    //         /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/
    //     );
    //     if (nameMatch) {
    //         const isInvalidNameLine = (line) => {

    //             const cleaned = line.trim();

    //             // Empty
    //             if (!cleaned) return true;

    //             // Very short
    //             if (cleaned.length < 4) return true;

    //             // All uppercase headings
    //             if (
    //                 cleaned === cleaned.toUpperCase() &&
    //                 cleaned.includes(' ')
    //             ) {
    //                 return true;
    //             }

    //             // Banking section keywords
    //             if (
    //                 /(balance|deposit|withdraw|payment|interest|description|amount|date|check|transaction|service|statement|account|summary|customer|information|web site|continued)/i
    //                     .test(cleaned)
    //             ) {
    //                 return true;
    //             }

    //             // Numeric-heavy lines
    //             if ((cleaned.match(/\d/g) || []).length > 3) {
    //                 return true;
    //             }

    //             // Address-like lines
    //             if (
    //                 /(street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|boulevard|blvd\.?|po box|p o box|ohio|california|texas|florida|\d{5})/i
    //                     .test(cleaned)
    //             ) {
    //                 return true;
    //             }

    //             // Transaction-like lines
    //             if (
    //                 /(online|transfer|payment|deposit|withdrawal|wire|purchase)/i
    //                     .test(cleaned)
    //             ) {
    //                 return true;
    //             }

    //             return false;
    //         };
    //         if (isInvalidNameLine(line)) {
    //             continue;
    //         }

    //         const nextLine = nameLines[i + 1]?.trim() || '';
    //         const nextNextLine = nameLines[i + 2]?.trim() || '';
    //         const addressIndicators = [
    //             /street/i, /avenue/i, /road/i, /lane/i, /drive/i, /boulevard/i,
    //             /city/i, /state/i, /zip/i, /[A-Z]{2}\s+\d{5}/, /\d{5,6}/,
    //             /[A-Z][a-z]+,\s+[A-Z]{2}/, /[A-Z][a-z]+\s+[A-Z][a-z]+,\s+[A-Z]{2}/
    //         ];
    //         const isAddressLine = addressIndicators.some(regex =>
    //             regex.test(nextLine) || regex.test(nextNextLine)
    //         );
    //         if (isAddressLine) {
    //             ownerData.accountName = nameMatch[1].trim();
    //             break;
    //         }
    //     }
    // }

    // === Extract Account Name ===

    const lines = rawText
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    const invalidNamePatterns = [
        /account/i,
        /statement/i,
        /service/i,
        /customer/i,
        /information/i,
        /web/i,
        /balance/i,
        /deposit/i,
        /withdraw/i,
        /payment/i,
        /amount/i,
        /description/i,
        /date/i,
        /check/i,
        /page/i,
        /chase/i,
        /bank/i,
        /interest/i,
        /calls/i,
        /international/i,
        /espanol/i
    ];

    const isValidPersonName = (text) => {

        if (!text) return false;

        if (text.length < 5) return false;

        if (/\d/.test(text)) return false;

        if (invalidNamePatterns.some(r => r.test(text))) {
            return false;
        }

        // Must look like proper human name
        return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(text);
    };

    // Search only near top area of statement
    for (let i = 0; i < Math.min(lines.length, 40); i++) {

        const line = lines[i];

        if (!isValidPersonName(line)) {
            continue;
        }

        // Nearby address validation
        const nearbyText = [
            lines[i + 1] || '',
            lines[i + 2] || '',
            lines[i + 3] || '',
            lines[i + 4] || ''
        ].join(' ');

        if (
            /(street|st\b|road|rd\b|avenue|ave\b|drive|dr\b|lane|ln\b|court|ct\b|boulevard|blvd\b|po box|p o box|\d{5})/i
                .test(nearbyText)
        ) {
            ownerData.accountName = line;
            break;
        }
    }

    // Fallbacks for account name
    if (!ownerData.accountName) {
        const index = nameLines.findIndex(line => /Account\s*Number/i.test(line));
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

    // === Helpers ===
    const statementMonthYear = statementPeriodMatch ? new Date(statementPeriodMatch[2]) : new Date();

    const parseAmount = (str) => {
        if (!str) return null;
        const num = parseFloat(String(str).replace(/[^\d.-]/g, ''));
        return isNaN(num) ? null : num;
    };

    const formatDate = (dayMonth, referenceDate) => {
        if (!dayMonth) return null;
        const [month, day] = dayMonth.split('/');
        const date = new Date(referenceDate);
        date.setMonth(parseInt(month) - 1);
        date.setDate(parseInt(day));
        // date.setDate(date.getDate() + 1); // Add 1 day
        // return date.toISOString().split('T')[0];

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    };

    const parseDateFlexible = (dateStr, referenceDate) => {
        if (!dateStr) return null;
        const cleaned = dateStr.trim();
        let parts = cleaned.split('/');
        if (parts.length === 3) {
            let [m, d, y] = parts.map(p => p.replace(/\D/g, ''));
            if (y.length === 2) y = parseInt(y) <= 49 ? '20' + y : '19' + y;
            const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
            if (!isNaN(dt)) return dt.toISOString().split('T')[0];
        } else if (parts.length === 2) {
            const year = referenceDate ? new Date(referenceDate).getFullYear() : new Date().getFullYear();
            const [m, d] = parts.map(p => p.replace(/\D/g, ''));
            const dt = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
            if (!isNaN(dt)) return dt.toISOString().split('T')[0];
        }
        const tryDt = new Date(cleaned);
        return !isNaN(tryDt) ? tryDt.toISOString().split('T')[0] : null;
    };

    const cleanDescription = (desc) => desc ? desc.replace(/\s+/g, ' ').trim() : '';
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

    // === Detect format type ===
    const isChaseFormat = /DEPOSITS AND ADDITIONS/i.test(rawText) || /CHECKS PAID/i.test(rawText);
    const isFriendlyFormat = /Detail Transactions Journal/i.test(rawText)
        || /Date\s+Transaction\s+Credit\s+Debit\s+Balance/i.test(rawText)
        || /Checks Cleared/i.test(rawText);

    const transactions = [];

    // === Handle Friendly Bank Detail Transactions Journal ===
    // if (/FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText) || isFriendlyFormat) {
    if (
        /FRIENDLY BANK/i.test(rawText) &&
        (
            /Detail Transactions Journal/i.test(rawText) ||
            isFriendlyFormat
        )
    ) {
        const friendlySection = extractSection(
            rawText,
            'Detail Transactions Journal',
            ['Checks Cleared', 'Daily Balances', 'Account Summary']
        );

        // Correct Friendly Bank transaction pattern: Date | Description | Amount | Balance(optional)
        const friendlyRegex = /(\d{2}\/\d{2}\/\d{2,4})\s+([A-Za-z].*?)\s+([\d,]+\.\d{2})(?:\s+\$?[\d,]+\.\d{2})?/g;

        let match;
        while ((match = friendlyRegex.exec(friendlySection)) !== null) {

            const [, dateStr, descRaw, amountStr] = match;
            const date = parseDateFlexible(dateStr, statementMonthYear);
            // const desc = cleanDescription(descRaw);
            const desc = cleanDescription(descRaw);
            const amount = parseAmount(amountStr);

            // Extract check number if exists (use descRaw to preserve %, $)
            const descForCheckMatch = descRaw.replace(/\s+/g, ' ').trim();
            let checkNumber = null;
            const checkNumberMatch = descForCheckMatch.match(/Check\s*[%$#]?(\d{3,6})\b/i);
            if (checkNumberMatch && !/Deposit\s+Check/i.test(descForCheckMatch)) {
                checkNumber = checkNumberMatch[1];
            }


            const isDebit = /check|transfer/i.test(desc);
            const isCredit = /deposit|interest|wire/i.test(desc);

            transactions.push({
                date,
                description: desc,
                checkNumber: checkNumber || null, // ✅ added
                debit: isDebit ? amount : 0,
                credit: isCredit ? amount : 0,
                balance: 0,
                type: isDebit ? 'debit' : isCredit ? 'credit' : 'debit'
            });
        }

    }


    // === Process Chase / Friendly Format Transactions ===
    if (isChaseFormat || isFriendlyFormat) {
        // const depositsSectionOnly = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
        const depositsSectionOnly = rawText.match(/DATE\s+DESCRIPTION\s+AMOUNT([\s\S]*?)DATE\s+CHECK NO/i)?.[1] || '';
        const checksSection = rawText.match(/DATE\s+CHECK NO\.\s+DESCRIPTION\s+PAID\s+AMOUNT([\s\S]*?)Total Checks Paid/i)?.[1] || '';
        // const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);
        // const withdrawalsSection = rawText.match(/OTHER WITHDRAWALS([\s\S]*?)DAILY ENDING BALANCE/i)?.[1] || '';
        const withdrawalsSection =
            rawText.match(
                /OTHER WITHDRAWALS([\s\S]*?)Total Others Withdrawals/i
            )?.[1] || '';
        // const combinedDeposits = [depositsSectionOnly, withdrawalsSection].filter(Boolean).join('\n');

        // Check line patterns (both reversed and normal)
        // const reversedCheckLineRegex = /^\$?([\d,]+\.\d{2})\s+(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/gm;
        const checkNumberFirstPattern = /(\d{4,6})\s+[\^\*\sA]*\s*(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;;

        const reversedCheckMatches = [];

        let m;
        // while ((m = reversedCheckLineRegex.exec(combinedDeposits)) !== null) {
        //     const [_, amountStr, checkNumber, dateStr] = m;
        //     const amount = parseAmount(amountStr);
        //     if (amount !== null) {
        //         transactions.push({
        //             date: formatDate(dateStr, statementMonthYear),
        //             checkNumber,
        //             description: 'Check payment',
        //             debit: amount,
        //             credit: 0,
        //             balance: 0,
        //             type: 'debit'
        //         });
        //         reversedCheckMatches.push(m[0].replace(/\s+/g, ' ').trim());
        //     }
        // }
        // const multilineCheckRegex =
        //     /(\d{4,6})\s*\n+\s*A?\s*\n+\s*(\d{2}\/\d{2})\s*\n+\s*\$?([\d,]+\.\d{2})/gm;

        // while ((m = multilineCheckRegex.exec(checksSection)) !== null) {

        //     const [, checkNumber, dayMonth, amountStr] = m;

        //     const amount = parseAmount(amountStr);

        //     if (amount !== null) {

        //         transactions.push({
        //             date: formatDate(dayMonth, statementMonthYear),
        //             checkNumber,
        //             description: 'Check payment',
        //             debit: amount,
        //             credit: 0,
        //             balance: 0,
        //             type: 'debit'
        //         });
        //     }
        // }

        // while ((m = checkNumberFirstPattern.exec(combinedDeposits)) !== null)
        while ((m = checkNumberFirstPattern.exec(checksSection)) !== null) {
            const [_, checkNumber, dayMonth, amountStr] = m;
            let fixedCheckNumber = checkNumber;

            // OCR fix:
            // 16563 -> 1653
            // 16556 -> 1655
            // if (
            //     fixedCheckNumber.length === 5 &&
            //     fixedCheckNumber.startsWith('165')
            // ) {
            //     // OCR merged extra digit
            //     // 16563 -> 1653
            //     // 16556 -> 1655
            //     fixedCheckNumber =
            //         fixedCheckNumber.slice(0, 3) +
            //         fixedCheckNumber.slice(4);
            // }

            const amount = parseAmount(amountStr);
            if (amount !== null) {
                transactions.push({
                    date: formatDate(dayMonth, statementMonthYear),
                    checkNumber: fixedCheckNumber,
                    description: 'Check payment',
                    debit: amount,
                    credit: 0,
                    balance: 0,
                    type: 'debit'
                });
                reversedCheckMatches.push(m[0].replace(/\s+/g, ' ').trim());
            }
        }

        // Detect orphan check rows caused by OCR page split
        // const orphanCheckRegex = /^\s*(\d{2}\/\d{2})\s+([\d,]+\.\d{2})\s*$/gm;

        // while ((m = orphanCheckRegex.exec(combinedDeposits)) !== null) {

        //     const [, dayMonth, amountStr] = m;

        //     const amount = parseAmount(amountStr);

        //     if (amount === null) continue;

        //     // Check if same amount/date already exists
        //     const existingSameAmount = transactions.filter(tx =>
        //         tx.debit === amount &&
        //         tx.date === formatDate(dayMonth, statementMonthYear)
        //     );

        //     // If exactly ONE exists, assume missing sequential check
        //     if (existingSameAmount.length === 1) {

        //         const prevCheck = parseInt(existingSameAmount[0].checkNumber || 0);

        //         if (prevCheck) {

        //             transactions.push({
        //                 date: formatDate(dayMonth, statementMonthYear),
        //                 checkNumber: String(prevCheck + 1),
        //                 description: 'Check payment',
        //                 debit: amount,
        //                 credit: 0,
        //                 balance: 0,
        //                 type: 'debit'
        //             });
        //         }
        //     }
        // }

        // Regular deposits/credits
        // const depositRegex = /(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})/g;
        // const depositRegex = /(\d{2}\/\d{2})\s+([A-Za-z][^\n]+?)\s+\$?\s*([\d,]+\.\d{2})/g;
        const depositRegex =
            /(\d{2}\/\d{2})\s+([A-Za-z][A-Za-z0-9 \-]+?)\s+(?:\d+\s+)?\$?([\d,]+\.\d{2})/g;
        // const depositRegex = /(\d{2}\/\d{2})\s+(.+?)\s+\$?\s*([\d,]+\.\d{2})/g;
        // while ((m = depositRegex.exec(combinedDeposits)) !== null)
        while ((m = depositRegex.exec(depositsSectionOnly)) !== null) {
            const [fullLine, dayMonth, description, amountStr] = m;
            const cleanedLine = fullLine.replace(/\s+/g, ' ').trim();
            if (reversedCheckMatches.includes(cleanedLine)) continue;
            if (isTotalLine(description)) continue;
            if (isCheckLine(description.trim())) continue;
            const amount = parseAmount(amountStr);
            if (amount === null) continue;
            // transactions.push({
            //     date: formatDate(dayMonth, statementMonthYear),
            //     description: cleanDescription(description),
            //     debit: 0,
            //     credit: amount,
            //     balance: 0,
            //     type: 'credit'
            // });
            transactions.push({
                date: formatDate(dayMonth, statementMonthYear),
                description: cleanDescription(description),
                debit: /check/i.test(description) || /transfer to operating/i.test(description) ? amount : 0,
                credit: /check/i.test(description) || /transfer to operating/i.test(description) ? 0 : amount,
                balance: 0,
                type: /check/i.test(description) || /transfer to operating/i.test(description) ? 'debit' : 'credit'
            });

        }

        const withdrawalRegex =
            /(\d{2}\/\d{2})\s+([A-Za-z][^\n]+?)\s+\$?([\d,]+\.\d{2})/g;

        while ((m = withdrawalRegex.exec(withdrawalsSection)) !== null) {

            const [, dayMonth, description, amountStr] = m;

            const amount = parseAmount(amountStr);

            if (amount === null) continue;

            transactions.push({
                date: formatDate(dayMonth, statementMonthYear),
                description: cleanDescription(description),
                debit: amount,
                credit: 0,
                balance: 0,
                type: 'debit'
            });
        }
    }

    // === Checks Cleared Section ===
    let checksCleared = [];
    const checksClearedSection = extractSection(rawText, 'Checks Cleared', ['Daily Balances', 'DAILY ENDING BALANCE', 'Account Summary']);
    if (checksClearedSection) {
        const checkTripletRegex = /(\d{3,6})\s+(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/g;
        let chkMatch;
        while ((chkMatch = checkTripletRegex.exec(checksClearedSection)) !== null) {
            const [, checkNo, dateStr, amountStr] = chkMatch;
            checksCleared.push({
                checkNumber: String(checkNo),
                date: parseDateFlexible(dateStr, statementMonthYear),
                amount: parseAmount(amountStr)
            });
        }
    }

    // === Daily Balances Section ===
    let dailyBalances = [];
    const dailyBalancesSection = extractSection(rawText, 'Daily Balances', ['DAILY ENDING BALANCE', 'Account Summary']);
    if (dailyBalancesSection) {
        const dateAmountRegex = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+\$?([\d,]+\.\d{2})/g;
        let daMatch;
        while ((daMatch = dateAmountRegex.exec(dailyBalancesSection)) !== null) {
            const [, dateStr, balStr] = daMatch;
            const parsedDate = parseDateFlexible(dateStr, statementMonthYear);
            const parsedBal = parseAmount(balStr);
            if (parsedDate !== null && parsedBal !== null) {
                dailyBalances.push({ date: parsedDate, balance: parsedBal });
            }
        }
    }

    // === Remove Duplicates & Sort ===
    const seen = new Set();
    const uniqueTransactions = [];
    for (const tx of transactions) {
        const id = `${tx.date || ''}-${tx.description || ''}-${tx.debit || 0}-${tx.credit || 0}-${tx.balance || 0}-${tx.checkNumber || ''}`;
        if (!seen.has(id)) {
            seen.add(id);
            uniqueTransactions.push(tx);
        }
    }

    uniqueTransactions.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return da - db;
    });

    fs.appendFileSync(responseLogFilePath, `Unique transactions: ${JSON.stringify(uniqueTransactions, null, 2)}\n\n`);

    return {
        ownerData,
        transaction_count: uniqueTransactions.length,
        transactions: uniqueTransactions,
        checksCleared,
        dailyBalances
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

            // const amountMatch = existingAmount === amount;
            let amountMatch = false;

            if (checkNumber && existingCheckNumber) {

                amountMatch =
                    existingAmount === amount &&
                    existingCheckNumber === checkNumber;

            } else {

                amountMatch =
                    existingAmount === amount &&
                    existingDescription === description;
            }

            // Optional: Accept date range of ±3 days
            const dateDiff = Math.abs((existingDate - date) / (1000 * 60 * 60 * 24)); // in days
            const dateCloseEnough = dateDiff <= 3;

            if (amountMatch && dateCloseEnough) {
                if (
                    !checkNumber &&
                    !existingCheckNumber &&
                    description !== existingDescription
                ) {
                    continue;
                }
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
    if (beginningBalanceMatch) {
        result.beginningBalance = parseFloat(beginningBalanceMatch[1].replace(/,/g, ''));
    }

    // NEW: Enhanced ending balance extraction
    // const endingBalancePatterns = [
    //     /Ending Balance\s+.*?\$?\s*([\d,]+\.\d{2})/i,  // Matches "Ending Balance 21 $260,618.88"
    //     /Ending Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    //     /Closing Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    //     /Balance\s+as\s+of\s+.*?\$?\s*([\d,]+\.\d{2})/i,
    //     /Final Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i,
    //     /New Balance\s*[:\-]?\s*\$?\s*([\d,]+\.\d{2})/i
    // ];
    const endingBalancePatterns = [

        /Ending\s+Balance\s+\d+\s+\$([\d,]+\.\d{2})/i,

        /Ending\s+Balance[^\n]*\n[^\n]*\$([\d,]+\.\d{2})/i,

        /Closing\s+Balance[^\n]*\$([\d,]+\.\d{2})/i,

        /Final\s+Balance[^\n]*\$([\d,]+\.\d{2})/i
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
    // const dailyBalanceSection = extractSection(rawText, 'DAILY ENDING BALANCE', ['IN CASE OF ERRORS']);
    const dailyBalanceSection =
        rawText.match(
            /DATE\s+AMOUNT([\s\S]*?)IN CASE OF ERRORS/i
        )?.[1] || '';
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
    return cleanedData;
};

// Helper function to format dates (reused from your existing code)
// Helper function to format dates and add 1 day
const formatDate = (dayMonth, referenceDate) => {
    const [month, day] = dayMonth.split('/');
    const date = new Date(referenceDate);
    date.setMonth(parseInt(month) - 1);
    date.setDate(parseInt(day));

    // Add 1 day
    // date.setDate(date.getDate() + 1);

    // return date.toISOString().split('T')[0];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
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
        const safeOutputDir = path.resolve(__dirname, '../../src/uploads/pdfToImages');
        const outputPrefix = resolvePathWithin(safeOutputDir, "page");

        await fs.mkdir(safeOutputDir, { recursive: true });
        await poppler.pdfToCairo(pdfPath, outputPrefix, {
            pngFile: true,
            resolutionXYAxis: 300
        });

        const generatedFiles = (await fs.readdir(safeOutputDir))
            .filter((file) => file.startsWith("page") && file.toLowerCase().endsWith(".png"))
            .sort((a, b) => {
                const aNumber = Number((a.match(/(\d+)/) || [0, 0])[1]);
                const bNumber = Number((b.match(/(\d+)/) || [0, 0])[1]);
                return aNumber - bNumber;
            });

        let counter = 1;
        for (const generatedFile of generatedFiles) {
            const rawImagePath = resolvePathWithin(safeOutputDir, sanitizePathSegment(generatedFile));
            const finalImagePath = resolvePathWithin(safeOutputDir, `processed_${counter}.png`);

            await sharp(rawImagePath)
                .grayscale()
                .normalize()
                .sharpen()
                .threshold(180)
                .toFile(finalImagePath);

            imagePaths.push({ page: counter, path: finalImagePath });
            counter++;
        }

        return imagePaths;
    } catch (err) {
        throw err;
    }
};

/**
 * Uses Tesseract to extract text from a given image.
 * @param {string} imagePath - Path to the image file.
 * @returns {Promise<string>} - Extracted text.
 */
// const proccessWithTesseract = async (imagePath) => {
//     try {
//         const processedPath = await preprocessImage(imagePath, processedImagePath);

//         const worker = await getWorker();
//         const { data: { text } } = await worker.recognize(processedPath);
//         return text;
//     } catch (e) {
//         throw e;
//     }
// }

const proccessWithTesseract = async (imagePath) => {
    try {

        const processedImagePath = imagePath.replace(
            /\.png$/i,
            '_processed.png'
        );

        const processedPath = await preprocessImage(
            imagePath,
            processedImagePath
        );

        const worker = await getWorker();

        const { data: { text } } =
            await worker.recognize(processedPath);

        return text;

    } catch (e) {
        throw e;
    }
}

function normalizeOCRText(text) {

    return text

        .replace(/\r/g, '\n')

        .replace(/[ \t]+/g, ' ')

        .replace(/\n{2,}/g, '\n')

        // Merge broken check lines
        .replace(
            /([0-9])\n([0-9]{4,6}\s+[\^\*A]?\s+\d{2}\/\d{2})/g,
            '$1 $2'
        )

        // Remove OCR garbage
        .replace(/CHECK NO\. DESCRIPTION/gi, '')

        .replace(/DATE PAID AMOUNT/gi, '')

        .replace(/\^/g, ' A ')

        // Fix OCR commas
        .replace(/(\d)\.(\d{3}\.\d{2})/g, '$1,$2')

        // Normalize spaces
        .replace(/[ ]{2,}/g, ' ')

        .trim();
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
            // extracting required data from the OCR result raw text
            // parsedResult = extractIOLTADetails(fullText)
            console.log('Full OCR Text:', fullText);
            // exit(0); 
            // parsedResult = extractIOLTADetails(normalizeRawText(fullText))
            const normalizedText = normalizeOCRText(normalizeRawText(fullText));

            parsedResult = extractIOLTADetails(normalizedText);
        } else if (type === 'image') {
            // OCR directly on image
            const text = await proccessWithTesseract(filePath);
            // extracting required data from the OCR result raw text
            // parsedResult = extractIOLTADetails(text)
            const normalizedText = normalizeOCRText(normalizeRawText(text));
            parsedResult = extractIOLTADetails(normalizedText);
        }
        fs.appendFileSync(responseLogFilePath, `Final Parsed result: ${JSON.stringify(parsedResult, null, 2)}\n\n`);
        return parsedResult;
    } catch (err) {
        return false;
    }
};


module.exports = { proccessOcr };

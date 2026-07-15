

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
        throw error;
    }
}


// const normalizeRawText = (rawText) => {
//     let fixedText = rawText;

//     // Detect Friendly Bank format (same as before, but we'll transform the transaction block)
//     const isFriendlyBank = /FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText);

//     if (!isFriendlyBank) return fixedText;

//     // 1) Replace header so extractSection finds it
//     fixedText = fixedText.replace(/Detail Transactions Journal/i, 'DEPOSITS AND ADDITIONS');

//     // 2) Remove % from check numbers (e.g., %1000 → 1000)
//     fixedText = fixedText.replace(/%(\d{3,6})/g, '$1');

//     // 3) Normalize the Detail Transactions Journal block lines into the form:
//     //    MM/DD  <description>  <amount>
//     //    (remove running balance, preserve check numbers and deposit ids)
//     // We'll find the block from the original header (before replacement) boundaries:
//     const headerRegex = /DEPOSITS AND ADDITIONS([\s\S]*?)(?=\r?\n(?:Checks Cleared|Checks Cleared|Checks Cleared|Checks Cleared)|\r?\nDaily Balances|\r?\nChecks Cleared|$)/i;
//     const blockMatch = fixedText.match(headerRegex);
//     if (!blockMatch) return fixedText;

//     const block = blockMatch[0];
//     const lines = block.split(/\r?\n/);

//     const normalizedLines = [];
//     for (let line of lines) {
//         const trimmed = line.trim();
//         if (!trimmed) continue;

//         // Match lines that start with a full date like 02/02/24 or 02/02/2024
//         // and capture: fullDate, middle (description + possibly check num), last number (transaction amount), optional trailing balance
//         const txMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+\$?[\d,]+\.\d{2})?$/);
//         if (txMatch) {
//             const fullDate = txMatch[1];           // e.g. "02/02/24"
//             let desc = txMatch[2];                // e.g. "Check %1000" or "Deposit Check 542290"
//             const amountStr = txMatch[3];         // e.g. "3,800.00"

//             // Clean description: remove stray $ signs, excess spaces; keep check numbers
//             desc = desc.replace(/\$/g, '').replace(/\s{2,}/g, ' ').trim();

//             // If description contains a trailing running-balance-like token or stray tokens like '$28,875.00' (rare), remove them
//             desc = desc.replace(/\s+\d{1,3}(?:,\d{3})*(?:\.\d{2})$/g, '').trim();

//             // Convert fullDate to MM/DD (parser expects MM/DD pattern in many places)
//             const mmdd = fullDate.split('/').slice(0, 2).join('/'); // "02/02"

//             // Build normalized line: "02/02  Check 1000  3,800.00"
//             normalizedLines.push(`${mmdd} ${desc} ${amountStr}`);
//             continue;
//         }

//         // If line begins with MM/DD (without year) and already looks ok, keep it
//         if (/^\d{2}\/\d{2}\s+/.test(trimmed)) {
//             normalizedLines.push(trimmed);
//             continue;
//         }

//         // Keep header lines like "DEPOSITS AND ADDITIONS", "DATE DESCRIPTION AMOUNT"
//         normalizedLines.push(trimmed);
//     }

//     // Replace the original block with normalized block text
//     const normalizedBlock = 'DEPOSITS AND ADDITIONS\n' + normalizedLines.join('\n');

//     fixedText = fixedText.replace(headerRegex, normalizedBlock);

//     return fixedText;
// };

const normalizeRawText = (rawText) => {
    let fixedText = rawText;
    // FIX: join broken multi-line transactions FIRST
    fixedText = fixedText.replace(
        /(\d{2}\/\d{2})\s+([^\n]+)\n([^\n]+)\n?([^\n]*?)\s+([\d,]+\.\d{2})/g,
        (m, date, p1, p2, p3, amount) => {
            return `${date} ${p1} ${p2} ${p3} ${amount}`;
        }
    );

    // ✅ FIX: join table rows where amount is on next line (Bank of America)
    fixedText = fixedText.replace(
        /(\d{2}\/\d{2}\/\d{2}\s+[^\n]+?)\n\s*(-?[\d,]+\.\d{2})/g,
        (m, line, amount) => {
            return `${line} ${amount}`;
        }
    );

    // Detect Friendly Bank format (same as before, but we'll transform the transaction block)
    // const isFriendlyBank = /FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText);
    const isGenericIOLTA =
        /Detail Transactions Journal/i.test(rawText) ||
        /DEPOSITS AND ADDITIONS/i.test(rawText) ||
        /Deposits and interest/i.test(rawText) ||
        /CHECKS PAID/i.test(rawText) ||
        /Withdrawals/i.test(rawText) ||
        /Daily Balance/i.test(rawText) ||
        /DAILY ENDING BALANCE/i.test(rawText);

    // if (!isFriendlyBank) return fixedText;
    // if (!isGenericIOLTA) return fixedText;

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
    const accountNumberMatch = rawText.match(/Account\s*Number[:\s]*~*\s*([0-9]{6,})/i);
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

    // === Multi-line name fix (Wells Fargo style) ===
    if (!ownerData.accountName) {
        const nameBlockMatch = rawText.match(
            /\n([A-Z ]{3,})\n([A-Z ]{3,})\n\d{1,5}\s/i
        );

        if (nameBlockMatch) {
            ownerData.accountName =
                `${nameBlockMatch[1].trim()} & ${nameBlockMatch[2].trim()}`;
        }
    }

    if (!ownerData.statementPeriod) {
        const singleDateMatch = rawText.match(/Statement Date:\s*([A-Za-z]+\s\d{1,2},\s\d{4})/i);
        if (singleDateMatch) {
            const dt = new Date(singleDateMatch[1]);
            ownerData.statementPeriod = {
                from: dt.toISOString().split('T')[0],
                to: dt.toISOString().split('T')[0],
                months: 1
            };
        }
    }

    // === Extract Account Name ===
    const nameLines = rawText.split('\n');
    for (let i = 0; i < nameLines.length; i++) {
        const line = nameLines[i].trim();
        // if (/BANK\s*STATEMENT/i.test(line)) continue;
        // if (/statement/i.test(line)) continue;
        if (/statement|date description amount|account summary/i.test(line)) continue;
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
        date.setDate(date.getDate() + 1); // Add 1 day
        return date.toISOString().split('T')[0];
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

    // const extractSection = (text, start, ends) => {
    //     const upperText = text.toUpperCase();
    //     const startIndex = upperText.indexOf(start.toUpperCase());
    //     if (startIndex === -1) return '';
    //     const endIndex = Math.min(...ends.map(h =>
    //         upperText.indexOf(h.toUpperCase(), startIndex + start.length)).filter(i => i !== -1));
    //     return text.substring(startIndex + start.length, endIndex !== Infinity ? endIndex : undefined).trim();
    // };
    const extractSection = (text, startKeywords, endKeywords) => {
        const upperText = text.toUpperCase();

        // ✅ ensure arrays
        const starts = Array.isArray(startKeywords) ? startKeywords : [startKeywords];
        const ends = Array.isArray(endKeywords) ? endKeywords : [endKeywords];

        const startIndex = starts
            .map(k => upperText.indexOf(k.toUpperCase()))
            .find(i => i !== -1);

        if (startIndex === undefined) return '';

        let endIndex = upperText.length;

        for (const end of ends) {
            const idx = upperText.indexOf(end.toUpperCase(), startIndex + 1);
            if (idx !== -1 && idx < endIndex) {
                endIndex = idx;
            }
        }

        return text.substring(startIndex, endIndex).trim();
    };

    // === Detect format type ===
    const isChaseFormat = /DEPOSITS AND ADDITIONS/i.test(rawText) || /CHECKS PAID/i.test(rawText);
    const isFriendlyFormat = /Detail Transactions Journal/i.test(rawText)
        || /Date\s+Transaction\s+Credit\s+Debit\s+Balance/i.test(rawText)
        || /Checks Cleared/i.test(rawText);

    const transactions = [];

    // === Handle Friendly Bank Detail Transactions Journal ===
    if (/FRIENDLY BANK/i.test(rawText) && /Detail Transactions Journal/i.test(rawText) || isFriendlyFormat) {

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
    if (isChaseFormat || isFriendlyFormat || /Deposits and other credits/i.test(rawText)) {
        // if (isChaseFormat || isFriendlyFormat) {
        // const depositsSectionOnly = extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']);
        // const depositsSectionOnly =
        //     extractSection(rawText, 'DEPOSITS AND ADDITIONS', ['CHECKS PAID', 'OTHER WITHDRAWALS']) ||
        //     // extractSection(rawText, 'Deposits and interest', ['Withdrawals', 'Checks']) ||
        //     extractSection(
        //         rawText,
        //         ['Deposits and interest', 'Activity detail'],
        //         ['Withdrawals', 'Checks', 'Total deposits']
        //     ) ||
        //     // extractSection(rawText, 'Activity detail', ['Withdrawals', 'Checks']);
        //     extractSection(rawText, ['Activity detail', 'Deposits and interest'], ['Withdrawals', 'Checks'])
        // const depositsSectionOnly =
        //     extractSection(
        //         rawText,
        //         ['DEPOSITS AND ADDITIONS', 'Deposits and interest', 'Activity detail'],
        //         ['CHECKS PAID', 'OTHER WITHDRAWALS', 'Withdrawals', 'Checks', 'Total deposits']
        //     );

        const depositsSectionOnly = extractSection(
            rawText,
            [
                'DEPOSITS AND ADDITIONS',
                'Deposits and interest',
                'Activity detail',
                // 'Deposits and other credits'
                '/Deposits\s+and\s+other\s+credits/i'
            ],
            [
                'CHECKS PAID',
                'OTHER WITHDRAWALS',
                'Withdrawals',
                'Checks',
                'Total deposits',
                'Withdrawals and other debits'
            ]
        );


        // const withdrawalsSection = extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']);
        // const withdrawalsSection =
        //     extractSection(rawText, 'OTHER WITHDRAWALS', ['DAILY ENDING BALANCE']) ||
        //     extractSection(rawText, 'Withdrawals', ['Daily balance summary', 'DAILY ENDING BALANCE']);
        // const withdrawalsSection =
        //     extractSection(
        //         rawText,
        //         ['OTHER WITHDRAWALS', 'Withdrawals'],
        //         ['Daily balance summary', 'DAILY ENDING BALANCE', 'Thank you']
        //     );
        const withdrawalsSection = extractSection(
            rawText,
            [
                'OTHER WITHDRAWALS',
                'Withdrawals',
                'Withdrawals and other debits'
            ],
            [
                'Daily balance summary',
                'DAILY ENDING BALANCE',
                'Thank you'
            ]
        );

        const combinedDeposits = [depositsSectionOnly, withdrawalsSection].filter(Boolean).join('\n');

        // Check line patterns (both reversed and normal)
        const reversedCheckLineRegex = /^\$?([\d,]+\.\d{2})\s+(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})$/gm;
        const checkNumberFirstPattern = /^(\d{4,6})\s+\*?\s*A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/gm;

        const reversedCheckMatches = [];

        let m;
        while ((m = reversedCheckLineRegex.exec(combinedDeposits)) !== null) {
            const [_, amountStr, checkNumber, dateStr] = m;
            const amount = parseAmount(amountStr);
            if (amount !== null) {
                transactions.push({
                    date: formatDate(dateStr, statementMonthYear),
                    checkNumber,
                    description: 'Check payment',
                    debit: amount,
                    credit: 0,
                    balance: 0,
                    type: 'debit'
                });
                reversedCheckMatches.push(m[0].replace(/\s+/g, ' ').trim());
            }
        }

        while ((m = checkNumberFirstPattern.exec(combinedDeposits)) !== null) {
            const [_, checkNumber, dayMonth, amountStr] = m;
            const amount = parseAmount(amountStr);
            if (amount !== null) {
                transactions.push({
                    date: formatDate(dayMonth, statementMonthYear),
                    checkNumber,
                    description: 'Check payment',
                    debit: amount,
                    credit: 0,
                    balance: 0,
                    type: 'debit'
                });
                reversedCheckMatches.push(m[0].replace(/\s+/g, ' ').trim());
            }
        }

        // Regular deposits/credits
        // const depositRegex = /(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})/g;
        // const depositRegex = /(\d{2}\/\d{2})\s+(.+?)\s+([\d,]+\.\d{2})/g;
        const depositRegex = /(\d{2}\/\d{2})\s+([\s\S]+?)\s+([\d,]+\.\d{2})/g;

        // ✅ FIX: Handle Bank of America table format (date | description | amount)
        const boaTableRegex = /(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})/g;

        let boaMatch;
        while ((boaMatch = boaTableRegex.exec(combinedDeposits)) !== null) {
            const [, dateStr, description, amountStr] = boaMatch;

            const amount = parseAmount(amountStr);
            if (amount === null) continue;

            transactions.push({
                date: parseDateFlexible(dateStr, statementMonthYear),
                description: cleanDescription(description),
                debit: amount < 0 ? Math.abs(amount) : 0,
                credit: amount > 0 ? amount : 0,
                balance: 0,
                type: amount < 0 ? 'debit' : 'credit'
            });
        }

        while ((m = depositRegex.exec(combinedDeposits)) !== null) {
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
    }

    // === Wells Fargo style checks (table format) ===
    const wellsCheckRegex = /(\d{4,6})\s+(\d{2}\/\d{2})\s+([\d,]+\.\d{2})/g;

    let wc;
    while ((wc = wellsCheckRegex.exec(rawText)) !== null) {
        const [_, checkNo, dateStr, amountStr] = wc;

        const amount = parseAmount(amountStr);
        if (amount === null) continue;

        transactions.push({
            date: parseDateFlexible(dateStr, statementMonthYear),
            checkNumber: checkNo,
            description: 'Check payment',
            debit: amount,
            credit: 0,
            balance: 0,
            type: 'debit'
        });
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
    // const dailyBalancesSection = extractSection(rawText, 'Daily Balances', ['DAILY ENDING BALANCE', 'Account Summary']);
    const dailyBalancesSection = extractSection(
        rawText,
        ['Daily balance summary', 'Daily Balances', 'DAILY ENDING BALANCE'],
        ['Thank you', 'IN CASE OF ERRORS']
    );
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
    // const bankNameMatch = rawText.match(/([A-Za-z ,&-]+Bank[^a-z]*(?:,? N\.?A\.?)?)/i);
    const bankNameMatch = rawText.match(
        /\b([A-Z][A-Z\s,&.-]+BANK(?:,?\s*N\.?A\.?)?)\b/
    );
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
    date.setDate(date.getDate() + 1);

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
                .grayscale()               // remove color noise
                .normalize()               // boost contrast
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
const proccessWithTesseract = async (imagePath) => {
    try {

        const worker = await getWorker();
        const { data: { text } } = await worker.recognize(imagePath);
        return text;
    } catch (e) {
        throw e;
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
            parsedResult = extractIOLTADetails(normalizeRawText(fullText))

        } else if (type === 'image') {
            // OCR directly on image
            const text = await proccessWithTesseract(filePath);
            // extracting required data from the OCR result raw text
            // parsedResult = extractIOLTADetails(text)
            parsedResult = extractIOLTADetails(normalizeRawText(text))
        }
        fs.appendFileSync(responseLogFilePath, `Final Parsed result: ${JSON.stringify(parsedResult, null, 2)}\n\n`);
        return parsedResult;
    } catch (err) {
        return false;
    }
};


module.exports = { proccessOcr };

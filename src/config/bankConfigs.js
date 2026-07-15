const bankConfigs = {
    'CIT Bank': {
        accountNumber: /Account\s*Number[:\s]*(\d{10,12})/i,
        accountHolderName: /Account\s*Holder[:\s]*([A-Za-z ,.'-]+)\n/i,
        statementPeriod: /Statement\s*Period[:\s]*([A-Za-z]+\s\d{1,2},\s\d{4}\s*[-–]\s*[A-Za-z]+\s\d{1,2},\s\d{4})/i,
        openingBalance: /Opening\s*Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        closingBalance: /(?:Closing|Ending)\s*Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        transactionRegex: /(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+(-?\$?[\d,]+\.\d{2})\s+(-?\$?[\d,]+\.\d{2})/g,
        findTransactions: (text, transactionRegex) => {
            const transactions = []
            let match
            while ((match = transactionRegex.exec(text)) !== null) {
                const [_, date, description, amount, balance] = match;
                const numericAmount = amount ? parseFloat(amount.replace(/[^\d.-]/g, '')) : null;

                transactions.push({
                    date,
                    description: description.trim(),
                    debit: numericAmount < 0 ? Math.abs(numericAmount) : null,
                    credit: numericAmount > 0 ? numericAmount : null,
                    balance: balance ? parseFloat(balance.replace(/[^\d.-]/g, '')) : null,
                    type: numericAmount > 0 ? 'credit' : 'debit'
                });
            }
            return transactions
        }
    },
    'Pacific Premier Bank': {
        accountNumber: /Account\s*(Number|#)[:\s]*([0-9\-]+)/i,
        accountHolderName: /Account\s*Holder[:\s]*([A-Za-z ,.'-]+)\n?/i,
        statementPeriod: /Statement\s*Period[:\s]*([A-Za-z]+\s\d{1,2},\s\d{4})\s*(?:to|-|–)\s*([A-Za-z]+\s\d{1,2},\s\d{4})/i,
        openingBalance: /Beginning\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        closingBalance: /(?:Closing|Ending)\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        transactionRegex: /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z0-9 ,.'\-\/&]+?)\s+(-?\$?[\d,]+\.\d{2})\s+(-?\$?[\d,]+\.\d{2})/g,
        findTransactions: (text, transactionRegex) => {
            const transactions = []
            let match
            while ((match = transactionRegex.exec(text)) !== null) {
                const [_, date, description, amount, balance] = match;
                const numericAmount = amount ? parseFloat(amount.replace(/[^\d.-]/g, '')) : null;

                transactions.push({
                    date,
                    description: description.trim(),
                    debit: numericAmount < 0 ? Math.abs(numericAmount) : null,
                    credit: numericAmount > 0 ? numericAmount : null,
                    balance: balance ? parseFloat(balance.replace(/[^\d.-]/g, '')) : null,
                    type: numericAmount > 0 ? 'credit' : 'debit'
                });
            }
            return transactions
        }
    },
    'Citizens Business Bank of USA': {
        accountNumber: /Account\s*(Number|No\.?)[\s]*([0-9\-]+)/i,
        accountHolderName: /Account\s*Holder\s*Name[:\s]*([A-Za-z ,.'-]+)\n?/i,
        statementPeriod: /Statement\s*Period[:\s]*([A-Za-z]+\s\d{1,2},\s\d{4})\s*(?:to|–|-)\s*([A-Za-z]+\s\d{1,2},\s\d{4})/i,
        openingBalance: /Opening\s+Ledger\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        closingBalance: /Closing\s+Ledger\s+Balance[:\s]*\$?([\d,]+\.\d{2})/i,
        // transactionRegex: /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z0-9 ,.'\-\/&]+?)\s+(-?\$?[\d,]+\.\d{2})\s+(-?\$?[\d,]+\.\d{2})/g
        // transactionRegex: /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z0-9 ,.'\-\/&]+?)\s+(-?\$?[\d,]+\.\d{2})\s+(-?\$?[\d,]+\.\d{2})\s+(-?\$?[\d,]+\.\d{2})/g
        transactionRegex: /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})|-) +(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/gm,
        findTransactions: (text, transactionRegex) => {
            const transactions = [];
            let match;
            while ((match = transactionRegex.exec(text)) !== null) {
                const [_, postDate, effDate, rawDescription, amountRaw, balanceRaw] = match;

                const amount = parseFloat(amountRaw.replace(/[^\d.-]/g, ''));
                const balance = parseFloat(balanceRaw.replace(/[^\d.-]/g, ''));

                // Heuristic: decide credit or debit based on description
                const loweredDesc = rawDescription.toLowerCase();
                let credit = null;
                let debit = null;

                // Try detecting based on keywords or heuristics
                if (
                    loweredDesc.includes('received') ||
                    loweredDesc.includes('deposit') ||
                    loweredDesc.includes('interest')
                ) {
                    credit = amount;
                } else {
                    debit = amount;
                }

                transactions.push({
                    date: postDate,
                    description: `${rawDescription}`.trim(),
                    debit,
                    credit,
                    balance,
                    type: credit ? 'credit' : 'debit'
                });
            }

            return transactions
        }

    },
    'JPMorgan Chase Bank': {
        // ... other configs remain the same ...
        accountNumber: /Account\s*Number:\s*([0-9-]+)/i,
        accountHolderName: /IOLTA Account/i,
        statementPeriod: /([A-Za-z]+\s\d{1,2},\s\d{4}\s+through\s+[A-Za-z]+\s\d{1,2},\s\d{4})/i,
        openingBalance: /Beginning\s+Balance\s+[A-Z]+\s+[A-Z]+\s+\$([\d,]+\.\d{2})/i,
        closingBalance: /Ending\s+Balance\s+[A-Z]+\s+[A-Z]+\s+\$([\d,]+\.\d{2})/i,

        // Regex patterns
        depositRegex: String.raw`(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})`,
        otherWithdrawalRegex: String.raw`(\d{2}\/\d{2})\s+([^\$]+?)\s+\$?([\d,]+\.\d{2})`,

        findTransactions: function (text) {
            const transactions = [];
            const statementPeriodMatch = text.match(/([A-Za-z]+ \d{1,2}, \d{4}) through ([A-Za-z]+ \d{1,2}, \d{4})/);
            const statementMonthYear = statementPeriodMatch ? new Date(statementPeriodMatch[2]) : new Date();

            // Helper function to parse amount safely
            const parseAmount = (amountStr) => {
                if (!amountStr) return null;
                const num = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
                return isNaN(num) ? null : num;
            };

            // Helper function to format dates properly
            const formatDate = (dayMonth, referenceDate) => {
                if (!dayMonth) return '';
                const [month, day] = dayMonth.split('/');
                const date = new Date(referenceDate);
                date.setMonth(parseInt(month) - 1);
                date.setDate(parseInt(day));
                return date.toISOString().split('T')[0];
            };

            // Process deposits
            const depositRegex = new RegExp(this.depositRegex, 'g');
            let depositMatch;
            while ((depositMatch = depositRegex.exec(text)) !== null) {
                const [_, dayMonth, description, amount] = depositMatch;
                const parsedAmount = parseAmount(amount);
                if (parsedAmount === null) continue;

                transactions.push({
                    date: formatDate(dayMonth, statementMonthYear),
                    description: description.trim(),
                    debit: null,
                    credit: parsedAmount,
                    balance: null,
                    type: 'credit'
                });
            }

            // Improved check processing
            const checksPaidIndex = text.indexOf('Checks Paid') || text.indexOf('CHECKS PAID');
            if (checksPaidIndex !== -1) {
                // Get everything from CHECKS PAID to OTHER WITHDRAWALS
                const checksSection = text.slice(checksPaidIndex, text.indexOf('OTHER WITHDRAWALS', checksPaidIndex) || text.length);

                // New check regex specifically for your statement format
                // New check regex specifically for your statement format
                const checkRegex = /(\d{3,5})\s+\*?A?\s+(\d{2}\/\d{2})\s+\$?([\d,]+\.\d{2})/g;

                let checkMatch;
                while ((checkMatch = checkRegex.exec(checksSection)) !== null) {
                    const [_, checkNo, dayMonth, amount] = checkMatch;
                    const parsedAmount = parseAmount(amount);
                    if (parsedAmount === null) continue;

                    transactions.push({
                        date: formatDate(dayMonth, statementMonthYear),
                        checkNumber: checkNo.trim(),
                        description: 'Check payment',
                        debit: parsedAmount,
                        credit: null,
                        balance: null,
                        type: 'debit'
                    });
                }
            }

            // Process other withdrawals
            const otherWithdrawalRegex = new RegExp(this.otherWithdrawalRegex, 'g');
            let otherWithdrawalMatch;
            while ((otherWithdrawalMatch = otherWithdrawalRegex.exec(text)) !== null) {
                const [_, dayMonth, description, amount] = otherWithdrawalMatch;
                const parsedAmount = parseAmount(amount);
                if (parsedAmount === null) continue;

                transactions.push({
                    date: formatDate(dayMonth, statementMonthYear),
                    description: description.trim(),
                    debit: parsedAmount,
                    credit: null,
                    balance: null,
                    type: 'debit'
                });
            }

            return transactions;
        }
    }
    // ... other bank configurations
};


module.exports = bankConfigs;
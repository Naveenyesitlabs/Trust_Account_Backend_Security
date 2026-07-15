const dbConn = require('../../../dbConfig');

const createBankStatement = async (data) => {
    try {

        if (!data.user_name || !data.bank_name || !data.account_number) {
            throw new Error("user_name, bank_name, and account_number are required.");
        }

        const [result] = await dbConn.query(
            `INSERT INTO bank_statements 
            (user_name, bank_name, account_number, statement_period, ending_balance, 
            account_details, transaction_details, daily_balance, upload_document) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.user_name || "Unknown Customer",
                data.bank_name || "Unknown Bank",
                data.account_number || "000-000-000-000",
                data.statement_period || null,
                data.ending_balance || "0.00",
                JSON.stringify(data.account_details) || null,
                JSON.stringify(data.transactions) || "[]",
                data.daily_balance || "0.00",
                null // Placeholder for uploaded document path
            ]
        );

        return { id: result.insertId, message: 'Bank statement created successfully' };
    } catch (error) {
        throw new Error('Error creating bank statement: ' + error.message);
    }
};



const getBankStatements = async () => {
    try {
        const [results] = await dbConn.query('SELECT * FROM bank_statements');
        return results;
    } catch (error) {
        throw new Error('Error fetching bank statements: ' + error.message);
    }
};

module.exports = { createBankStatement, getBankStatements };

const dbConn = require('../../../dbConfig');

const insertBankStatements = async (bankStatementsData) => {
    try {
        const query = 'INSERT INTO bank_statements SET ?';
        const [rows] = await dbConn.query(query, [bankStatementsData]);
        return rows.insertId;
    } catch (error) {
        return false;
    }
}

const insertBankTransaction = async (bankTransactionData) => {
    try {
        const [rows] = await dbConn.query(`INSERT INTO bank_transactions SET ?`, [bankTransactionData]);
        return rows.insertId;
    } catch (error) {
        return false;
    }
}

const getLastBankStatementBalance = async (adminId) => {
try{
    let query = `SELECT daily_bank_balance FROM bank_transactions WHERE adminId = ? ORDER BY id DESC LIMIT ?`;
    const values = [adminId, 1];
    const [rows] = await dbConn.query(query, values);
    return rows.length > 0 ? rows[0].daily_bank_balance : 0;
}catch(error){
    throw new Error('Database error at getLastBankStatementBalance: ' + error.message);
}
}

const getBankStatements = async (adminId) => {
    try {
        // building query
        let query = `SELECT * FROM bank_statements AS bs
                    LEFT JOIN bank_transactions AS bt ON bt.bank_statement_id = bs.id
                    WHERE bs.adminId = ? ORDER BY bs.id, bt.id DESC`;
        const values = [adminId];
        // fetching data
        const [rows] = await dbConn.query(query, values);

        return rows;
    } catch (error) {
        return false;
    }
}


const getFirmName = async (adminId) => {
    try {
        // building the query
        let query = `SELECT name FROM manage_firm WHERE user_id = ?`;
        const values = [adminId];
        // fetching data
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return null;

        return rows[0].name || null;
    } catch (error) {
        throw new Error('Database error at getFirmName: ' + error.message);
    }
}


const getLastBankStatement = async (adminId) => {
    try {
        // building the query
        let query = `SELECT id, date, user_name, bank_name, account_number, upload_document, created_at FROM bank_statements WHERE adminId = ? ORDER BY id DESC LIMIT ?`;
        const values = [adminId, 1];
        // fetching data
        const [rows] = await dbConn.query(query, values);
        return rows || [];
    } catch (error) {
        throw new Error('Database error at getLastBankStatement: ' + error.message);
    }
}

module.exports = {
    insertBankStatements,
    getBankStatements,
    insertBankTransaction,
    getFirmName,
    getLastBankStatement,
    getLastBankStatementBalance
}

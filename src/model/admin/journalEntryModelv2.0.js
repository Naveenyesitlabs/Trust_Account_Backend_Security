const dbConn = require('../../../dbConfig');


// checkUserByEmail
const checkUserByEmail = async (email) => {
    const query = `SELECT * FROM manage_firm_accounting WHERE email = ?`;
    const [rows] = await dbConn.query(query, [email]);
    return rows.length > 0;
};

const checkIfAdmin = async (adminId, userId, role, id) => {
    const idField = role === 'admin' ? 'adminId' : 'userId';
    const idValue = role === 'admin' ? adminId : userId;
    const query = `SELECT * FROM manage_firm_accounting WHERE id = ? AND ${idField} = ?`;
    const [rows] = await dbConn.query(query, [id, idValue]);
    return rows.length > 0;
}

// get All Journal Entries 
const getAllJournalEntries = async (searchData) => {
    const { bank_name, account_number, account_name, adminId } = searchData;

    // building values
    const values = [];
    const conditions = [];

    // base query
    let query = `
        SELECT 
            MFA.id, MFA.case_id, MFA.date, MFA.payee_name, MFA.transaction_method, MFA.cheque_number,
            MFA.purpose, MFA.deposit_amount, MFA.disbursement_amount, MFA.running_balance,
            MFA.notes, MFA.reconciled_to_ledger, MFA.reconciled_to_bank_statement, MFA.ledger_client_id, 
            LC.client_name,
            CTA.*,
            TC.name AS case_name
        FROM manage_firm_accounting AS MFA
        INNER JOIN client_trust_accounts AS CTA 
            ON CTA.clientId = MFA.client_id 
        LEFT JOIN ledger_client AS LC ON LC.id = MFA.ledger_client_id
        LEFT JOIN trust_cases as TC on TC.id = MFA.case_id
        WHERE 1 = 1
        `;

    // optional filters
    if (bank_name) {
        conditions.push(`CTA.bank_name = ?`);
        values.push(bank_name);
    }
    if (account_number) {
        conditions.push(`CTA.account_number = ?`);
        values.push(account_number);
    }
    if (account_name) {
        conditions.push(`CTA.account_name = ?`);
        values.push(account_name);
    }
    if (adminId) {
        conditions.push(`MFA.adminId = ?`);
        values.push(adminId);
    }

    // append conditions if any
    if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
    }

    query += ` ORDER BY MFA.id ASC`;

    // execute
    const [rows] = await dbConn.query(query, values);
    return rows;

};


const getClientExist = async ({ client_id, adminId, userId, role }) => {

    const query = `SELECT * FROM client_trust_accounts WHERE clientId = ?`;
    const [rows] = await dbConn.query(query, [client_id]);

    return rows.length > 0;
};


const isLedgerClientExists = async (ledger_client_name, client_id) => {
    try {
        const query = `SELECT * FROM ledger_client WHERE client_name = ? and client_id = ?`;
        const [rows] = await dbConn.query(query, [ledger_client_name, client_id]);
        if (rows.length > 0) {
            return rows[0];
        } else {
            return false;
        }
    } catch (error) {
        throw new Error("Database Error at isLedgerClientExists: " + error.message);
    }
}


const isMatterExist = async (matter_id, ledger_client_id) => {
    try {
        const query = `SELECT * FROM client_matter WHERE id = ? AND ledger_client_id = ?`;
        const [rows] = await dbConn.query(query, [matter_id, ledger_client_id]);
        return rows.length > 0;
    } catch (error) {
        throw new Error("Database Error at isMatterExist: " + error.message);
    }
}



// ----------- made by sinjan
const addJurnalEntry = async (jurnalEntryData) => {
    const {
        client_id,
        case_id,
        date,
        payee_name,
        transaction_method,
        cheque_number = null,
        purpose,
        deposit_amount,
        disbursement_amount,
        running_balance,
        ledger_balance,
        case_ledger_balance,
        bank_ledger_balance,
        notes = null,
        reconciled_to_ledger = false,
        reconciled_to_bank_statement = false,
        reconcile_to_journal = false,
        ledger_client_id,
        matter_id,
        adminId,
        userId,
        is_bank_charge = false,
        is_lien = false,
        lien_id = null,
        is_outstanding = false
    } = jurnalEntryData;

    const query = `INSERT INTO manage_firm_accounting SET ?`;

    const values = [
        client_id,
        case_id,
        date,
        payee_name,
        transaction_method,
        cheque_number,
        purpose,
        deposit_amount,
        disbursement_amount,
        running_balance,
        case_ledger_balance,
        ledger_balance,
        bank_ledger_balance,
        notes,
        reconciled_to_ledger,
        reconciled_to_bank_statement,
        reconcile_to_journal,
        ledger_client_id,     // assuming this maps to ledger_client_id
        matter_id,
        adminId,
        userId,
        is_bank_charge
    ];

    const [result] = await dbConn.query(query, jurnalEntryData);
    return { id: result.insertId, ...jurnalEntryData };
};




const updateJurnalEntryById = async (id, jurnalEntryData) => {
    const { date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance, ledger_balance, bank_ledger_balance, notes, reconciled_to_ledger, reconciled_to_bank_statement, client_name, is_outstanding, ledger_client_id, case_ledger_balance
    } = jurnalEntryData;

    const query = `
    UPDATE manage_firm_accounting 
    SET date = ?, payee_name = ?, transaction_method = ?, cheque_number = ?, purpose = ?, deposit_amount = ?, disbursement_amount = ?, running_balance = ?, ledger_balance = ?, bank_ledger_balance = ?, notes = ?, reconciled_to_ledger = ?, reconciled_to_bank_statement = ?, client_name = ?, is_outstanding = ?, ledger_client_id = ?, case_ledger_balance = ? WHERE id = ?
  `;

    const [result] = await dbConn.query(query, [date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance, ledger_balance, bank_ledger_balance, notes, reconciled_to_ledger, reconciled_to_bank_statement, client_name, is_outstanding, ledger_client_id, case_ledger_balance, id, // important for the WHERE clause
    ]);

    return result.affectedRows > 0;
}


const getJournalBalanceBeforeDeletedRow = async (id, client_id, adminId, userId, role) => {
    try {
        const idField = role === 'admin' ? 'adminId' : 'userId';
        const idValue = role === 'admin' ? adminId : userId;

        const query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.running_balance
        FROM manage_firm_accounting AS mfa
        WHERE mfa.id < ? AND mfa.adminId = ? AND mfa.client_id = ? ORDER BY mfa.id DESC LIMIT 1`;

        const [result] = await dbConn.query(query, [id, adminId, client_id]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        throw error;
    }
}


const getBankChargesBalanceBeforeDeletedRow = async (id, client_id, adminId, ledger_client_id, matter_id) => {
    try {
        const query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.bank_ledger_balance
        FROM manage_firm_accounting AS mfa
        WHERE mfa.id < ? AND mfa.adminId = ? AND mfa.client_id = ? AND is_bank_charge = ? AND ledger_client_id = ?
        ORDER BY mfa.id DESC LIMIT ?`;

        const [result] = await dbConn.query(query, [id, adminId, client_id, true, ledger_client_id, 1]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        throw error;
    }
}


const getJournalBalanceAfterDeletedRow = async (id, client_id, adminId, userId, role) => {
    try {

        // const idField = role === 'admin' ? 'adminId' : 'userId';
        // const idValue = role === 'admin' ? adminId : userId;

        const query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.running_balance
        FROM manage_firm_accounting AS mfa 
        WHERE mfa.id > ? AND mfa.adminId = ? AND mfa.client_id = ? ORDER BY mfa.id ASC`;

        const [result] = await dbConn.query(query, [id, adminId, client_id]);
        return result;
    } catch (error) {
        throw error;
    }
}

const getBankChargesBalanceAfterDeletedRow = async (id, client_id, adminId, ledger_client_id, matter_id) => {
    try {

        const query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.bank_ledger_balance
        FROM manage_firm_accounting AS mfa 
        WHERE mfa.id > ? AND mfa.adminId = ? AND mfa.client_id = ? AND is_bank_charge = ? AND mfa.ledger_client_id = ?
        ORDER BY mfa.id ASC`;

        const [result] = await dbConn.query(query, [id, adminId, client_id, true, ledger_client_id]);
        return result;
    } catch (error) {
        throw error;
    }
}

const getJournalEntryById = async (id) => {
    try {
        const query = `SELECT * FROM manage_firm_accounting WHERE id = ?`;
        const [result] = await dbConn.query(query, [id]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        throw error;
    }
}

const updateJournalBalanceAfterDelete1 = async (afterBalance) => {
    if (!afterBalance.length) return;

    const ids = afterBalance.map(row => row.id);

    const depositCases = afterBalance.map(row =>
        `WHEN ${row.id} THEN ${row.deposit_amount ?? 0}`
    ).join(' ');
    const disbursementCases = afterBalance.map(row =>
        `WHEN ${row.id} THEN ${row.disbursement_amount ?? 0}`
    ).join(' ');
    const runningBalanceCases = afterBalance.map(row =>
        `WHEN ${row.id} THEN ${row.running_balance ?? 0}`
    ).join(' ');

    const query = `
        UPDATE manage_firm_accounting
        SET 
            deposit_amount = CASE id ${depositCases} END,
            disbursement_amount = CASE id ${disbursementCases} END,
            running_balance = CASE id ${runningBalanceCases} END
        WHERE id IN (${ids.join(',')})
    `;

    try {
        const [result] = await dbConn.query(query);
        return result.affectedRows > 0;
    } catch (error) {
        throw error;
    }
};


const updateJournalBalanceAfterDelete = async (afterBalance) => {
    if (!afterBalance.length) return;

    // 1. Create a temporary table (run once per session)
    const createTempTableSQL = `
      CREATE TEMPORARY TABLE IF NOT EXISTS tmp_updates_journal (
        id INT PRIMARY KEY,
        deposit_amount DECIMAL(15,2),
        disbursement_amount DECIMAL(15,2),
        running_balance DECIMAL(15,2)
      );
    `;
    await dbConn.query(createTempTableSQL);

    // 2. Clear temp table (if needed)
    await dbConn.query(`TRUNCATE TABLE tmp_updates_journal;`);

    // 3. Bulk insert data into temp table
    // Prepare multi-row insert values
    const values = afterBalance.map(row => [
        row.id,
        row.deposit_amount ?? 0,
        row.disbursement_amount ?? 0,
        row.running_balance ?? 0
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
    const flatValues = values.flat();

    const insertSQL = `
      INSERT INTO tmp_updates_journal (id, deposit_amount, disbursement_amount, running_balance)
      VALUES ${placeholders}
    `;
    await dbConn.query(insertSQL, flatValues);

    // 4. Update main table using JOIN
    const updateSQL = `
      UPDATE manage_firm_accounting AS mfa
      INNER JOIN tmp_updates_journal AS tmp ON mfa.id = tmp.id
      SET 
        mfa.deposit_amount = tmp.deposit_amount,
        mfa.disbursement_amount = tmp.disbursement_amount,
        mfa.running_balance = tmp.running_balance
    `;

    const [result] = await dbConn.query(updateSQL);

    return result.affectedRows;
};


const updateBankChargesBalanceAfterDelete = async (afterBalance) => {
    if (!afterBalance.length) return;

    // 1. Create a temporary table (run once per session)
    const createTempTableSQL = `
      CREATE TEMPORARY TABLE IF NOT EXISTS tmp_updates_bank_ledgers (
        id INT PRIMARY KEY,
        deposit_amount DECIMAL(15,2),
        disbursement_amount DECIMAL(15,2),
        bank_ledger_balance DECIMAL(15,2)
      );
    `;
    await dbConn.query(createTempTableSQL);

    // 2. Clear temp table (if needed)
    await dbConn.query(`TRUNCATE TABLE tmp_updates_bank_ledgers;`);

    // 3. Bulk insert data into temp table
    // Prepare multi-row insert values
    const values = afterBalance.map(row => [
        row.id,
        row.deposit_amount ?? 0,
        row.disbursement_amount ?? 0,
        row.bank_ledger_balance ?? 0
    ]);
    const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
    const flatValues = values.flat();

    const insertSQL = `
      INSERT INTO tmp_updates_bank_ledgers (id, deposit_amount, disbursement_amount, bank_ledger_balance)
      VALUES ${placeholders}
    `;
    await dbConn.query(insertSQL, flatValues);

    // 4. Update main table using JOIN
    const updateSQL = `
      UPDATE manage_firm_accounting AS mfa
      INNER JOIN tmp_updates_bank_ledgers AS tmp ON mfa.id = tmp.id
      SET 
        mfa.deposit_amount = tmp.deposit_amount,
        mfa.disbursement_amount = tmp.disbursement_amount,
        mfa.bank_ledger_balance = tmp.bank_ledger_balance
    `;

    const [result] = await dbConn.query(updateSQL);

    return result.affectedRows;
};


const deleteJournalEntryById = async (id) => {
    const query = `DELETE FROM manage_firm_accounting WHERE id = ?`;
    const [result] = await dbConn.query(query, [id]);
    return result.affectedRows > 0;

}

const getAllJournalEntry = async (adminId, userId, role) => {

    // const idField = role === 'admin' ? 'adminId' : 'userId';
    // const idValue = role === 'admin' ? adminId : userId;

    const query = `
  SELECT DISTINCT bank_name
  FROM client_trust_accounts
  WHERE bank_name IS NOT NULL AND adminId = ?
`;

    const [result] = await dbConn.query(query, [adminId]);
    return result.length > 0 ? result : [];
}

const updateReconciledToLedgersById = async (updatedData) => {
    const { id, reconciled_to_ledger } = updatedData;
    const query = `
    UPDATE manage_firm_accounting 
    SET reconciled_to_ledger = ?
     WHERE id = ?  
  `;
    const [result] = await dbConn.query(query, [reconciled_to_ledger, id,
    ]);
    return result.affectedRows > 0;
}

const updateReconciledToBankById = async (updatedData) => {
    const { id, reconciled_to_bank_statement } = updatedData;
    const query = `
    UPDATE manage_firm_accounting 
    SET reconciled_to_bank_statement = ?
     WHERE id = ?  
  `;
    const [result] = await dbConn.query(query, [reconciled_to_bank_statement, id]);
    return result.affectedRows > 0;
}


const updateJurnalNotesById = async (addNotes) => {
    const { id, notes } = addNotes;
    const query = `
    UPDATE manage_firm_accounting 
    SET notes = ?
     WHERE id = ?  
  `;

    const [result] = await dbConn.query(query, [notes, id]);
    return result.affectedRows > 0;

}


/**
 * fetching balance of journal with month or without month(overall, upto current month)
 * @param {*} client_id 
 * @param {*} month 
 * @returns 
 */
const getJournalBalance = async (client_id, adminId, userId, role) => {
    try {

        const idField = role === 'admin' ? 'adminId' : 'userId';
        const idValue = role === 'admin' ? adminId : userId;
        // building query
        let query = `SELECT running_balance FROM manage_firm_accounting WHERE adminId = ? AND client_id = ? ORDER BY id DESC LIMIT 1`;

        // doing db operation
        const [rows] = await dbConn.query(query, [adminId, client_id]);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].running_balance;
    } catch (err) {
        return false;
    }
}


const getBankChargeLedgerBalance = async (client_id, adminId, ledger_client_id = null, matter_id) => {
    try {
        try {
            // building query
            let query = `SELECT bank_ledger_balance FROM manage_firm_accounting 
            WHERE adminId = ? AND is_bank_charge = ? `;
            if (ledger_client_id !== null) {
                query += ` AND ledger_client_id = ? `;
            }
            query += `  ORDER BY id DESC LIMIT 1`;
            // doing db operation
            const [rows] = await dbConn.query(query, [adminId, true, ledger_client_id]);

            if (rows.length === 0) return 0;

            // returning balance
            return rows[0].bank_ledger_balance || 0;
        } catch (err) {
            return false;
        }
    } catch (err) {
        return false;
    }
}


const checkJournalExist = async (transaction, client_id, adminId, userId, role) => {
    try {
        let {
            date,
            cheque_number,
            deposit_amount,
            disbursement_amount
        } = transaction;

        let query = '';
        let values = [];

        query = `SELECT * FROM manage_firm_accounting
                    WHERE adminId = ?
                    `;

        values = [
            adminId,
        ];

        if (deposit_amount > 0) {
            query += ` AND deposit_amount = ?`;
            values.push(deposit_amount);
        }

        if (disbursement_amount > 0) {
            query += ` AND disbursement_amount = ?`;
            values.push(disbursement_amount);
        }


        if (
            cheque_number &&
            cheque_number.trim() !== '' &&
            /^[a-zA-Z0-9]+$/.test(cheque_number.trim())
        ) {
            query += ` AND cheque_number = ?`;
            values.push(cheque_number.trim());
        }

        console.log("Checking journal existence. Query: ", query, "Values: ", values);
        const [rows] = await dbConn.query(query, values);

        if (rows.length <= 0) {
            return {
                isExist: false,
                data: null
            };
        }

        return {
            isExist: rows.length > 0,
            data: rows.length > 0 ? rows[0] : null
        };
        // // Match more strictly if cheque number exists
        // if (cheque_number && cheque_number !== '') {
        //     query = `
        //             SELECT * FROM manage_firm_accounting
        //             WHERE cheque_number = ? and (deposit_amount = ? or disbursement_amount = ?) and adminId = ?
        //             `;
        //     date = new Date(date);     // convert to Date object

        //     date.setDate(date.getDate() + 1);
        //     const newDate = date.toISOString().split("T")[0];
        //     values = [
        //         cheque_number.trim(),
        //         deposit_amount,
        //         disbursement_amount,
        //         adminId,
        //     ];
        //     console.log("Checking journal existence with cheque number. Query: ", query, "Values: ", values);
        //     const [rows] = await dbConn.query(query, values);

        //     return {
        //         isExist: rows.length > 0,
        //         data: rows.length > 0 ? rows[0] : null
        //     };
        // } else {
        //     return {
        //         isExist: false,
        //         data: null
        //     };
        // }

    } catch (err) {
        throw new Error(err.message);
    }
};


const updateJournalReconciliatioBankStatementDB = async ({ id, reconciled_to_bank_statement }) => {
    try {
        let query = `update manage_firm_accounting set reconciled_to_bank_statement = ?, is_outstanding = ? where id = ?`;
        const [rows] = await dbConn.query(query, [reconciled_to_bank_statement, 0, id]);
        return rows.affectedRows > 0;
    } catch (err) {
        throw new Error("Database error at updateJournalReconciliatioBankStatementDB: ", err.message);
    }
}



const removeFromOutstanding = async (lien_id) => {
    try {
        const query = `
                    UPDATE manage_firm_accounting 
                    SET is_outstanding = ?
                    WHERE lien_id = ?
                `;
        const [result] = await dbConn.query(query, [false, lien_id]);
        return result.affectedRows > 0;
    } catch (err) {
        throw new Error("Database error at removeFromOutstanding: ", err.message);
    }
}


const getJournalBalanceUpdate = async (id, client_id, adminId, userId, role) => {
    try {
        const idField = role === 'admin' ? 'adminId' : 'userId';
        const idValue = role === 'admin' ? adminId : userId;
        let query = `SELECT running_balance FROM manage_firm_accounting WHERE id < ? AND adminId = ? AND client_id = ? ORDER BY id DESC LIMIT 1`;

        // doing db operation
        const [rows] = await dbConn.query(query, [id, adminId, client_id]);

        if (rows.length === 0) return 0;
        // returning balance
        return rows[0].running_balance;
    } catch (err) {
        return false;
    }
}


const getBankLedgerBalanceUpdate = async (id, client_id, adminId, ledger_client_id, matter_id) => {
    try {
        let query = `SELECT bank_ledger_balance FROM manage_firm_accounting 
        WHERE id < ? AND adminId = ? AND client_id = ? AND is_bank_charge = ? AND ledger_client_id = ?
        ORDER BY id DESC LIMIT ?`;
        // doing db operation
        const [rows] = await dbConn.query(query, [id, adminId, client_id, true, ledger_client_id, 1]);

        if (rows.length === 0) return 0;
        // returning balance
        return rows[0].bank_ledger_balance;
    } catch (err) {
        return false;
    }
}


/**
 * fetching balance of ledger with month or without month(overall, upto current month)
 * @param {*} client_id 
 * @param {*} month 
 * @returns 
 */
const getLedgerBalance = async (ledger_client_id, matter_id, adminId) => {
    try {

        // building query
        let query = `
            SELECT ledger_balance FROM manage_firm_accounting 
            WHERE ledger_client_id = ? AND adminId = ?
        `;

        if (matter_id !== null && matter_id !== undefined && matter_id !== '') query += ' AND matter_id = ?';

        // gathering values
        const values = [ledger_client_id, adminId, matter_id];

        query += ' ORDER BY id DESC LIMIT 1';
        // doing db operation
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].ledger_balance;
    } catch (err) {
        return false;
    }
}


const getCaseLedgerBalance = async (case_id, adminId) => {
    try {

        // building query
        let query = `
            SELECT case_ledger_balance FROM manage_firm_accounting
            WHERE case_id = ? AND adminId = ?
        `;

        query += ' ORDER BY id DESC LIMIT 1';

        // gathering values
        const values = [case_id, adminId];

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].case_ledger_balance;
    } catch (err) {
        return false;
    }
}


/**
 * fetching balance of ledger with month or without month(overall, upto current month)
 * @param {*} client_id 
 * @param {*} month 
 * @returns 
 */
const getLedgerBalanceUpdate = async (id, ledger_client_id, matter_id, adminId) => {
    try {

        // building query
        let query = `
            SELECT ledger_balance FROM manage_firm_accounting 
            WHERE ledger_client_id = ? AND id < ? AND adminId = ?
        `;

        if (matter_id !== null && matter_id !== undefined && matter_id !== '') query += ' AND matter_id = ?';

        // gathering values
        const values = [ledger_client_id, Number(id), adminId, matter_id];

        query += ' ORDER BY id DESC LIMIT 1';

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].ledger_balance;
    } catch (err) {
        return false;
    }
}


const getCaseLedgerBalanceUpdate = async (id, case_id, adminId) => {
    try {

        // building query
        let query = `
            SELECT case_ledger_balance FROM manage_firm_accounting
            WHERE case_id = ? AND id < ? AND adminId = ?
        `;

        query += ' ORDER BY id DESC LIMIT 1';

        // gathering values
        const values = [case_id, Number(id), adminId];

        // doing db operation
        const [rows] = await dbConn.query(query, values);

        if (rows.length === 0) return 0;

        // returning balance
        return rows[0].case_ledger_balance;
    } catch (err) {
        return false;
    }
}


module.exports = {
    getAllJournalEntries,
    checkUserByEmail,
    addJurnalEntry,
    updateJurnalEntryById,
    deleteJournalEntryById,
    getAllJournalEntry,
    updateReconciledToLedgersById,
    updateReconciledToBankById,
    updateJurnalNotesById,
    getJournalBalance,
    getJournalBalanceUpdate,
    getLedgerBalance,
    getLedgerBalanceUpdate,
    getJournalBalanceBeforeDeletedRow,
    getJournalBalanceAfterDeletedRow,
    updateJournalBalanceAfterDelete,
    checkIfAdmin,
    getJournalEntryById,
    getClientExist,
    checkJournalExist,
    getBankChargeLedgerBalance,
    getBankLedgerBalanceUpdate,
    getBankChargesBalanceAfterDeletedRow,
    updateBankChargesBalanceAfterDelete,
    getBankChargesBalanceBeforeDeletedRow,
    isLedgerClientExists,
    isMatterExist,
    removeFromOutstanding,
    updateJournalReconciliatioBankStatementDB,
    getCaseLedgerBalance,
    getCaseLedgerBalanceUpdate,
}
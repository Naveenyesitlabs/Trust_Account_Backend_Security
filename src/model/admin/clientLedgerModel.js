const dbConn = require("../../../dbConfig");


/**
 * Adds a client ledger entry into the database.
 *
 * @param {Object} clientLedgerData - An object containing the data for the client ledger entry.
 * @param {string} clientLedgerData.date - The date of the transaction.
 * @param {string} clientLedgerData.payee_name - The name of the payee.
 * @param {string} clientLedgerData.transaction_method - The method of the transaction (e.g. Check, Electronic Transfer, etc.).
 * @param {string} clientLedgerData.cheque_number - The cheque number for the transaction.
 * @param {string} clientLedgerData.purpose - The purpose of the transaction.
 * @param {number} clientLedgerData.deposit_amount - The amount deposited in the transaction (if any).
 * @param {number} clientLedgerData.disbursement_amount - The amount disbursed in the transaction (if any).
 * @param {number} clientLedgerData.running_balance - The running balance of the ledger after the transaction.
 * @param {string} clientLedgerData.notes - Any additional notes for the transaction.
 * @param {boolean} clientLedgerData.reconciled_to_ledger - Whether the transaction has been reconciled to the ledger.
 * @param {boolean} clientLedgerData.reconciled_to_bank_statement - Whether the transaction has been reconciled to the bank statement.
 * @param {string} clientLedgerData.bank_name - The name of the bank associated with the transaction.
 * @param {string} clientLedgerData.account_name - The name of the account associated with the transaction.
 * @param {string} clientLedgerData.firm_name - The name of the firm associated with the transaction.
 * @param {string} clientLedgerData.ledgers_detail - The details of the ledger associated with the transaction.
 *
 * @returns {Promise<Object>} - A promise that resolves to an object containing the ID of the newly inserted client ledger entry and the data for the client ledger entry.
 */

const addClientLedger = async (clientLedgerData) => {
  const {
    date, payee_name, transaction_method, cheque_number, purpose, account_number, deposit_amount, disbursement_amount, running_balance, notes, reconciled_to_ledger, reconciled_to_bank_statement, bank_name, account_name, firm_name, ledgers_detail
  } = clientLedgerData
  const query = `
      INSERT INTO manage_firm_accounting (date ,payee_name, transaction_method,cheque_number,purpose,deposit_amount,
        disbursement_amount, running_balance,notes,reconciled_to_ledger,reconciled_to_bank_statement,bank_name,account_number,account_name,firm_name,ledgers_detail
      )
      VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

  const [result] = await dbConn.query(query, [date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance, notes, reconciled_to_ledger, reconciled_to_bank_statement, bank_name, account_number, account_name, firm_name, ledgers_detail,
  ]);
  return { id: result.insertId, ...clientLedgerData };
}

const getAllClientLedger = async (adminId, userId, role) => {
  const idField = role === 'admin' ? 'adminId' : 'userId';
  const idValue = role === 'admin' ? adminId : userId;

  const query = `
  SELECT * FROM manage_firm_accounting WHERE adminId = ?
`;
  const [result] = await dbConn.query(query, [adminId]); // Pass adminId here
  return result;

}

const getClientInfosById = async (firm_name) => {
  const [rows] = await dbConn.query(
    `SELECT * FROM client_trust_accounts WHERE firm_name = ? ORDER BY id ASC LIMIT 1`,
    [firm_name]
  );
  return rows[0];
};


const getClientInfoByLedgerClient = async (ledger_client_id) => {
  try {
    let query = `select cta.* from manage_firm_accounting as mfa
    inner join client_trust_accounts as cta on cta.clientId = mfa.client_id
    where mfa.ledger_client_id=?`;

    const [rows] = await dbConn.query(query, [ledger_client_id]);
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    throw new Error("Database error at getClientInfoByLedgerClient: " + err.message);
  }
}


const getLedgerClientInfo = async (id) => {
  try {
    // building query
    let query = `SELECT * FROM client_trust_accounts WHERE clientId = ?`;

    // fetching result
    const [rows] = await dbConn.query(query, [id]);
    if (rows.length === 0) return [];
    return rows[0];
  } catch (error) {
    throw new Error("Database error at getLedgerClientInfo: " + error.message);
  }
};


const getClientLedger = async ({ case_id, ledger_client_id, firm_name, purpose, adminId }) => {
  try {

    let query = `
    SELECT 
      mfa.id, mfa.client_id, mfa.date, mfa.payee_name, mfa.transaction_method,
      mfa.cheque_number, mfa.purpose, mfa.deposit_amount, mfa.disbursement_amount, mfa.case_ledger_balance,
      mfa.ledger_balance, mfa.notes, mfa.reconciled_to_ledger as reconcile_to_journal, mfa.ledger_client_id, lc.client_name
    FROM manage_firm_accounting AS mfa
    INNER JOIN client_trust_accounts AS cta ON cta.clientId = mfa.client_id
    LEFT JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id 
    WHERE mfa.is_bank_charge = ? 
  `;

    const conditions = [];
    const values = [false];

    if (case_id) {
      conditions.push(`mfa.case_id = ?`);
      values.push(case_id);
    }

    if (ledger_client_id) {
      conditions.push(`mfa.ledger_client_id = ?`);
      values.push(ledger_client_id);
    }

    if (purpose) {
      conditions.push(`mfa.purpose LIKE ? `);
      values.push(`%${purpose}%`);
    }

    if (firm_name) {
      conditions.push(`cta.firm_name = ? `);
      values.push(firm_name);
    }

    // append conditions if any
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    if (adminId) {
      query += ` AND mfa.adminId = ?`;
      values.push(adminId);
    }

    query += ` ORDER BY mfa.id ASC`;

    const [result] = await dbConn.query(query, values);
    return result;
  } catch (err) {
    return false;
  }
}


const getIndividualLedgerOfCurrentMonthYear = async (client_name) => {
  try {
    // building query
    const query = `SELECT 
    mfa.date, mfa.payee_name, mfa.transaction_method, mfa.cheque_number, mfa.purpose, 
    mfa.deposit_amount, mfa.disbursement_amount, mfa.ledger_balance, mfa.notes, mfa.reconcile_to_journal, 
    mfa.client_id, mfa.client_name
    FROM manage_firm_accounting AS mfa
    WHERE client_name = ? AND MONTH(DATE) = ? AND YEAR(DATE) = ?`;

    // initializing values
    const values = [client_name, new Date().getMonth() + 1, new Date().getFullYear()];

    // doing db operation
    const [result] = await dbConn.query(query, values);

    return result;
  } catch (err) {
    throw err;
  }
}


const updateClientLedgerById = async (id, jurnalEntryData) => {
  const { payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance, case_ledger_balance, ledger_balance, notes, reconcile_to_journal, ledger_client_id, matter_id, reconciled_to_ledger
  } = jurnalEntryData;

  const query = `
    UPDATE manage_firm_accounting 
    SET payee_name = ?, transaction_method = ?, cheque_number = ?, purpose = ?, deposit_amount = ?, disbursement_amount = ?, running_balance = ?,  case_ledger_balance = ?, ledger_balance = ?, notes = ?, reconcile_to_journal = ?, ledger_client_id = ?, reconciled_to_ledger = ?, matter_id = ? WHERE id = ?
`;

  const [result] = await dbConn.query(query, [payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance, case_ledger_balance, ledger_balance, notes, reconcile_to_journal, ledger_client_id, reconciled_to_ledger, matter_id, id, // important for the WHERE clause
  ]);

  return result.affectedRows > 0;
}


const getClientNameByID = async (id) => {
  try {

    const query = `
  SELECT *
  FROM manage_firm_accounting 
  WHERE id = ?
  LIMIT 1
`;

    const [result] = await dbConn.query(query, [id]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    throw error;
  }
}


const getLedgerBalanceBeforeDeletedRow = async (id, ledger_client_id, matter_id, adminId, userId, role) => {
  try {


    let query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.ledger_balance, mfa.client_name
        FROM manage_firm_accounting AS mfa
        WHERE mfa.id < ? AND mfa.ledger_client_id = ? AND mfa.adminId = ?`;

    if (matter_id !== null && matter_id !== undefined && matter_id !== '') {
      query += ` AND mfa.matter_id = ? `;
    }

    query += ` ORDER BY mfa.id DESC LIMIT 1`;
    const [result] = await dbConn.query(query, [id, ledger_client_id, adminId, matter_id]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    throw error;
  }
}

const getCaseLedgerBalanceBeforeDeletedRow = async (id, case_id, matter_id, adminId, userId, role) => {
  try {


    let query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.case_ledger_balance, mfa.client_name
        FROM manage_firm_accounting AS mfa
        WHERE mfa.id < ? AND mfa.case_id = ? AND mfa.adminId = ?`;

    if (matter_id !== null && matter_id !== undefined && matter_id !== '') {
      query += ` AND mfa.matter_id = ? `;
    }

    query += ` ORDER BY mfa.id DESC LIMIT 1`;
    const [result] = await dbConn.query(query, [id, case_id, adminId, matter_id]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    throw error;
  }
}


const getLedgerBalanceAfterDeletedRow = async (id, adminId, ledger_client_id, matter_id) => {
  try {


    let query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.ledger_balance
        FROM manage_firm_accounting AS mfa 
        WHERE mfa.id > ? AND mfa.adminId = ? AND mfa.ledger_client_id = ?
        ORDER BY id ASC`;

    const [result] = await dbConn.query(query, [id, adminId, ledger_client_id]);
    return result;
  } catch (error) {
    throw error;
  }
}


const getCaseLedgerBalanceAfterDeletedRow = async (id, adminId, case_id, matter_id) => {
  try {


    const query = `SELECT mfa.id, mfa.deposit_amount, mfa.disbursement_amount, mfa.case_ledger_balance
        FROM manage_firm_accounting AS mfa 
        WHERE mfa.id > ? AND mfa.adminId = ? AND mfa.case_id = ?
        ORDER BY id ASC`;

    if (matter_id !== null && matter_id !== undefined && matter_id !== '') {
      query += ` AND mfa.matter_id = ?`;
    }

    const [result] = await dbConn.query(query, [id, adminId, case_id, matter_id]);
    return result;
  } catch (error) {
    throw error;
  }
}


const updateLedgerBalanceAfterDelete = async (afterBalance) => {
  if (!afterBalance.length) return;

  // 1. Create a temporary table (run once per session)
  const createTempTableSQL = `
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_updates_ledger (
      id INT PRIMARY KEY,
      deposit_amount DECIMAL(15,2),
      disbursement_amount DECIMAL(15,2),
      ledger_balance DECIMAL(15,2)
    );
  `;
  await dbConn.query(createTempTableSQL);

  // 2. Clear temp table (if needed)
  await dbConn.query(`TRUNCATE TABLE tmp_updates_ledger;`);

  // 3. Bulk insert data into temp table
  // Prepare multi-row insert values
  const values = afterBalance.map(row => [
    row.id,
    row.deposit_amount ?? 0,
    row.disbursement_amount ?? 0,
    row.ledger_balance ?? 0
  ]);
  const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
  const flatValues = values.flat();

  const insertSQL = `
    INSERT INTO tmp_updates_ledger (id, deposit_amount, disbursement_amount, ledger_balance)
    VALUES ${placeholders}
  `;
  await dbConn.query(insertSQL, flatValues);

  // 4. Update main table using JOIN
  const updateSQL = `
    UPDATE manage_firm_accounting AS mfa
    INNER JOIN tmp_updates_ledger AS tmp ON mfa.id = tmp.id
    SET 
      mfa.deposit_amount = tmp.deposit_amount,
      mfa.disbursement_amount = tmp.disbursement_amount,
      mfa.ledger_balance = tmp.ledger_balance
  `;

  const [result] = await dbConn.query(updateSQL);

  return result.affectedRows;
};


const updateCaseLedgerBalanceAfterDelete = async (afterBalance) => {
  if (!afterBalance.length) return;

  // 1. Create a temporary table (run once per session)
  const createTempTableSQL = `
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_updates_case_ledger (
      id INT PRIMARY KEY,
      deposit_amount DECIMAL(15,2),
      disbursement_amount DECIMAL(15,2),
      case_ledger_balance DECIMAL(15,2)
    );
  `;
  await dbConn.query(createTempTableSQL);

  // 2. Clear temp table (if needed)
  await dbConn.query(`TRUNCATE TABLE tmp_updates_case_ledger;`);

  // 3. Bulk insert data into temp table
  // Prepare multi-row insert values
  const values = afterBalance.map(row => [
    row.id,
    row.deposit_amount ?? 0,
    row.disbursement_amount ?? 0,
    row.case_ledger_balance ?? 0
  ]);
  const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
  const flatValues = values.flat();

  const insertSQL = `
    INSERT INTO tmp_updates_case_ledger (id, deposit_amount, disbursement_amount, case_ledger_balance)
    VALUES ${placeholders}
  `;
  await dbConn.query(insertSQL, flatValues);

  // 4. Update main table using JOIN
  const updateSQL = `
    UPDATE manage_firm_accounting AS mfa
    INNER JOIN tmp_updates_case_ledger AS tmp ON mfa.id = tmp.id
    SET 
      mfa.deposit_amount = tmp.deposit_amount,
      mfa.disbursement_amount = tmp.disbursement_amount,
      mfa.case_ledger_balance = tmp.case_ledger_balance
  `;

  const [result] = await dbConn.query(updateSQL);

  return result.affectedRows;
};


const deleteClientLedgerById = async (id) => {
  const query = `
      DELETE FROM manage_firm_accounting WHERE id = ?
    `;
  const [result] = await dbConn.query(query, [id]);
  return result.affectedRows > 0;
}

// getAllClientByFirmName
const getAllFirmNames = async (adminId, userId, role) => {
  const idField = role === 'admin' ? 'adminId' : 'userId';
  const idValue = role === 'admin' ? adminId : userId;
  const query = `
      SELECT DISTINCT account_name FROM client_trust_accounts WHERE adminId = ?
  `;
  const [rows] = await dbConn.query(query, [adminId]);
  return rows;
};

const getAllFirms = async (adminId, userId, role) => {
  const idField = role === 'admin' ? 'adminId' : 'userId';
  const idValue = role === 'admin' ? adminId : userId;
  const query = `
  SELECT DISTINCT firm_name
  FROM client_trust_accounts
  WHERE adminId = ?
  ORDER BY firm_name ASC
`;

  const [rows] = await dbConn.query(query, [adminId]);
  return rows;

};

const getClientInf = async (client_id) => {
  const query = `SELECT * FROM client_trust_accounts WHERE clientId = ?`;
  const [rows] = await dbConn.query(query, [client_id]);
  return rows;
}


const getClientNamesByFirm = async (firm_name, adminId, userId, role) => {
  try {

    // building query
    // const query = `
    //   SELECT DISTINCT mfa.client_id AS account_id, mfa.ledger_client_id AS client_id, lc.client_name
    //   FROM manage_firm_accounting AS mfa
    //   INNER JOIN ledger_client AS lc ON lc.id = mfa.ledger_client_id
    //   WHERE mfa.client_id IN (
    //     SELECT cta.clientId FROM client_trust_accounts AS cta WHERE cta.firm_name = ?
    //   ) AND mfa.is_bank_charge = ? and mfa.adminId = ?
    //   `;

    const query = `
      SELECT DISTINCT mfa.client_id as trust_account_id, mfa.case_id, tc.name as case_name
      FROM manage_firm_accounting AS mfa
      INNER JOIN trust_cases as tc on tc.id = mfa.case_id
      WHERE mfa.client_id IN (
        SELECT cta.clientId FROM client_trust_accounts AS cta WHERE cta.firm_name = ?
      ) AND mfa.is_bank_charge = ? and mfa.adminId = ?;
      `;

    const values = [firm_name, false, adminId];

    // doing db operation
    const [rows] = await dbConn.query(query, values);
    return rows;
  } catch (err) {
    return false;
  }
}


const getLedgerCliens = async (adminId, userId, role) => {
  try {
    const idField = role === 'admin' ? 'adminId' : 'userId';
    const idValue = role === 'admin' ? adminId : userId;

    const query = `
     SELECT DISTINCT client_name, client_id FROM manage_firm_accounting AS mfa
      WHERE adminId = ?
      ORDER BY client_name ASC
      `;

    const [rows] = await dbConn.query(query, [adminId]);

    return rows;
  } catch (err) {
    return [];
  }
}


const getLedgerClientByNameDB = (client_name) => {
  try {
    let query = `SELECT * FROM ledger_client WHERE client_name = ?`;
    const [rows] = dbConn.query(query, [client_name]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    throw new Error("Database error at getLedgerClientByNameDB: " + error.message);
  }
}


module.exports = {
  addClientLedger,
  getAllClientLedger,
  getClientLedger,
  updateClientLedgerById,
  deleteClientLedgerById,
  getAllFirmNames,
  getAllFirms,
  getClientNamesByFirm,
  getClientInfosById,
  getClientInf,
  getLedgerCliens,
  getLedgerBalanceBeforeDeletedRow,
  getLedgerBalanceAfterDeletedRow,
  updateLedgerBalanceAfterDelete,
  getClientNameByID,
  getIndividualLedgerOfCurrentMonthYear,
  getLedgerClientInfo,
  getClientInfoByLedgerClient,
  getLedgerClientByNameDB,
  getCaseLedgerBalanceAfterDeletedRow,
  updateCaseLedgerBalanceAfterDelete,
  getCaseLedgerBalanceBeforeDeletedRow,
}
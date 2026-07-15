const dbConn = require("../../../dbConfig");



/**
 * Creates a new lien entry in the client_matter table.
 *
 * @param {Object} lienData - An object containing the lien data to be inserted into the database.
 * @returns {Promise<boolean>} - A promise that resolves to true if the lien is successfully created, otherwise false.
 * @throws {Error} - Throws an error if there is a database error during the insertion process.
 */
const addLienDB = async (lienData) => {
  try {
    let query = `insert into client_matter set ?`;
    const [rows] = await dbConn.query(query, lienData);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at createLien: " + error.message);
  }
};


/**
 * Retrieves the current balance of a lien ledger in the lien_transaction table.
 *
 * @param {number} lien_id - The ID of the lien to retrieve the balance for.
 * @param {number} ledger_client_id - The ID of the ledger client to retrieve the balance for.
 * @returns {Promise<number>} - A promise that resolves to the current balance of the lien ledger.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getLienLedgerBalanceDB = async (lien_id, ledger_client_id, adminId) => {
  try {
    let query = `select COALESCE(lt.lien_balance, 0) as current_balance from lien_transaction as lt 
                where lt.lien_id = ? and lt.ledger_client_id = ? and lt.adminId = ?
                order by lt.id desc limit 1;`;
    const [rows] = await dbConn.query(query, [lien_id, ledger_client_id, adminId]);
    return rows.length > 0 ? rows[0].current_balance : 0;
  } catch (error) {
    throw new Error("Database error at getLienLedgerBalanceDB: " + error.message);
  }
}



/**
 * Creates a new lien transaction entry in the lien_transaction table.
 *
 * @param {Object} lienTransactionData - An object containing the lien transaction data to be inserted into the database.
 * @returns {Promise<boolean>} - A promise that resolves to true if the lien transaction is successfully created, otherwise false.
 * @throws {Error} - Throws an error if there is a database error during the insertion process.
 */
const addLienTransactionDB = async (lienTransactionData) => {
  try {
    let query = `insert into lien_transaction set ?`;
    const [rows] = await dbConn.query(query, lienTransactionData);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at addLienTransactionDB: " + error.message);
  }
}


/**
 * Fetches all lien entries associated with a given admin ID.
 * 
 * This function retrieves lien details from the `client_matter` table, including client names
 * from the `ledger_client` table by joining on the ledger client ID.
 *
 * @param {number} adminId - The ID of the admin whose lien entries are to be fetched.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the lien entry details.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getLiensDB = async (adminId) => {
  try {
    let query = `select cm.id, cm.ledger_client_id, lc.client_name, cm.matter, cm.amount, cm.amount, cm.opened_on, 
                cm.description, cm.case_date, cm.status, cm.notes from client_matter as cm
                inner join ledger_client as lc on lc.id = cm.ledger_client_id
                where cm.adminId = ?`;
    const [rows] = await dbConn.query(query, [adminId]);
    return rows || [];
  } catch (error) {
    throw new Error("Database error at getLiensDB: " + error.message);
  }
}


/**
 * Retrieves all lien transactions associated with a given lien ID and admin ID.
 *
 * @param {number} lienId - The ID of the lien to retrieve transactions for.
 * @param {number} adminId - The ID of the admin to retrieve transactions for.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing the details of a lien transaction.
 * @throws {Error} - Throws an error if there is a database error during the retrieval process.
 */
const getLienTransactionsDB = async (lienId, adminId) => {
  try {
    let query = `select 
                    lt.id, 
                    lt.lien_id, 
                    cm.matter, 
                    lt.ledger_client_id, 
                    lc.client_name,
                    lt.date, lt.payee, 
                    lt.transaction_method, 
                    lt.transaction_number, 
                    lt.purpose,
                    lt.deposit_amount, 
                    lt.disbursement_amount, 
                    lt.lien_balance,
                    cm.status
                  from 
                    lien_transaction as lt 
                  inner join 
                    client_matter as cm on cm.id = lt.lien_id
                  inner join 
                    ledger_client as lc on lc.id = lt.ledger_client_id
                  where 
                    lt.lien_id = ? and lt.adminId = ? and cm.adminId = ?
                  order by 
                    lt.id desc`;
    const [rows] = await dbConn.query(query, [lienId, adminId, adminId]);
    return rows || [];
  } catch (error) {
    throw new Error("Database error at getLienTransactionsDB: " + error.message);
  }
}


/**
 * Updates a lien's status to 'Resolved' in the `client_matter` table.
 *
 * @param {number} lien_id - The ID of the lien to update.
 * @returns {Promise<boolean>} - A promise that resolves to true if the lien is successfully updated, otherwise false.
 * @throws {Error} - Throws an error if there is a database error during the update process.
 */
const updateLienStatusToResolveDB = async (lien_id) => {
  try {
    let query = `update client_matter set status = 'Resolved', closed_on = now() where id = ?`;
    const [rows] = await dbConn.query(query, [lien_id]);
    return rows.affectedRows > 0;
  } catch (error) {
    throw new Error("Database error at updateLienDB: " + error.message);
  }
}


const getMatterByLienId = async (lien_id) => {
  try {
    let query = `select matter from client_matter where id = ?`;
    const [rows] = await dbConn.query(query, [lien_id]);
    return rows.length > 0 ? rows[0].matter : null;
  } catch (error) {
    throw new Error("Database error at getMatterByLienId: " + error.message);
  }
}


module.exports = {
  addLienDB,
  addLienTransactionDB,
  getLienLedgerBalanceDB,
  getLiensDB,
  getLienTransactionsDB,
  updateLienStatusToResolveDB,
  getMatterByLienId,
};
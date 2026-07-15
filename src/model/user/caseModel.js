const dbConn = require('../../../dbConfig');

const insertCase = async (data) => {
  try {
    const query = `insert into trust_cases set ?`;
    const [result] = await dbConn.query(query, [data]);
    if (result.affectedRows <= 0) return false;
    return { id: result.insertId };
  } catch (error) {
    throw new Error('Database error: ' + error.message);
  }
}

const fetchAllCases = async (adminId) => {
  try {
    const query = `select * from trust_cases where adminId = ? order by name asc`;
    const [rows] = await dbConn.query(query, [adminId]);
    return rows;
  } catch (error) {
    throw new Error('Database error: ' + error.message);
  }
}

const isCaseExist = async (caseId) => {
  try {
    const query = `select * from trust_cases where id = ?`;
    const [rows] = await dbConn.query(query, [caseId]);
    return rows.length > 0;
  } catch (error) {
    throw new Error('Database error: ' + error.message);
  }
}


const fetchClientsByCase = async (caseId, adminId) => {
  try {
    const query = `select DISTINCT mfa.ledger_client_id, lc.client_name from manage_firm_accounting as mfa
                    inner join ledger_client as lc on lc.id = mfa.ledger_client_id
                    where mfa.case_id = ? and mfa.adminId = ?
                    order by lc.client_name asc`;

    const [rows] = await dbConn.query(query, [caseId, adminId]);
    return rows;
  } catch (error) {
    throw new Error('Database error: ' + error.message);
  }
}


const getCaseInfo = async (caseId, adminId) => {
  try {
    const query = `select * from trust_cases where id = ? and adminId = ?`;
    const [rows] = await dbConn.query(query, [caseId, adminId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    throw new Error('Database error: ' + error.message);
  }
}


module.exports = {
  insertCase,
  fetchAllCases,
  isCaseExist,
  fetchClientsByCase,
  getCaseInfo,
}
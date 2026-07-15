const { getAdminId } = require("../../model/admin/userManagementModel");
const { insertCase, fetchAllCases, fetchClientsByCase, getCaseInfo } = require("../../model/user/caseModel");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper")

/**
 * Creates a new case in the system.
 * @param {Object} req - The request object containing case data in its body.
 * @param {Object} res - The response object used to send back the desired HTTP response.
 * @returns {void} - Sends a response indicating success or failure of case creation.
 * @throws {Error} - If an error occurs during case creation, logs the error and sends an internal server error response.
 */
const createCase = async (req, res) => {
  try {
    const { name, open_date, description, case_date } = req.body
    const role = req?.user?.role
    let adminId, userId
    if (role.toLowerCase() == 'admin') {
      adminId = req?.user?.userid
      userId = null;
    } else {
      userId = req?.user?.userid
      adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    }
    // validating required fields
    if (!name || !open_date) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
    }
    // constructing new case object
    const data = {
      name,
      open_date,
      description: description || "",
      case_date: case_date || null,
      adminId,
      created_by: userId || adminId,
    }
    // inserting new case into database
    const newCase = await insertCase(data);
    if (!newCase) {
      return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, "Failed to create new case");
    }
    // successful case creation response
    return respond(res, true, HTTP_STATUS_CODE.OK, "Case created successfully", newCase);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


const getAllCase = async (req, res) => {
  try {
    const role = req?.user?.role
    let adminId, userId
    if (role.toLowerCase() == 'admin') {
      adminId = req?.user?.userid
      userId = null;
    } else {
      userId = req?.user?.userid
      adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    }
    // fetching all cases from database
    const cases = await fetchAllCases(adminId);

    // successful fetch response
    return respond(res, true, HTTP_STATUS_CODE.OK, "Cases fetched successfully", cases);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


const getClientsByCase = async (req, res) => {
  try {
    const role = req?.user?.role
    let adminId, userId
    // checking user role and getting admin and user id
    if (role.toLowerCase() == 'admin') {
      adminId = req?.user?.userid
      userId = null;
    } else {
      userId = req?.user?.userid
      adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    }

    const caseId = req.params.caseId;
    // fetching clients associated with the case from database
    const clients = await fetchClientsByCase(caseId, adminId);

    // successful fetch response
    return respond(res, true, HTTP_STATUS_CODE.OK, "Ledger Clients fetched successfully", clients);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}

const getCaseInfoById = async (req, res) => {
  try {
    const role = req?.user?.role
    let adminId, userId
    // checking user role and getting admin and user id
    if (role.toLowerCase() == 'admin') {
      adminId = req?.user?.userid
      userId = null;
    } else {
      userId = req?.user?.userid
      adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    }

    const { caseId } = req.params;
    if (!caseId) {
      return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Case ID is required");
    }

    // fetching case info by id from database
    const caseInfo = await getCaseInfo(caseId, adminId);

    // successful fetch response
    return respond(res, true, HTTP_STATUS_CODE.OK, "Case info fetched successfully", caseInfo);
  } catch (error) {
    return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
  }
}


module.exports = {
  createCase,
  getAllCase,
  getClientsByCase,
  getCaseInfoById,
}
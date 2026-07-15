const { getAdminId } = require("../../model/admin/userManagementModel");
const { insertLedgerClient, getAllLegerClients, getLedgerClientList } = require("../../model/user/allClientsModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");

/**
 * Create ledger client schema
 */
const addClientSchema = Joi.object({
    client_name: Joi.string().required().messages({
        'any.required': 'Client Name is mandatory.',
        'string.empty': 'Client Name cannot be empty.',
    }),
    fee_type: Joi.string().required().messages({
        'any.required': 'Client Type is mandatory.',
        'string.empty': 'Client Type cannot be empty.',
    }),
    case_summary: Joi.string().allow(null, "").optional(),
});

/**
 * Create function 
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const addLedgerClient = async (req, res) => {
    try {
        // validating the input
        const { error } = addClientSchema.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }

        // getting logged in user id
        const userId = req?.user?.userid;
        // getting admin id of this logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        // destructuring the input
        const { client_name, fee_type, case_summary } = req.body;

        // adding the client
        const client = await insertLedgerClient({ client_name, fee_type, case_summary, adminId, userId });
        if (!client) {
            return respond(res, true, HTTP_STATUS_CODE.OK, 'Failed to add client');
        }

        return respond(res, true, HTTP_STATUS_CODE.OK, 'Client added successfully');
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}



/**
 * Fetches all ledger clients for the logged-in user.
 *
 * This function retrieves the user ID and admin ID based on the logged-in user's role.
 * It then fetches all ledger clients associated with the admin ID, adds a serial number
 * to each client, and returns the data in a successful HTTP response. If an error occurs
 * during the process, it sends an error response with the appropriate message.
 *
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 */
const getLedgerClients = async (req, res) => {
    try {
        // getting logged in user id
        const userId = req?.user?.userid;
        // getting admin id of this logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        // getting all ledger clients
        const ledgerClients = await getAllLegerClients(adminId);
        // adding serial number
        const dataWithSerialNumber = await addSerialNoComman(ledgerClients);
        // returning the data
        return respond(res, true, HTTP_STATUS_CODE.OK, "Ledger clients fetched successfully", dataWithSerialNumber);
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


/**
 * Fetches the list of ledger clients for the logged-in user.
 *
 * This function retrieves the user ID and admin ID based on the logged-in user's role.
 * It then fetches the list of ledger clients associated with the admin ID and returns
 * the data in a successful HTTP response. If an error occurs during the process,
 * it sends an error response with the appropriate message.
 *
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 */
const ledgerClientList = async (req, res) => {
    try {
        // getting logged in user id
        const userId = req?.user?.userid;
        // getting admin id of this logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        // getting all ledger clients
        const ledgerClients = await getLedgerClientList(adminId);

        // returning the data
        return respond(res, true, HTTP_STATUS_CODE.OK, "Ledger clients fetched successfully", ledgerClients);
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


module.exports = {
    addLedgerClient,
    getLedgerClients,
    ledgerClientList,
}
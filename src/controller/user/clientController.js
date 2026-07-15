const Joi = require("joi");
const { fetchClients, getClientInfo, isClientExists, createClient, fetchAllClientsFromDB, getClientCount, modifyClient, getAllClientsUserDB } = require("../../model/user/clientModel");
const { respond, HTTP_STATUS_CODE, getPagination, formatDate, parseBoolean } = require("../../utils/reponseHelper");
const { start, status } = require("init");
const { fetchLedgers, getLedgersCount } = require("../../model/user/ledgerModel");
const bcrypt = require("bcryptjs");
const { getClientLedger } = require("../../model/admin/clientLedgerModel");
const { getAllClientTrustAccounts } = require("../../model/admin/clientTrustAccountModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { getCaseInfo } = require("../../model/user/caseModel");


// joi validation schema to get ledgers
const getLedgerSchema = Joi.object({
    client_id: Joi.number().required().messages({
        'any.required': 'Client Not found.',
        'number.base': 'Client name is required.',
    })
});


// validation schema for client
const clientSchema = Joi.object({
    firm_name: Joi.string().allow(null, "").optional(),
    bank_name: Joi.string().allow(null, "").optional(),
    account_name: Joi.string().required().messages({
        'any.required': 'Client name is mandatory.',
        'string.empty': 'Client name cannot be empty.',
    }),
    account_number: Joi.string().allow(null, "").optional(),
    month: Joi.number().allow(null, "").optional(),
    year: Joi.number().allow(null, "").optional(),
    account_open_date: Joi.date().allow(null, "").optional(),
    account_close_date: Joi.date().allow(null, "").optional(),
    fee_type: Joi.string().required().messages({
        'any.required': 'Fee type is mandatory.',
        'string.empty': 'Fee type cannot be empty.',
    }),
    case_summary: Joi.string().allow(null, "").optional(),
});


/**
 * Create new client
 * METHOD: POST
 * ENDPOINT: /user/client/create
 * @param {*} req 
 * @param {*} res 
 */
const addClient = async (req, res) => {
    try {
        const userId = req?.user?.userid;

        // validating the payload
        const { error } = clientSchema.validate(req.body);

        // if validation fails, then returning error response
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }

        // getting today's date
        const date = new Date();
        const today = date.toLocaleDateString('en-CA');

        // creating new client
        const client_id = await createClient({ ...req.body, account_open_date: today, userId });

        // if model function returns false, then returning error response
        if (!client_id) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error creating client in database');
        }

        // returning success response
        respond(res, true, HTTP_STATUS_CODE.CREATED, 'Client created successfully', { id: client_id });
    } catch (err) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledgers: ' + err.message);
    }
}


/**
 * To fetch all clients for dropdown list with search functionality
 * METHOD: GET
 * ENDPOINT: /user/client/all?search={search}
 * @param {*} req 
 * @param {*} res 
 * @returns JSON
 */
const getAllClients = async (req, res) => {
    try {
        // getting search keyword from query parameter
        const { dropdown, search } = req.query || {};

        // building the query
        const query = {
            columns: ['clientId as id', 'account_name as name'],
            orderBy: 'name'
        };

        // if search keyword is provided then adding where clause
        if (search) {
            query.filters = [
                { field: 'account_name', operator: 'LIKE', value: `%${search}%` }
            ]
        }

        let clients = [];

        if (!dropdown || dropdown === 'false' || dropdown === false || dropdown === undefined) {
            clients = await getAllClientTrustAccounts();

            // if clients found, then returning formatting response
            clients.length > 0 && clients.forEach((row) => {
                row.ledger_balance = parseFloat(row.ledger_balance);
                // row.account_open_date = formatDate(row.account_open_date);
            })
            return respond(res, true, HTTP_STATUS_CODE.OK, 'Clients fetched successfully', clients);
        }
        // fetching clients from database
        clients = await fetchClients({ ...query });

        // if model function returns false, then returning error response
        if (!clients) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching clients from database');
        }

        // if no clients found, then returning success response with no client found message
        if (clients.length === 0) {
            return respond(res, true, HTTP_STATUS_CODE.OK, 'No clients found');
        }

        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Clients fetched successfully', clients);
    } catch (err) {

        // returning error response
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching clients: ' + err.message);
    }
}



/**
 * To get ledgers of client based on client ID
 * METHOD: GET
 * ENDPOINT: /user/client/ledgers/:id
 * @param {*} req 
 * @param {*} res 
 */
const getLedgers = async (req, res) => {
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

        // getting client ID from params
        const { case_id, client_id } = req?.body;

        const clientInfo = await getClientInfo({ client_id, adminId });
        // getting client info 
        if (!clientInfo) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client not found');
        }

        // formatting client info
        clientInfo.account_open_date = formatDate(clientInfo.account_open_date, 'dd-mm-yyyy');
        clientInfo.account_close_date = clientInfo.account_close_date ? formatDate(clientInfo.account_close_date, 'dd-mm-yyyy') : null;

        const caseInfo = await getCaseInfo(case_id, adminId);

        // fetching ledgers from database
        const ledgers = await getClientLedger({ case_id, ledger_client_id: client_id, adminId, userId, role });

        // if model function returns false, then returning error response
        if (!ledgers) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledgers from database');
        }
        const addedSerialNoLedgers = await addSerialNoComman(ledgers)

        // creating response data
        const responseData = {
            addedSerialNoLedgers,
            clientInfo,
            caseInfo,
        }
        // Adjust date format to local timezone
        ledgers.forEach(row => {
            const date = new Date(row.date);
            row.date = date.toLocaleDateString('en-CA');
            row.is_reconcile_to_journal = row.reconcile_to_journal === 1 ? true : false;
        });


        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Ledgers fetched successfully', responseData);
    } catch (err) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledgers: ' + err.message);
    }
}


const getUserLedgers = async (req, res) => {
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

        // getting client ID from params
        const { case_id, client_id } = req?.body;

        const caseInfo = await getCaseInfo(case_id, adminId);
        let client_name = "";

        if (client_id) {
            const clientInfo = await getClientInfo({ client_id, adminId });

            if (clientInfo.length > 0) {
                client_name = clientInfo[0].client_name;
            }
        }

        // getting client info 
        if (!caseInfo) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Case not found');
        }

        // formatting client info
        // caseInfo.open_date = caseInfo.open_date ? formatDate(caseInfo.open_date, 'dd-mm-yyyy') : null;
        // caseInfo.close_date = caseInfo.close_date ? formatDate(caseInfo.close_date, 'dd-mm-yyyy') : null;
        caseInfo['client_name'] = client_name;

        // fetching ledgers from database
        const ledgers = await getClientLedger({ case_id, ledger_client_id: client_id, adminId, userId, role });

        // if model function returns false, then returning error response
        if (!ledgers) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledgers from database');
        }
        const addedSerialNoLedgers = await addSerialNoComman(ledgers)

        // creating response data
        const responseData = {
            addedSerialNoLedgers,
            caseInfo,
        }
        // Adjust date format to local timezone
        ledgers.forEach(row => {
            const date = new Date(row.date);
            row.date = date.toLocaleDateString('en-CA');
            row.is_reconcile_to_journal = row.reconcile_to_journal === 1 ? true : false;
        });


        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Ledgers fetched successfully', responseData);
    } catch (err) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledgers: ' + err.message);
    }
}


/**
 * Update client
 * METHOD: PUT
 * ENDPOINT: /user/client/update/:id
 * @param {*} req 
 * @param {*} data 
 * @returns 
 */
const updateClient = async (req, res) => {
    try {
        // getting client id from paramas
        const { id } = req.params;

        // validating client id
        if (!id || isNaN(id) || id === undefined) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client ID is mandatory.');
        }

        // checking client is exist or not
        if (!isClientExists(id)) {
            respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client does not exist');
        }

        // validating payload
        const { error } = clientSchema.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }

        // updating client
        const result = await modifyClient(id, req.body);
        if (!result) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error updating client in database');
        }

        // giving  success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Client updated successfully');

    } catch (err) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}

const getAllClientsUser = async (req, res) => {
    try {
        const role = req?.user?.role
        let adminId, userId
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
        } else {
            userId = req?.user?.userid
        }
        const result = await getAllClientsUserDB(adminId, userId, role);
        return res.status(200).json({
            status: 200,
            success: true,
            message: "all clients",
            data: result
        })
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: "error getting all clients",
            error: error.message
        })
    }
}



module.exports = {
    addClient,
    getAllClients,
    getLedgers,
    updateClient,
    getAllClientsUser
}
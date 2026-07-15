const {
    addClientTrustAccount,
    getClientTrustAccountById,
    updateClientTrustAccount,
    deleteClientTrustAccount,
    getAllClientTrustAccounts,
    isTheAdminData,
    isAccountExist
} = require('../../model/admin/clientTrustAccountModel');
const { getAdminId } = require('../../model/admin/userManagementModel');
const addSerialNoComman = require('../../utils/addSerialNoComman');

/**
 * Controller to handle adding a client trust account
 * Method: POST
 * Endpoint: /admin/client-trust-account
 * @param {*} req 
 * @param {*} res 
 * @returns JSON
 * @throws {Error} If required fields are missing
 * @throws {Error} If an error occurred while adding the trust account
 * @throws {Error} If client trust account already exists
 */
const addClientTrustAccountController = async (req, res) => {
    // getting user role
    const role = req?.user?.role
    // getting admin and user id
    const created_by = req?.user?.created_by
    let adminId, userId
    // checking user role and getting admin and user id
    if (role.toLowerCase() == 'admin') {
        adminId = req?.user?.userid
    } else {
        userId = req?.user?.userid
        adminId = await getAdminId(userId)
    }
    // getting payload
    const { firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date
    } = req?.body;
    // checking required fields
    if (!firm_name || !bank_name || !account_name || !account_number || !month || !year || !account_open_date) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Required fields are missing'
        });
    }
    // checking uniqueness of account number
    const existingAccount = await isAccountExist(account_number, adminId);
    if (existingAccount) {
        return res.status(409).json({
            status: 409,
            success: false,
            message: 'Client trust account already exists'
        });
    }

    try {
        // adding trust account
        const newAccount = await addClientTrustAccount({
            firm_name, bank_name, account_name, account_number, month, year, account_open_date, account_close_date, created_by, adminId, userId, role
        });
        // success response 
        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Client trust account added successfully',
            data: newAccount
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'An error occurred while adding the trust account',
        });
    }
};



/**
 * @description Update a client trust account
 * @param {Object} req.body - Update data
 * @param {String} req.params.clientId - Client ID
 * @returns {Object} Success message and data
 * @throws {Error} If no client found with the given ID
 * @throws {Error} If account number is not unique
 * @throws {Error} If an error occurred while updating the trust account
 */
const updateClientTrustAccountController = async (req, res) => {
    // getting client id from param
    const { clientId } = req.params;
    // getting user role
    const role = req?.user?.role
    let adminId, userId
    // checking user role and getting admin and user id
    if (role.toLowerCase() == 'admin') {
        adminId = req?.user?.userid
    } else {
        userId = req?.user?.userid
    }
    // checking if this is admin
    const isThisAdmin = await isTheAdminData(adminId, userId, clientId, role)
    if (!isThisAdmin) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No client found with the given id'
        });
    }
    // getting payload
    const {
        firm_name,
        bank_name,
        account_name,
        account_number,
        month,
        year,
        account_open_date,
        account_close_date
    } = req.body;
    // checking required fields
    if (!clientId) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Client ID is required'
        });
    }

    try {
        // checking if account number is exist or not
        const existingAccount = await getClientTrustAccountById(clientId);
        if (!existingAccount) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Client trust account not found'
            });
        }
        // checking account number
        if (existingAccount.account_number !== account_number) {
            // checking uniqueness of account number
            const hasAccount = await isAccountExist(account_number, adminId);
            if (hasAccount) {
                return res.status(409).json({
                    status: 409,
                    success: false,
                    message: 'Client trust account already exists'
                });
            }
        }
        // updating trust account
        const updatedAccount = await updateClientTrustAccount(clientId, {
            firm_name,
            bank_name,
            account_name,
            account_number,
            month,
            year,
            account_open_date,
            account_close_date
        });
        // success response
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Client trust account updated successfully',
            data: updatedAccount
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'An error occurred while updating the trust account',
        });
    }
};



/**
 * Controller to handle getting all client trust accounts
 * Method: GET
 * Endpoint: /admin/client-trust-accounts
 * @param {*} req 
 * @param {*} res 
 * @returns JSON
 */
const getAllClientTrustAccountsController = async (req, res) => {
    try {
        // getting user role
        const role = req?.user?.role
        let adminId, userId
        // checking user role and getting admin and user id
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
        } else {
            userId = req?.user?.userid
        }
        // getting trust accounts
        const data = await getAllClientTrustAccounts(adminId, userId, role);
        // checking if data is empty
        if (!data) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No client accounts found'
            });
        }
        // adding serial number
        const addSerialNo = await addSerialNoComman(data)
        // success response
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'All client trust accounts fetched successfully',
            data: addSerialNo
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error fetching trust accounts',
        });
    }
};


/**
 * @description Delete a client trust account
 * @param {String} clientId - Client ID
 * @returns {Object} Success message and data
 * @throws {Error} If no client found with the given ID
 * @throws {Error} If an error occurred while deleting the trust account
 */
const deleteClientTrustAccountController = async (req, res) => {
    // getting client id
    const { clientId } = req.params;
    // getting user role
    const role = req?.user?.role
    let adminId, userId
    // checking user role and getting admin and user id
    if (role.toLowerCase() == 'admin') {
        adminId = req?.user?.userid
    } else {
        userId = req?.user?.userid
    }
    // checking if this is admin
    const isThisAdmin = await isTheAdminData(adminId, userId, clientId, role)
    if (!isThisAdmin) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No client found with the given id'
        });
    }
    // checking client id
    if (!clientId) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Client ID is missing'
        });
    }
    try {
        // checking if account number is exist or not
        const existingAccount = await getClientTrustAccountById(clientId);
        if (!existingAccount) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Client trust account not found'
            });
        }
        // deleting trust account
        await deleteClientTrustAccount(clientId);
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Trust account deleted successfully'
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error deleting trust account',
        });
    }
};

module.exports = {
    addClientTrustAccountController,
    updateClientTrustAccountController,
    getAllClientTrustAccountsController,
    deleteClientTrustAccountController
};

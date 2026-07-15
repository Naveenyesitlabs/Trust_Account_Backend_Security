const {
    getAllJournalEntries,
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
    getJournalBalanceAfterDeletedRow,
    getJournalBalanceBeforeDeletedRow,
    updateJournalBalanceAfterDelete,
    getJournalEntryById,
    getClientExist,
    getBankChargeLedgerBalance,
    getBankLedgerBalanceUpdate,
    getBankChargesBalanceAfterDeletedRow,
    getBankChargesBalanceBeforeDeletedRow,
    updateBankChargesBalanceAfterDelete,
    isLedgerClientExists,
    isMatterExist,
    getCaseLedgerBalance,
    getCaseLedgerBalanceUpdate
} = require("../../model/admin/journalEntryModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { getClientId } = require("../../model/admin/clientTrustAccountModel");
const { updateClientLedgerAtDelete } = require("./clientLedgerController");
const { updateNextJournalAndLedgerBalance } = require("../../utils/balanceHelper");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { all_bank_charges_regex, respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");
const { insertLedgerClient } = require("../../model/user/allClientsModel");
const { isCaseExist } = require("../../model/user/caseModel");

/**
 * Joi validation schema for journal entry
 */
const journalEntrySchema = Joi.object({
    client_id: Joi.number().required().messages({
        'any.required': 'Client id Not found.',
        'number.base': 'Client id is required.',
    }),
    date: Joi.date().required().messages({
        'any.required': "Please enter date",
        'date.base': "Date must be a valid date",
        'any.invalid': "Invalid date"
    }),
    payee_name: Joi.string().required().messages({
        'any.required': 'Payee name is required.',
        'string.base': 'Payee name must be a string.',
    }),
    transaction_method: Joi.string().required().messages({
        'any.required': 'Transaction method is required.',
        'string.base': 'Transaction method must be a string.',
    }),
    cheque_number: Joi.string().allow('', null).optional(),
    purpose: Joi.string().required().messages({
        'any.required': 'Purpose is required.',
        'string.base': 'Purpose must be a string.',
    }),
    transaction_type: Joi.string().required().messages({
        'any.required': 'Transaction type is required.',
        'string.base': 'Transaction type must be a string.',
    }),
    amount: Joi.number().required().messages({
        'any.required': 'Amount is required.',
        'number.base': 'Amount must be a number.',
    }),
    notes: Joi.string().allow(null, "").optional(),
    client_name: Joi.string().required().messages({
        'any.required': 'Client name is required.',
        'string.base': 'Client name must be a string.',
    }),
    matter_id: Joi.number().allow(null, "").optional(),
    reconciled_to_ledger: Joi.number().allow(null, "").optional(),
    reconciled_to_bank_statement: Joi.number().allow(null, "").optional(),
    reconcile_to_journal: Joi.number().allow(null, "").optional(),
    case_id: Joi.string().required().messages({
        'any.required': 'Case id is required.',
        'string.base': 'Case id must be a string.',
    }),
    // case_id: Joi.string().allow(null, "").optional(),
});


/**
 * Controller to add journal entry
 * @function addJurnalEntryController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 */
const addJurnalEntryController = async (req, res) => {
    try {
        // validating payload
        const { error } = journalEntrySchema.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }
        // getting logged in user id
        const role = req?.user?.role
        let adminId, userId
        // checking role and getting admin and user id
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }
        // getting data from request
        let {
            client_id, date, payee_name, transaction_method, cheque_number, purpose, transaction_type, amount, notes,
            client_name: ledger_client_name, matter_id, case_id
        } = req.body;

        case_id = Number(case_id);

        // checking case_id is exist or not
        if (case_id !== null && case_id && undefined && case_id !== '') {
            const caseExist = await isCaseExist(case_id, client_id);
            if (!caseExist) {
                return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No case found for this client');
            }
        }

        let ledgerClient = null;
        // checking if client exist
        const isClientExists = await getClientExist({ client_id, adminId, userId, role });
        if (!isClientExists) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Account does not exist');
        }
        // checking if ledger client exist
        ledgerClient = await isLedgerClientExists(ledger_client_name, client_id);
        if (!ledgerClient) {
            ledgerClient = await insertLedgerClient({ client_name: ledger_client_name, adminId, userId, client_id });
        }
        // getting ledger client id
        let ledger_client_id = ledgerClient.id;
        // checking if matter exist
        if (matter_id !== null && matter_id && undefined && matter_id !== '') {
            const matterExist = await isMatterExist(matter_id, ledger_client_id);
            if (!matterExist) {
                return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Matter does not exist');
            }
        } else {
            matter_id = null;
        }
        // checking transaction type
        const deposit_amount = transaction_type === 'deposit' ? amount : 0;
        const disbursement_amount = transaction_type === 'disbursement' ? amount : 0;

        // fetching current balance on transaction date month
        const journalBalance = await getJournalBalance(client_id, adminId, userId, role);
        // calculating journal running balance
        const journal_running_balance =
            Number(journalBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);

        // for bank charges ledger entry
        let is_bank_charge = false;
        let bank_ledger_balance = 0;
        let ledger_running_balance = 0;
        let case_ledger_running_balance = 0;
        // checking if this is bank charge
        const bank_charges_ledger_balance = await getBankChargeLedgerBalance(client_id, adminId, ledger_client_id, matter_id);
        bank_ledger_balance = Number(bank_charges_ledger_balance);
        // fetching ledger balance
        const ledgerBalance = await getLedgerBalance(ledger_client_id, matter_id, adminId);
        // fetching case ledger balance
        const caseLedgerBalance = await getCaseLedgerBalance(case_id, adminId);

        // calculating ledger running balance
        ledger_running_balance =
            Number(ledgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);

        // calculating case ledger running balance
        case_ledger_running_balance =
            Number(caseLedgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);

        // inserting journal entry
        await addJurnalEntry({
            client_id, date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: ledger_running_balance, bank_ledger_balance, notes, reconciled_to_ledger: false, reconciled_to_bank_statement: false, ledger_client_id, matter_id, adminId, userId, is_bank_charge, is_outstanding: true, case_ledger_balance: case_ledger_running_balance, case_id
        });
        // success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Journal entry added successfully');
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
};



/**
 * Retrieves all journal entries for a client with the given bank name, account number, and account name.
 * @param {Object} req - The request object containing the bank name, account number, and account name in the body.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - A JSON object with the status, success, and message of the operation. If successful, returns the client and journal entries data; otherwise, returns an error message.
 */
const getJurnalEntryController = async (req, res) => {
    // getting data from request
    const { bank_name, account_number, account_name } = req?.body;
    // getting logged in user role
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
    // checking required fields
    if (!account_number || !account_name || !bank_name) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Required fields are missing'
        });
    }

    // fetching client id
    const client = await getClientId(adminId, bank_name, account_number, account_name);

    // checking client
    if (!client || client.length <= 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No client found with the given bank name, account number and account name',
        });
    }
    // formatting date
    client.account_open_date = new Date(client.account_open_date).toLocaleDateString('en-CA');
    client.account_close_date = client.account_close_date ? new Date(client.account_close_date).toLocaleDateString('en-CA') : null;

    try {
        // fetching journal entries
        const data = await getAllJournalEntries({ bank_name, account_number, account_name, adminId, userId, role });
        // formatting date
        if (data.length > 0) {
            // formatting date
            data.forEach(row => {
                row.date = new Date(row.date).toLocaleDateString('en-CA');
            })
            // adding serial number
            const addSerialNo = await addSerialNoComman(data)
            // returning response
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'All Journal Entries fetched successfully',
                data: { client, journals: addSerialNo }
            });
        } else {
            // returning response
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'No Journal Entries found',
                data: { client, journals: [] },

            });
        }
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Error fetching trust accounts',
        });
    }
};




/**
 * Controller to update a journal entry
 * @function updateJurnalEntryController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function updates a journal entry based on the provided request parameters and body data.
 * It checks user roles to determine admin and user IDs, validates required fields, and calculates
 * running balances for journal, ledger, and bank ledger. It updates the journal entry and adjusts 
 * subsequent balances accordingly. Responds with appropriate success or failure messages.
 */
const updateJurnalEntryController = async (req, res) => {
    try {
        // getting logged in user role
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
        // getting id from param
        const { id } = req?.params;
        // getting data from request
        let {
            client_id, client_name, date, payee_name, transaction_method, cheque_number, purpose, transaction_type, amount, ledger_client_id, matter_id, notes, reconciled_to_ledger, reconciled_to_bank_statement,
            case_id
        } = req.body;

        // checking case_id is exist or not
        if (case_id !== null && case_id && undefined && case_id !== '') {
            const caseExist = await isCaseExist(case_id, client_id);
            if (!caseExist) {
                return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No case found for this client');
            }
        }

        // checking required fields
        if (matter_id === null || matter_id === undefined || matter_id === '') matter_id = null
        // checking required fields
        if (!id) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'id is required'
            });
        }
        // getting ledger_client_id
        // checking if ledger client exist
        let ledgerClient = await isLedgerClientExists(client_name, client_id);
        if (!ledgerClient) {
            ledgerClient = await insertLedgerClient({ client_name, adminId, userId, client_id });
        }
        // getting ledger client id
        ledger_client_id = ledgerClient.id;
        // checking reconciled to ledger
        const is_reconcile_ledger = reconciled_to_ledger === 'true' ? 1 : 0;
        // checking reconciled to bank
        const is_reconcile_bank = reconciled_to_bank_statement === 'true' ? 1 : 0;
        // checking amount
        const deposit_amount = transaction_type === 'deposit' ? amount : 0;
        const disbursement_amount = transaction_type === 'disbursement' ? amount : 0;
        // getting running balance
        const previuosJournalBalance = await getJournalBalanceUpdate(id, client_id, adminId, userId, role, ledger_client_id, matter_id);
        const running_balance = Number(previuosJournalBalance) + Number(deposit_amount) - Number(disbursement_amount)
        let is_bank_charges = false;
        let bank_ledger_balance = 0;
        let ledger_running_balance = 0;
        let case_ledger_running_balance = 0;
        // checking if this is a bank charge
        const isThisBankCharge = all_bank_charges_regex.test(purpose);
        const previuosBankChargesLedgerBalance = await getBankLedgerBalanceUpdate(id, client_id, adminId, ledger_client_id, matter_id);
        // calculating ledger running balance
        bank_ledger_balance = Number(previuosBankChargesLedgerBalance)
        const previuosLedgerBalance = await getLedgerBalanceUpdate(id, ledger_client_id, matter_id, adminId);
        const previuosCaseLedgerBalance = await getCaseLedgerBalanceUpdate(id, case_id, adminId);
        // calculating ledger running balance
        ledger_running_balance =
            Number(previuosLedgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);
        // calculating case ledger running balance
        case_ledger_running_balance =
            Number(previuosCaseLedgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);
        // preparing data to update
        const updatedData = {
            client_id,
            date,
            payee_name,
            transaction_method,
            cheque_number,
            purpose,
            transaction_type,
            deposit_amount,
            disbursement_amount,
            running_balance,
            case_ledger_balance: case_ledger_running_balance,
            ledger_balance: ledger_running_balance,
            bank_ledger_balance,
            ledger_client_id,
            matter_id,
            notes,
            reconciled_to_ledger: is_reconcile_ledger,
            reconciled_to_bank_statement: is_reconcile_bank,
            is_outstanding: is_reconcile_bank === 0 ? 1 : 0
        };
        // updating journal
        const success = await updateJurnalEntryById(id, updatedData);

        // updating the next journal and ledger balance
        await updateNextJournalAndLedgerBalance(id, ledger_client_id, case_id, matter_id, running_balance, case_ledger_running_balance, ledger_running_balance, bank_ledger_balance, adminId, userId, role, client_id, is_bank_charges);
        // returning failure response
        if (!success) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Entry not updated');
        }
        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Entry updated successfully');
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}



/**
 * Controller to update journal balance when a journal entry is deleted
 * @function updateBjournalBalanceAtDeleteController
 * @param {Number} id - id of the journal entry to be deleted
 * @param {Number} adminId - id of the admin user
 * @param {Number} userId - id of the user
 * @param {String} role - role of the user
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function calculates the running balance for all journal entries after the entry being deleted
 * and updates the journal entries accordingly. Responds with appropriate success or failure messages.
 */
const updateBjournalBalanceAtDeleteController = async (id, adminId, userId, role) => {
    try {
        // fetching client id
        const { client_id } = await getJournalEntryById(id);
        // fetching last balance before this row
        const beforeBalance = await getJournalBalanceBeforeDeletedRow(id, client_id, adminId, userId, role);
        if (beforeBalance) {
            // fetching balance after this row
            const afterBalance = await getJournalBalanceAfterDeletedRow(id, client_id, adminId, userId, role);
            // checking if there are any rows
            if (afterBalance.length > 0) {
                // updating running balance
                afterBalance.forEach((row, index) => {
                    if (index === 0) {
                        row.running_balance = Number(beforeBalance.running_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    } else {
                        row.running_balance = Number(afterBalance[index - 1].running_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    }
                })
            }

            // bulk updatng the values
            const updatedCount = await updateJournalBalanceAfterDelete(afterBalance);
            if (updatedCount <= 0) {
                throw new Error("Failed to calculate journal balance");
            }
        }
        return true
    } catch (err) {

        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'Failed to calculate journal balance',
        });
    }
}



/**
 * Controller to update bank charges balance when a journal entry is deleted
 * @function updateBankChargesBalanceAtDeleteController
 * @param {Number} id - id of the journal entry to be deleted
 * @param {Number} adminId - id of the admin user
 * @param {Number} ledger_client_id - id of the ledger client
 * @param {Number} matter_id - id of the matter
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function calculates the running balance for all bank charges ledger entries after the entry being deleted
 * and updates the bank charges ledger entries accordingly. Responds with appropriate success or failure messages.
 */
const updateBankChargesBalanceAtDeleteController = async (id, adminId, ledger_client_id, matter_id) => {
    try {
        // fetching client id
        const { client_id } = await getJournalEntryById(id);

        // fetching last balance before this row
        const beforeBalance = await getBankChargesBalanceBeforeDeletedRow(id, client_id, adminId, ledger_client_id, matter_id);
        if (beforeBalance) {
            // fetching balance after this row
            const afterBalance = await getBankChargesBalanceAfterDeletedRow(id, client_id, adminId, ledger_client_id, matter_id);
            // checking if there are any rows
            if (afterBalance.length > 0) {
                // updating running balance
                afterBalance.forEach((row, index) => {
                    if (index === 0) {
                        row.bank_ledger_balance = Number(beforeBalance.bank_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    } else {
                        row.bank_ledger_balance = Number(afterBalance[index - 1].bank_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    }
                })
            }

            // bulk updatng the values
            const updatedCount = await updateBankChargesBalanceAfterDelete(afterBalance);
            // checking if there are any rows
            if (updatedCount <= 0) {
                throw new Error("Failed to calculate bank ledger balance");
            }
        }
        return true
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}



/**
 * Deletes a journal entry and updates all dependent ledger entries and bank ledger entries
 * @function deleteJurnalEntryController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function deletes a journal entry based on the provided request parameter and updates all dependent ledger entries and bank ledger entries.
 * It first checks if the id is valid, then it updates the journal balances, bank charges ledger balances, and ledger balances.
 * Then it deletes the journal entry and sends a response back to the user.
 * If the id is invalid or there is an error while deleting the journal entry, it sends an appropriate error response back to the user.
 */
const deleteJurnalEntryController = async (req, res) => {
    // getting id from param
    const { id } = req.params;
    // getting logged in user role
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
    // checking required params
    if (!id || id == 'undefined') {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'id is required'
        });
    }
    // getting current data
    const currentData = await getJournalEntryById(id);
    // checking data from db
    const { ledger_client_id, client_id, case_id, matter_id } = currentData;

    try {
        // gupdating journal balance
        await updateBjournalBalanceAtDeleteController(id, adminId, userId, role);
        // updating bank charges balance
        await updateBankChargesBalanceAtDeleteController(id, adminId, ledger_client_id, matter_id);
        // updating ledger balance
        await updateClientLedgerAtDelete(id, case_id, client_id, matter_id, adminId);
        // deleting journal entry
        const success = await deleteJournalEntryById(id);
        if (!success) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Failed to delete journal entry');
        }
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Journal entry deleted successfully');
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}

/**
 * Retrieves all journal entries based on the provided request user details.
 * @function getAllJurnalEntryController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function retrieves all journal entries based on the provided request user details.
 * It first checks the user's role and gets the admin and user IDs accordingly.
 * Then it calls the getAllJournalEntry function to fetch all journal entries and adds a serial number to each entry.
 * If there is an error while fetching the journal entries, it sends an appropriate error response back to the user.
 */
const getAllJurnalEntryController = async (req, res) => {
    try {
        // getting logged in user role
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
        // getting data of all journal entries based on admin and user
        const data = await getAllJournalEntry(adminId, userId, role);
        // adding serial number
        const addSerialNo = await addSerialNoComman(data)
        if (data.length < 0) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "No data found"
            })
        }
        return res.status(200).json({
            status: 200,
            message: "Data getting successfully",
            data: addSerialNo
        })
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while getting data",
        })
    }
}

/**
 * Updates a journal entry's reconciled to ledger status.
 * @function updateReconciledToLedgersController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function updates a journal entry's reconciled to ledger status based on the provided request parameter and body data.
 * It first checks if the id is valid, then it updates the journal entry.
 * If the id is invalid or there is an error while updating the journal entry, it sends an appropriate error response back to the user.
 */
const updateReconciledToLedgersController = async (req, res) => {
    // getting id from param
    const { id } = req?.params;
    // getting reconciled to ledger
    const { reconciled_to_ledger } = req?.body;
    // checking required params
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Required fields are missing',
        });
    }
    try {
        // updating reconciled to ledger
        const updatedJurnal = await updateReconciledToLedgersById({ id, reconciled_to_ledger });
        if (!updatedJurnal) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Journal entry not found',
            });
        }
        // sending response
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Journal entry updated successfully',
            data: updatedJurnal,
        });
    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'An error occurred while updating the journal entry',
        });
    }
}

/**
 * Updates a journal entry's reconciled to bank statement status.
 * @function updateReconciledToBankController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function updates a journal entry's reconciled to bank statement status based on the provided request parameter and body data.
 * It first checks if the id is valid, then it updates the journal entry.
 * If the id is invalid or there is an error while updating the journal entry, it sends an appropriate error response back to the user.
 */
const updateReconciledToBankController = async (req, res) => {
    // getting id from param
    const { id } = req?.params;
    // getting reconciled to ledger
    const { reconciled_to_bank_statement } = req?.body;
    // checking required params
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Required fields are missing',
        });
    }
    try {
        // updating reconciled to ledger
        const updatedJurnal = await updateReconciledToBankById({ id, reconciled_to_bank_statement });
        if (!updatedJurnal) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Journal entry not found',
            })
        }
        // sending response
        return res.status(200).json({
            success: true,
            message: 'Journal entry updated successfully',
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while updating the journal entry",
        })
    }
}

/**
 * Adds a note to a journal entry
 * @function addNotesToJournalEntryController
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise} Promise object representing the result of the operation
 * @throws {Error} If there is an error in the operation
 * 
 * This function adds a note to a journal entry based on the provided request parameter and body data.
 * It first checks if the id is valid, then it updates the journal entry.
 * If the id is invalid or there is an error while updating the journal entry, it sends an appropriate error response back to the user.
 */
const addNotesToJournalEntryController = async (req, res) => {
    // getting id from param
    const { id } = req?.params;
    // getting reconciled to ledger
    const { notes } = req?.body;
    // checking required params
    if (!notes) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Required fields are missing',
        });
    }
    try {
        // updating reconciled to ledger
        const updatedJurnal = await updateJurnalNotesById({ id, notes });
        // sending response
        if (!updatedJurnal) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Journal entry not found',
            })
        }
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Note Added successfully',
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while updating the journal entry",
        })
    }
}


module.exports = {
    getJurnalEntryController,
    addJurnalEntryController,
    updateJurnalEntryController,
    deleteJurnalEntryController,
    getAllJurnalEntryController,
    updateReconciledToLedgersController,
    updateReconciledToBankController,
    addNotesToJournalEntryController,
    updateBjournalBalanceAtDeleteController,
}
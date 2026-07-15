const { status } = require("init");
const { addClientLedger, getAllClientLedger, getClientLedger, updateClientLedgerById, deleteClientLedgerById, getAllFirmNames, getAllFirms, getClientNamesByFirm, getClientInf, getLedgerCliens, getClientNameByID, getLedgerBalanceBeforeDeletedRow, getLedgerBalanceAfterDeletedRow, updateLedgerBalanceAfterDelete, getLedgerClientInfo, getClientInfosById, getClientInfoByLedgerClient, getCaseLedgerBalanceBeforeDeletedRow, getCaseLedgerBalanceAfterDeletedRow, updateCaseLedgerBalanceAfterDelete } = require("../../model/admin/clientLedgerModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { getClientTrustAccountById } = require("../../model/admin/clientTrustAccountModel");
const { getJournalBalance, getLedgerBalance, addJurnalEntry, getJournalBalanceUpdate, getLedgerBalanceUpdate, updateJurnalEntryById, updateJournalBalanceAfterDelete, checkIfAdmin, getJournalBalanceAfterDeletedRow, isLedgerClientExists, getCaseLedgerBalanceUpdate } = require("../../model/admin/journalEntryModel");
const { updateBjournalBalanceAtDeleteController } = require("./JournalEntryController");
const { updateNextJournalAndLedgerBalance } = require("../../utils/balanceHelper");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { insertLedgerClient } = require("../../model/user/allClientsModel");


/**
 * Controller to add a client ledger entry.
 *
 * This function handles the HTTP request to add a new client ledger entry.
 * It validates and extracts user and transaction details from the request,
 * calculates running balances for the journal and ledger, and inserts the
 * transaction data into the journal. The function responds with appropriate
 * success or error messages based on the outcome of the operation.
 *
 * @param {Object} req - The request object containing user and transaction data.
 * @param {Object} res - The response object used to send back the HTTP response.
 */
const addClientLedgerController = async (req, res) => {
    try {
        // getting user role from request
        const role = req?.user?.role

        let adminId, userId
        // checking user role and getting admin id
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }
        // getting data from request body
        let {
            client_id, date, payee_name, transaction_method, cheque_number, purpose, transaction_type, amount, ledger_client_id, matter_id, notes, client_name
        } = req.body;

        // checking matter id
        if (matter_id === null || matter_id === undefined || matter_id === '') matter_id = null
        let ledgerClient = await isLedgerClientExists(client_name, client_id);
        if (!ledgerClient) {
            ledgerClient = await insertLedgerClient({ client_name, adminId, userId, client_id });
        }
        // getting ledger client id
        ledger_client_id = ledgerClient.id;
        // checking client id if not found then return
        if (!client_id) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Client not found',
            });
        }
        // checking required fields
        if (!payee_name || !transaction_method || !amount || !purpose || !transaction_type || !cheque_number) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Required fields are missing',
            });
        }

        // checking transaction type and based on that getting deposit or disbursement amount
        const deposit_amount = transaction_type === 'deposit' ? amount : 0;
        const disbursement_amount = transaction_type === 'disbursement' ? amount : 0;

        // fetching current balance on transaction date month
        const journalBalance = await getJournalBalance(client_id, adminId, userId, role);
        // fetching ledger balance
        const ledgerBalance = await getLedgerBalance(ledger_client_id, matter_id, adminId);

        // calculating journal running balance
        const journal_running_balance =
            Number(journalBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);

        // calculating ledger running balance
        const ledger_running_balance =
            Number(ledgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);

        // adding journal entry
        await addJurnalEntry({
            client_id, date, payee_name, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: ledger_running_balance, notes, reconcile_to_journal: true, reconciled_to_ledger: true, reconciled_to_bank_statement: false, ledger_client_id, matter_id, adminId, userId
        });

        // returning response
        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Ledger entry added successfully',
        });
    } catch (err) {
        // returning error
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'An error occurred while adding the client ledger',
        });
    }
}



/**
 * This function is used to get all client ledgers.
 * It fetches all the client ledgers from the database and returns them as a response.
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the client ledger records.
 * @throws {Error} - It throws an error if an error occurred while fetching the client ledger.
 */
const getAllClientLedgersController = async (req, res) => {
    try {
        // getting user role
        const role = req?.user?.role
        let adminId, userId
        // checking user role
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }
        // getting all client ledgers
        const success = await getAllClientLedger(adminId, userId, role)
        // checking if success length is less than 0 and returning response
        if (success.length < 0) {
            return res.status(200).json({
                status: 200,
                success: false,
                message: "No Client Ledger found"
            })
        }
        // adding serial number into data
        const addSerialNo = await addSerialNoComman(success);
        // returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "All Client Ledger fetched successfully",
            data: addSerialNo
        })
    } catch (error) {
        // returning error
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching Client Ledger"
        })
    }

}


/**
 * This function is used to get the client info by client id.
 * It fetches the client info from the database and returns it as a response.
 * @param {Object} req - The request object containing the client id.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the client info.
 * @throws {Error} - It throws an error if an error occurred while fetching the client ledger.
 */
const getClientInfoById = async (req, res) => {
    try {
        // getting client id from params
        const { id } = req.params;
        // getting client info
        const client = await getClientInf(id)
        // checking if client is found
        if (client && client[0]) {
            client[0].account_close_date = client[0].account_close_date ? new Date(client[0].account_close_date).toLocaleDateString('en-CA') : null
        }
        // returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Client info fetched successfully",
            data: client
        })
    } catch (error) {
        // returning error
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching Client Ledger"
        })
    }
}


/**
 * This function is used to get the client ledger based on the given filters.
 * It fetches the client ledger from the database and returns it as a response.
 * @param {Object} req - The request object containing the client id.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the client ledger records.
 * @throws {Error} - It throws an error if an error occurred while fetching the client ledger.
 */
// const getClientLedgersController = async (req, res) => {
//     try {
//         // getting user role
//         const role = req?.user?.role
//         let adminId, userId
//         // checking user role
//         if (role.toLowerCase() == 'admin') {
//             adminId = req?.user?.userid
//             userId = null;
//         } else {
//             userId = req?.user?.userid
//             adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
//         }

//         // getting values from requested body 
//         let { client_id, account_id, client_name, firm_name, purpose } = req.body
//         // validating values
//         if (!firm_name && !client_name) {
//             return res.status(400).json({
//                 status: 400,
//                 success: false,
//                 message: "Required fields are missing"
//             });
//         }
//         // getting ledger client id
//         let ledger_client_id = account_id;

//         if (!client_id) {
//             const client = await getClientInfoByLedgerClient(ledger_client_id);
//             client_id = client?.clientId || null;
//         }
//         // getting client info
//         const client = await getLedgerClientInfo(client_id);

//         // getting ledgers
//         const ledgers = await getClientLedger({ ledger_client_id, firm_name, purpose, adminId })
//         // checking if ledgers is found
//         if (!ledgers && ledgers.length <= 0) {
//             return res.status(200).json({
//                 status: 200,
//                 success: false,
//                 message: "No Client Ledger found"
//             })
//         }
//         // formatting date
//         ledgers.forEach((ledger) => {
//             ledger.date = ledger.date.toLocaleDateString('en-CA');
//         })
//         // adding serial number
//         const addSerialNo = await addSerialNoComman(ledgers);
//         // returning response
//         return res.status(200).json({
//             status: 200,
//             success: true,
//             message: "All Client Ledger fetched successfully",
//             data: { client, ledgers: addSerialNo }
//         })
//     } catch (error) {
//         // returning error
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: error.message || "An error occurred while fetching Client Ledger"
//         })
//     }
// }

const getClientLedgersController = async (req, res) => {
    try {
        // getting user role
        const role = req?.user?.role
        let adminId, userId
        // checking user role
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }

        // getting values from requested body 
        let { case_id, account_id, firm_name, purpose } = req.body
        // validating values
        if (!firm_name || !case_id || !account_id) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: "Required fields are missing"
            });
        }
        const trust_account_id = account_id;
        // getting client info
        const client = await getLedgerClientInfo(trust_account_id);

        // getting ledgers
        const ledgers = await getClientLedger({ case_id, ledger_client_id: null, firm_name, purpose, adminId })
        // checking if ledgers is found
        if (!ledgers && ledgers.length <= 0) {
            return res.status(200).json({
                status: 200,
                success: false,
                message: "No Client Ledger found"
            })
        }
        // formatting date
        ledgers.forEach((ledger) => {
            ledger.date = ledger.date.toLocaleDateString('en-CA');
        })
        // adding serial number
        const addSerialNo = await addSerialNoComman(ledgers);
        // returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "All Client Ledger fetched successfully",
            data: { client, ledgers: addSerialNo }
        })
    } catch (error) {
        // returning error
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching Client Ledger"
        })
    }
}



/**
 * Updates a client ledger entry with the provided details.
 *
 * This function retrieves the necessary user and admin IDs based on the user's role,
 * validates the request parameters and body, calculates the deposit and disbursement amounts,
 * updates the ledger and journal balances, and finally updates the client ledger entry
 * in the database. It also handles any errors that occur during this process and sends
 * the appropriate HTTP response.
 *
 * @param {Object} req - The request object containing user details, parameters, and body data.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - A JSON object with the status, success, and message of the operation.
 * If successful, returns a success message; otherwise, returns an error message.
 */
const updateClientLedgersController = async (req, res) => {
    try {
        // getting user role
        const role = req?.user?.role
        let adminId, userId
        // checking user role
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }
        // getting id from params
        const { id } = req?.params;
        // getting values from body
        let {
            client_id, date, payee_name, transaction_method, cheque_number, purpose, transaction_type, amount, ledger_client_id, matter_id, notes, reconcile_to_journal, client_name, case_id
        } = req.body;
        // checking values
        if (matter_id === null || matter_id === undefined || matter_id === '') matter_id = null
        let ledgerClient = await isLedgerClientExists(client_name, client_id);
        if (!ledgerClient) {
            ledgerClient = await insertLedgerClient({ client_name, adminId, userId, client_id });
        }
        // getting ledger client id
        ledger_client_id = ledgerClient.id;
        // validating
        if (!id) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'id is required'
            });
        }
        // checking reconcile to journal
        const is_reconciled = reconcile_to_journal == 'true' ? 1 : 0;
        // checking transaction type and based on that getting deposit and disbursement amount
        const deposit_amount = transaction_type === 'deposit' ? amount : 0;
        const disbursement_amount = transaction_type === 'disbursement' ? amount : 0;
        // getting previuos journal and ledger balance
        const previuosJournalBalance = await getJournalBalanceUpdate(id, client_id, adminId, userId, role);
        const previuosLedgerBalance = await getLedgerBalanceUpdate(id, ledger_client_id, matter_id, adminId);
        const previuosCaseLedgerBalance = await getCaseLedgerBalanceUpdate(id, case_id, adminId);

        // calculating running balance and ledger balance
        const running_balance = Number(previuosJournalBalance) + Number(deposit_amount) - Number(disbursement_amount)
        const ledger_running_balance = Number(previuosLedgerBalance) + Number(deposit_amount) - Number(disbursement_amount)
        // calculating case ledger running balance
        const case_ledger_running_balance =
            Number(previuosCaseLedgerBalance) +
            Number(deposit_amount) -
            Number(disbursement_amount);


        // preparing update data
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
            client_name,
            ledger_client_id,
            notes,
            reconcile_to_journal: is_reconciled,
            reconciled_to_ledger: is_reconciled,
        };

        // updating ledger
        const success = await updateClientLedgerById(id, updatedData);

        // updating the next journal and ledger balance
        await updateNextJournalAndLedgerBalance(id, ledger_client_id, case_id, matter_id, running_balance, case_ledger_running_balance, ledger_running_balance, 0, adminId, userId, role, client_id);
        // checking success
        if (!success) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Ledger entry not found'
            });
        }
        // returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Ledger entry updated successfully'
        });
    } catch (err) {
        // returning error
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || 'An error occurred while updating the Ledger'
        });
    }
}



/**
 * This function is used to update the ledger balance after a client ledger entry is deleted.
 * It fetches the last balance before the deleted row, and then fetches all the rows after the deleted row.
 * It then updates the ledger balance of all the rows after the deleted row by adding the last balance before the deleted row to it.
 * @param {Number} id - The id of the deleted client ledger entry.
 * @param {Number} adminId - The id of the admin user.
 * @param {Number} userId - The id of the user.
 * @param {String} role - The role of the user.
 * @returns {Boolean} true if the operation is successful, false otherwise.
 */
const updateClientLedgerAtDelete = async (id, case_id, client_id, matter_id, adminId, userId, role) => { //id, case_id, client_id, matter_id, adminId
    try {
        // getting client info
        const { ledger_client_id } = await getClientNameByID(id);

        // getting the last balance before the deleted row
        const beforeBalance = await getLedgerBalanceBeforeDeletedRow(id, ledger_client_id, matter_id, adminId, userId, role);
        const beforeCaseLedgerBalance = await getCaseLedgerBalanceBeforeDeletedRow(id, case_id, matter_id, adminId, userId, role);
        // checking if there is a balance
        if (beforeBalance) {
            // getting all the rows before the deleted row
            const afterBalance = await getLedgerBalanceAfterDeletedRow(id, adminId, ledger_client_id, matter_id);
            // checking if there is a balance
            if (afterBalance.length > 0) {
                afterBalance.forEach((row, index) => {
                    // claculating based on index. if index is 0 then adding the last balance before the deleted row to it else adding the previous balance to it
                    if (index === 0) {
                        row.ledger_balance = Number(beforeBalance.ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    } else {
                        row.ledger_balance = Number(afterBalance[index - 1].ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    }
                });
            }
            // bulk updatng the values
            const updatedCount = await updateLedgerBalanceAfterDelete(afterBalance);
            if (updatedCount <= 0) {
                throw new Error("Failed to calculate journal balance");
            }
        }

        // checking if there is a balance
        if (beforeCaseLedgerBalance) {
            // getting all the rows before the deleted row
            const afterBalance = await getCaseLedgerBalanceAfterDeletedRow(id, adminId, case_id, matter_id);
            // checking if there is a balance
            if (afterBalance.length > 0) {
                afterBalance.forEach((row, index) => {
                    // claculating based on index. if index is 0 then adding the last balance before the deleted row to it else adding the previous balance to it
                    if (index === 0) {
                        row.case_ledger_balance = Number(beforeCaseLedgerBalance.case_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    } else {
                        row.case_ledger_balance = Number(afterBalance[index - 1].case_ledger_balance) + Number(row.deposit_amount) - Number(row.disbursement_amount);
                    }
                });
            }
            // bulk updatng the values
            const updatedCount = await updateCaseLedgerBalanceAfterDelete(afterBalance);
            if (updatedCount <= 0) {
                throw new Error("Failed to calculate journal balance");
            }
        }

        return true;
    } catch (err) {
        // returning error
        throw new Error("Failed to calculate journal balance: " + err.message);
    }
};


/**
 * This function is used to delete a client ledger entry.
 * It takes the id of the client ledger entry as a parameter.
 * It first checks if the id is valid, then it calls the updateBjournalBalanceAtDeleteController function to update the journal balances.
 * Then it calls the updateClientLedgerAtDelete function to update the ledger balances.
 * After that, it deletes the client ledger entry and sends a response back to the user.
 * If the id is invalid or there is an error while deleting the client ledger entry, it sends an appropriate error response back to the user.
 * @param {Number} id - The id of the client ledger entry to be deleted.
 */
const deleteClientLedgerController = async (req, res) => {
    // getting id from parameter
    const { id } = req?.params
    // getting user role
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
    // checking if id is valid
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: "Id is required!"
        })
    }
    // getting client info
    const { ledger_client_id, matter_id } = await getClientNameByID(id);

    try {
        // updating journal balance
        await updateBjournalBalanceAtDeleteController(id, adminId, userId, role);
        // updating ledger balance
        await updateClientLedgerAtDelete(id, adminId, userId, role);
        // deleting client ledger
        const data = await deleteClientLedgerById(id);
        // checking if client ledger is deleted
        if (!data) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "Client Ledger not found"
            })
        }
        // sending response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Client Ledger deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while deleting Client Ledger"
        })
    }
}



/**
 * This function is used to get all firm names.
 * It fetches all the firm names from the database and returns them as a response.
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the firm names.
 * @throws {Error} - It throws an error if an error occurred while fetching the firm names.
 */
const getAllFirmNamesController = async (req, res) => {
    try {
        // getting user role
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
        // getting all firm names
        const firmNames = await getAllFirmNames(adminId, userId, role);
        // checking if success length is less than 0 and returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Firm names fetched successfully",
            data: firmNames
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching firm names"
        });
    }
};


/**
 * This function is used to get all firms.
 * It fetches all the firms from the database and returns them as a response.
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the firm records.
 * @throws {Error} - It throws an error if an error occurred while fetching the firms.
 */
const getFirms = async (req, res) => {
    try {
        // getting user role
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
        // getting all firms
        const firms = await getAllFirms(adminId, userId, role);
        // checking if success length is less than 0 and returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Firms fetched successfully",
            data: firms
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching firms"
        });
    }
}


/**
 * This function is used to get all clients by firm.
 * It fetches all the clients belonging to a given firm from the database and returns them as a response.
 * @param {Object} req - The request object containing user details and the firm name.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - It returns a JSON object with the status, success, message and data.
 * The data object contains the client records.
 * @throws {Error} - It throws an error if an error occurred while fetching the clients by firm.
 */
const getClientsByFirm = async (req, res) => {
    try {
        // getting user role
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
        // getting firm name from request
        const { firm_name } = req.body;
        // checking if firm name is present
        if (!firm_name || typeof firm_name !== 'string') {
            return res.status(400).json({
                status: 400,
                success: false,
                message: "Required field 'firm_name' must be a string"
            });
        }
        // getting clients
        const clients = await getClientNamesByFirm(firm_name, adminId, userId, role);
        // checking if success length is less than 0 and returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Clients fetched successfully",
            data: clients
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: err.message || "An error occurred while fetching clients by firm"
        });
    }
};


/**
 * Fetches the list of clients based on the user's role and ID.
 *
 * This function retrieves the user ID and admin ID based on the logged-in user's role,
 * and fetches the clients associated with the admin or user ID from the ledger.
 * It then returns the clients' data in a successful HTTP response.
 * If an error occurs during the process, it sends an error response with the appropriate message.
 *
 * @param {Object} req - The request object containing user details.
 * @param {Object} res - The response object used to send back the HTTP response.
 * @returns {Object} - A JSON response with the clients' data if successful, or an error message if not.
 */
const getClientList = async (req, res) => {
    try {
        // getting user role
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
        // getting clients
        const clients = await getLedgerCliens(adminId, userId, role);
        // checking if success length is less than 0 and returning response
        return res.status(200).json({
            status: 200,
            success: true,
            message: "Clients fetched successfully",
            data: clients
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while fetching clients"
        });
    }
}



module.exports = {
    addClientLedgerController,
    getAllClientLedgersController,
    getClientLedgersController,
    updateClientLedgersController,
    deleteClientLedgerController,
    getAllFirmNamesController,
    getFirms,
    getClientsByFirm,
    getClientInfoById,
    getClientList,
    updateClientLedgerAtDelete
}
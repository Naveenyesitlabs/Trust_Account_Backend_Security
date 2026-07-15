const { getJournalBalance, getLedgerBalance, addJurnalEntry, getJournalEntryById, getJournalBalanceUpdate, getLedgerBalanceUpdate, removeFromOutstanding } = require("../../model/admin/journalEntryModel");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { addMatter, getMatterByClientId, getMatters, updateMatterNote, updateMatterResolveStatus, updateMatter, getJournalClientID, getJournalEntryByLien, getMatterById } = require("../../model/user/matterModel");
const { get } = require("../../routes/admin/userManagementRoutes");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");

const createMatterSchema = Joi.object({
    ledger_client_id: Joi.number().required().messages({
        'any.required': 'Client ID is mandatory.',
        'number.base': 'Client ID must be a number.'
    }),
    matter: Joi.string().required().messages({
        'any.required': 'Name is mandatory.',
        'string.empty': 'Name cannot be empty.',
    }),
    lien_holder: Joi.string().required().messages({
        'any.required': 'Lien holder is mandatory.',
        'string.empty': 'Lien holder cannot be empty.',
    }),
    case_summary: Joi.string().allow(null, "").optional(),
    amount: Joi.number().required().messages({
        'any.required': 'Amount is mandatory.',
        'number.base': 'Amount must be a number.',
    }),
    amount_paid: Joi.number().allow(null, 0, "").optional(),
    opened_on: Joi.string().required().messages({
        'any.required': 'Opened on is mandatory.',
        'string.empty': 'Opened on cannot be empty.',
    }),
    closed_on: Joi.allow("").optional(),
    description: Joi.allow("").optional(),
    case_date: Joi.date().required().messages({
        'any.required': "Please enter case date",
        'date.base': "Case date must be a valid date",
        'any.invalid': "Invalid case date"
    }),
    transaction_method: Joi.string().allow(null, "").optional(),
    cheque_number: Joi.string().allow(null, "").optional(),
    date: Joi.date().required().messages({
        'any.required': "Please enter date",
        'date.base': "Date must be a valid date",
        'any.invalid': "Invalid date"
    })
})


/**
 * Create new matter based on specific client
 * METHOD: POST
 * ENDPOINT: /user/matter/create
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const createMatter = async (req, res) => {
    try {
        // validating payload
        const { error } = createMatterSchema.validate(req.body, { convert: true });
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }
        // getting logged in user id
        const userId = req?.user?.userid;
        // getting admin id of this logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        // destructuring the input
        const { ledger_client_id, matter, lien_holder, case_summary, amount, amount_paid, opened_on, closed_on, description, case_date, transaction_method, cheque_number, date } = req.body;
        let balance = 0;
        let status = 'Pending';
        // Convert empty string to null for closed_on
        let finalClosedOn = closed_on === "" ? null : closed_on;
        // calculating balance and status
        if (Number(amount_paid) > 0) {
            balance = Number(amount) - Number(amount_paid);
            if (balance === 0) {
                status = 'Paid';
                finalClosedOn = new Date().toLocaleDateString('en-CA');
            } else {
                status = 'Partially Paid';
            }
        }
        // ceateing new matter
        const insertMatter = await addMatter({ ledger_client_id, date, matter, lien_holder, case_summary, amount, amount_paid, balance, opened_on, closed_on: finalClosedOn, description, status, case_date, adminId, userId });

        // checking matter created or not
        if (!insertMatter) {
            respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Error creating matter in database');
        }

        const lien_id = insertMatter.id;

        /** Inserting lien into journal entry */
        const client_id = await getJournalClientID(ledger_client_id);
        // fetching current balance on transaction date month
        const journalBalance = await getJournalBalance(client_id, adminId, userId, "");
        // calculating journal running balance
        const journal_running_balance = Number(journalBalance) - Number(amount_paid);
        // fetching ledger balance
        const ledgerBalance = await getLedgerBalance(ledger_client_id, null, adminId);
        // calculating ledger running balance
        ledger_running_balance = Number(ledgerBalance) - Number(amount_paid);
        // const purpose = 'Lien';
        // const deposit_amount = 0;
        // const disbursement_amount = Number(amount_paid);
        // const notes = `Lien for matter ${matter}`
        // const is_bank_charge = false;
        // const bank_ledger_balance = 0;
        // const matter_id = null;
        // const is_lien = true;
        // const is_outstanding = status === 'Paid' ? false : true;
        // await addJurnalEntry({
        //     client_id, date, payee_name: lien_holder, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: ledger_running_balance, bank_ledger_balance, notes, reconciled_to_ledger: false, reconciled_to_bank_statement: false, ledger_client_id, matter_id, adminId, userId, is_bank_charge, is_lien, lien_id, is_outstanding
        // });

        // retuning success response
        return respond(res, true, HTTP_STATUS_CODE.CREATED, 'Matter created successfully');
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const updateLien = async (req, res) => {
    try {
        // getting logged in user id
        const { id } = req.params;
        if (!id || isNaN(id) || id === undefined) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Matter ID is mandatory.');
        }

        const currentLienData = await getMatterById(id);

        // getting logged in user id
        const userId = req?.user?.userid;
        // getting admin id of this logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        const { ledger_client_id, matter, lien_holder, case_summary, amount, amount_paid, opened_on, closed_on, description, case_date, transaction_method, cheque_number, date } = req.body;
        let balance = 0;
        let status = 'Pending';
        // Convert empty string to null for closed_on
        let finalClosedOn = closed_on === "" ? null : closed_on;
        // calculating balance and status
        if (Number(amount_paid) > 0) {
            balance = Number(amount) - Number(amount_paid);
            if (balance === 0) {
                status = 'Paid';
                finalClosedOn = new Date().toLocaleDateString('en-CA');
            } else {
                status = 'Partially Paid';
            }
        }
        const updateLien = await updateMatter(id, { ledger_client_id, date, matter, lien_holder, case_summary, amount, amount_paid, balance, opened_on, closed_on: finalClosedOn, description, status, case_date, adminId, userId });
        if (!updateLien) {
            respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Error updating matter in database');
        }

        // if (Number(amount_paid) > Number(currentLienData?.amount_paid)) {
        //     const lien_id = id;

        //     /** Inserting lien into journal entry */
        //     const client_id = await getJournalClientID(ledger_client_id);
        //     // fetching current balance on transaction date month
        //     const journalBalance = await getJournalBalance(client_id, adminId, userId, "");
        //     // calculating journal running balance
        //     const journal_running_balance = Number(journalBalance) - Number(amount_paid);
        //     // fetching ledger balance
        //     const ledgerBalance = await getLedgerBalance(ledger_client_id, null, adminId);
        //     // calculating ledger running balance
        //     ledger_running_balance = Number(ledgerBalance) - Number(amount_paid);
        //     const purpose = 'Lien';
        //     const deposit_amount = 0;
        //     const disbursement_amount = Math.abs(Number(currentLienData?.amount_paid) - Number(amount_paid));
        //     const notes = `Lien for matter ${matter}`
        //     const is_bank_charge = false;
        //     const bank_ledger_balance = 0;
        //     const matter_id = null;
        //     const is_lien = true;
        //     const is_outstanding = status === 'Paid' ? false : true;

        //     if (is_outstanding === false) {
        //         await removeFromOutstanding(lien_id);
        //     }

        //     await addJurnalEntry({
        //         client_id, date, payee_name: lien_holder, transaction_method, cheque_number, purpose, deposit_amount, disbursement_amount, running_balance: journal_running_balance, ledger_balance: ledger_running_balance, bank_ledger_balance, notes, reconciled_to_ledger: false, reconciled_to_bank_statement: false, ledger_client_id, matter_id, adminId, userId, is_bank_charge, is_lien, lien_id, is_outstanding
        //     });
        // }
        // retuning success response        
        respond(res, true, HTTP_STATUS_CODE.OK, 'Matter updated successfully');

    } catch (error) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const getMatterByClient = async (req, res) => {
    try {
        const { ledger_client_id } = req.params;

        if (!ledger_client_id || isNaN(ledger_client_id) || ledger_client_id === undefined) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client ID is mandatory.');
        }

        const matters = await getMatterByClientId(ledger_client_id);

        return respond(res, true, HTTP_STATUS_CODE.OK, 'Matters fetched successfully', matters);
    } catch (error) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const getAllMatters = async (req, res) => {
    try {
        // getting logged in user id
        const userId = req?.user?.userid;
        // getting adminId by logged in user
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        // fetching clients
        const matters = await getMatters(adminId);
        if (matters.length > 0) {
            matters.forEach((matter) => {
                matter.date_issued = new Date(matter.date_issued).toLocaleDateString('en-CA');

                if (!matter.closed_on || isNaN(new Date(matter.closed_on))) {
                    matter.closed_on = "";
                } else {
                    matter.closed_on = new Date(matter.closed_on).toLocaleDateString('en-CA');
                }
            });
        }


        const dataWithSerialNo = await addSerialNoComman(matters);

        // returning response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Matters fetched successfully', dataWithSerialNo);
    } catch (error) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const addMatterNote = async (req, res) => {
    try {
        // getting parameter
        const { id } = req.params;
        // getting payload
        const { notes } = req.body;
        // updating matter
        const updateMatter = await updateMatterNote(id, notes);
        // checking matter updated or not
        if (!updateMatter) {
            respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Error adding note in database');
        }
        // returning success response
        respond(res, true, HTTP_STATUS_CODE.OK, 'Note added successfully');
    } catch (error) {
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const updateResolveStatus = async (req, res) => {
    try {
        // getting parameter
        const { id } = req.params;
        // getting payload
        const { resolve_status } = req.body;
        // updating matter
        const updateMatter = await updateMatterResolveStatus(id, resolve_status);
        // checking matter updated or not
        if (!updateMatter) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Error updating resolve status in database');
        }
        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Matter marked as resolved successfully');
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


module.exports = {
    createMatter,
    getMatterByClient,
    getAllMatters,
    addMatterNote,
    updateResolveStatus,
    updateLien,
}
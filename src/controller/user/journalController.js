const { parse } = require("dotenv");
const { getClientInfo } = require("../../model/user/clientModel");
const { saveJournalEntry, fetchAllJournal } = require("../../model/user/journalModel");
const { insertLedger } = require("../../model/user/ledgerModel");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");
const { getJournalBalance, getLedgerBalance } = require("../../model/admin/journalEntryModel");

// validation schema to add new entry in journal
const journalSchema = Joi.object({
    client_name: Joi.string().required().messages({
        'any.required': 'Client name is mandatory.',
        'string.empty': 'Client name cannot be empty.',
    }),
    transaction_date: Joi.date().required().messages({
        'any.required': "Please enter transaction date",
        'string.empty': "Transaction date cannot be empty."
    }),
    payor_payee: Joi.string().required().messages({
        'any.required': 'Payor/Payee is required.',
        'string.empty': 'Payor/Payee cannot be empty.'
    }),
    transaction_method: Joi.string().required().messages({
        'any.required': "Transaction method is required.",
        'string.empty': "Transaction method cannot be empty."
    }),
    check_number: Joi.string().allow(null, "").optional(),
    purpose: Joi.string().allow(null, "").optional(),
    deposit: Joi.number().allow(null, "").optional(),
    disbursement: Joi.number().allow(null, "").optional(),
    notes: Joi.string().allow(null, "").optional(),
    is_reconcile_ledger: Joi.any().allow(null).optional(),
    is_reconcile_bank: Joi.any().allow(null).optional()
});

const createJournal = async ({ clientId, monthNumber, deposit, disbursement, transaction_date, payor_payee, transaction_method, check_number, purpose, notes, is_reconcile_ledger, is_reconcile_bank }) => {
    try {
        // fetching current balance on transaction date month
        const journalBalance = await getJournalBalance();


        if (journalBalance === false) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching journal balance.');
        }

        // fetching ledger balance based on transaction date month
        const ledgerBalance = await getLedgerBalance(clientId, monthNumber);

        if (ledgerBalance === false) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching ledger balance.');
        }

        // calculating balance of journal and ledger for this entry
        let journalRunningBalance = parseFloat(journalBalance) + parseFloat(deposit) - parseFloat(disbursement);
        let ledgerRunningBalance = parseFloat(ledgerBalance) + parseFloat(deposit) - parseFloat(disbursement);

        // adding journal entry
        const journal_id = await saveJournalEntry({ client_id: clientId, transaction_date, payor_payee, transaction_method, check_number, purpose, deposit, disbursement, running_balance: journalRunningBalance, notes, is_reconcile_ledger, is_reconcile_bank });
        if (!journal_id) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error creating journal entry.');
        }

        // adding into ledger for this journal entry
        const ledger_id = await insertLedger({ client_id: clientId, transaction_date, payor_payee, transaction_method, check_number, purpose, deposit, disbursement, running_balance: ledgerRunningBalance, is_reconcile_to_journal: is_reconcile_ledger });
        if (!ledger_id) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error creating ledger entry.');
        }
    } catch (err) {
        return false;
    }
}

/**
 * New single entry add in journal
 * METHOD: POST
 * ENDPOINT: /user/journal/create
 * @param {*} req 
 * @param {*} res 
 */
const addNewJournalEntry = async (req, res) => {
    try {
        // validating payload
        const { error } = journalSchema.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }

        const { client_name, transaction_date, payor_payee, transaction_method, check_number, purpose, deposit, disbursement, notes, is_reconcile_ledger, is_reconcile_bank } = req.body;

        // getting transaction date month
        const [year, month, day] = transaction_date.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        const monthNumber = date.getMonth() + 1;


        // getting client id by client name
        const client = await getClientInfo(null, client_name);
        if (!client) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client does not exist.');
        }

        const clientId = client.clientId;

        const save = await saveJournalEntry({ clientId, monthNumber, deposit, disbursement, transaction_date, payor_payee, transaction_method, check_number, purpose, notes, is_reconcile_ledger, is_reconcile_bank });
        if (!save) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error creating journal entry.');
        }

        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Entry successfull in journal.', { id: journal_id });
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}

/**
 * Get journal list of particular client
 * METHOD: GET
 * ENDPOINT: /user/journal/fetch
 * @param {*} req 
 * @param {*} res 
 */
const getJournalList = async (req, res) => {
    try {
        const { bank_name, account_number, account_name } = req.query;

        // decode query parameters (if needed)
        bank_name = decodeURIComponent(bank_name);
        account_number = decodeURIComponent(account_number);
        account_name = decodeURIComponent(account_name);

        // validating payload
        if (!bank_name || !account_number || !account_name) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Bank name, account number and account name are mandatory.');
        }

        // getting client id by client name
        const client = await getClientInfo(null, null, bank_name, account_number, account_name);
        if (!client) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Client does not exist.');
        }

        // getting journal list
        const journalList = await fetchAllJournal(bank_name, account_number, account_name);
        if (!journalList) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error fetching journal list.');
        }

        // if journal list is empty
        if (journalList.length === 0) {
            return respond(res, false, HTTP_STATUS_CODE.OK, 'Journal list not found.', {});
        }

        // formatting journal list
        journalList.forEach(journal => {
            journal.deposit = parseFloat(journal.deposit);
            journal.disbursement = parseFloat(journal.disbursement);
            journal.running_balance = parseFloat(journal.running_balance);
            journal.transaction_date = journal.transaction_date.toISOString().split('T')[0];
        });

        // returning success response
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Journal list fetched successfully.', { journals: journalList, client: client });
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}

module.exports = {
    addNewJournalEntry,
    getJournalList,
    createJournal
}
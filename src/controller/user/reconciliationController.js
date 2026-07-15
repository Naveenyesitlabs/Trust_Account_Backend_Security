const { getClientId } = require("../../model/admin/clientTrustAccountModel");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { getReconcileJournalBalance, getReconcileLedgerBalance, getReconcileBankLedgerBalance, getReconcileClientId, getReconcileEndingBalance, getOutstandingsSum, getAccountData, getReconciliationDiscard, insertReconciliationDiscard, updateReconciliationDiscard, getJournalEntryUsersDB, getLastBankStatementPeriodDB, checkIfFullyReconciled } = require("../../model/user/reconciliationModel");
const { addNotification } = require("../../utils/notificationHelper");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");
const Joi = require("joi");

const reconcileValidation = Joi.object({
    firm_name: Joi.string().required().messages({
        'any.required': 'Firm name is required',
        'string.base': 'Firm name must be a string',
    }),
    bank_name: Joi.string().required().messages({
        'any.required': 'Bank name is required',
        'string.base': 'Bank name must be a string',
    }),
    account_name: Joi.string().required().messages({
        'any.required': 'Account name is required',
        'string.base': 'Account name must be a string',
    }),
    account_number: Joi.string().required().messages({
        'any.required': 'Account number is required',
        'string.base': 'Account number must be a string',
    }),
    account_open_date: Joi.date().required().messages({
        'any.required': 'Account open date is required',
        'date.base': 'Account open date must be a valid date',
    }),
    account_close_date: Joi.string()
        .allow(null, '')
        .optional()
        .custom((value, helpers) => {
            if (!value) return value;
            const date = new Date(value);
            return isNaN(date.getTime())
                ? helpers.message('Account close date must be a valid date')
                : value;
        }),
});

const getLastDatesOfMonthsInRange = (account_open_date, account_close_date) => {
    const start = new Date(account_open_date);
    const end = new Date(account_close_date);
    const lastDates = [];

    // Set to first day of the month
    let current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
        // Get the last date of the current month
        const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        if (lastDay >= start && lastDay <= end) {
            // Add one day to lastDay
            lastDay.setDate(lastDay.getDate() + 1);
            // Format to yyyy-mm-dd
            const formatted = lastDay.toISOString().split('T')[0];
            lastDates.push(formatted);
        }
        // Move to next month
        current.setMonth(current.getMonth() + 1);
    }

    // Add one day to the last date
    if (lastDates.length > 0) {
        const lastDate = new Date(lastDates[lastDates.length - 1]);
        lastDate.setDate(lastDate.getDate() + 1);
        const plusOneFormatted = lastDate.toISOString().split('T')[0];
        lastDates[lastDates.length - 1] = plusOneFormatted;
    }

    return lastDates;
};

const getLastMonthStartAndEnd = () => {
    const today = new Date();

    // Last month
    const lastMonth = today.getMonth() - 1;
    const year = lastMonth < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const month = lastMonth < 0 ? 11 : lastMonth;

    // First day of last month
    const firstDay = new Date(year, month, 1);

    // Last day of last month
    const lastDay = new Date(year, month + 1, 0);

    // Format as yyyy-mm-dd in local time
    const format = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    return {
        firstDay: format(firstDay),
        lastDay: format(lastDay)
    };
};

const addOneDay = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA'); // yyyy-mm-dd
};

const prepareReconcilement = async (req, res) => {
    try {
        // validating request
        const { error } = reconcileValidation.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }
        // getting data from request body
        let { firm_name, bank_name, account_name, account_number, account_open_date, account_close_date } = req.body;
        if (!account_close_date || account_close_date == "" || account_close_date == null) {
            account_close_date = null;
        }

        const account = await getAccountData(account_name, account_number, firm_name, bank_name, account_open_date, account_close_date);
        if (!account) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No account found by the given details.');
        // getting admin id based on current user logged in
        const userId = req?.user?.userid;
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        const lastBankStatementPeriod = await getLastBankStatementPeriodDB(adminId, bank_name, account_number);
        let { firstDay, lastDay } = lastBankStatementPeriod;
        if (!firstDay || !lastDay) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No bank statement found.');
        const isReconciled = await checkIfFullyReconciled(adminId, firm_name, bank_name, account_name, account_number, addOneDay(firstDay), addOneDay(lastDay));
        if (!isReconciled) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'Reconciliation failed due to mismatched transactions.');

        // fetching reconcile journal balance
        const reconcileJournalBalance = await getReconcileJournalBalance(adminId, firm_name, bank_name, account_name, account_number, addOneDay(firstDay), addOneDay(lastDay));
        if (reconcileJournalBalance === 0) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No data found to reconcile.');
        // fetching reconcile ledger balance
        const reconcileLedgerBalance = await getReconcileLedgerBalance(adminId, firm_name, bank_name, account_name, account_number, firstDay, lastDay);
        if (reconcileLedgerBalance === 0) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No data found to reconcile.');
        // fetching reconcile bank ledger balance
        const reconcileBankLedgerBalance = await getReconcileBankLedgerBalance(adminId, firm_name, bank_name, account_name, account_number, addOneDay(firstDay), addOneDay(lastDay));
        // calculating total reconciled balance
        const totalReconciledLedgerBalance = Number(reconcileLedgerBalance) + Number(reconcileBankLedgerBalance);
        // fetching client id
        const client_id = await getReconcileClientId(account_name, account_number, firm_name, bank_name, adminId);
        // fetching bank statement ending balance
        const reconcileBankEndingBalance = await getReconcileEndingBalance(client_id, firstDay, lastDay);
        if (!reconcileBankEndingBalance) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, 'No bank statement uploaded yet.');
        // fetching outstanding deposits
        const reconcileOutstandingDeposits = await getOutstandingsSum(adminId, firstDay, lastDay, 'deposit');
        // fetching outstanding disbursment
        const reconcileOutstandingDisbursment = await getOutstandingsSum(adminId, firstDay, lastDay, 'disbursement');
        // calculating bank statement balance
        const reconcileBankStatementBalance = Number(reconcileBankEndingBalance) + Number(reconcileOutstandingDeposits) - Number(reconcileOutstandingDisbursment);

        const return_data = {
            journal_balance: Number(reconcileJournalBalance),
            total_individual_ledger_balance: Number(reconcileLedgerBalance),
            bank_charges_ledger_balance: Number(reconcileBankLedgerBalance),
            total_ledger_balance: Number(totalReconciledLedgerBalance),
            bank_statement_ending_balance: Number(reconcileBankEndingBalance),
            total_outstanding_deposits: Number(reconcileOutstandingDeposits),
            total_outstanding_disbursment: Number(reconcileOutstandingDisbursment),
            adjusted_bank_statement_balance: Number(reconcileBankStatementBalance)

        }
        // returning response
        return respond(res, true, HTTP_STATUS_CODE.OK, "Reconcile journal balance fetched successfully", return_data);
    } catch (error) {

        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}

const validateReconciliation = async () => {

}

const discardReconciliation = async (req, res) => {
    try {

        const { firm_name, bank_name, account_name, account_number, start_date, end_date, journal_balance_q1, ledger_a_q1, ledger_a_q2, ledger_b_q1, bank_statement_q1 } = req.body;
        const userId = req?.user?.userid;
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        const existingDiscardData = await getReconciliationDiscard(firm_name, account_name, account_number, start_date, end_date);
        let existingDiscardDataId = existingDiscardData?.id || null;

        if (existingDiscardDataId == null) {

            const newDiscardData = await insertReconciliationDiscard({
                firm_name,
                account_name,
                account_number,
                start_date,
                end_date,
                journal_balance_q1,
                ledger_a_q1,
                ledger_a_q2,
                ledger_b_q1,
                bank_statement_q1,
                adminId,
                userId
            });

            if (!newDiscardData) {
                return respond(res, true, HTTP_STATUS_CODE.OK, "Failed to add reconcile discard reason");
            }

            const journalEntryUsers = await getJournalEntryUsersDB({ adminId, firm_name, bank_name, account_name, account_number, account_number, start_date, end_date });

            if (journalEntryUsers?.length > 0) {
                for (const user of journalEntryUsers) {
                    await addNotification(`Reconciliation Discard`, `Reconciliation Discard Reason Added`, 'other', 'user', user?.userId);
                }
            }
            // await addNotification(`Reconciliation Discard`, `Reconciliation Discard Reason Added`, 'other', 'user', userId);
            return respond(res, true, HTTP_STATUS_CODE.OK, "Reconcile discard reason added successfully");
        } else {
            const updated = await updateReconciliationDiscard(existingDiscardDataId, {
                journal_balance_q1,
                ledger_a_q1,
                ledger_a_q2,
                ledger_b_q1,
                bank_statement_q1,
            });

            if (!updated) {
                return respond(res, true, HTTP_STATUS_CODE.OK, "Failed to update reconcile discard reason");
            }
            const journalEntryUsers = await getJournalEntryUsersDB({ adminId, firm_name, bank_name, account_name, account_number, account_number, start_date, end_date });

            if (journalEntryUsers?.length > 0) {
                for (const user of journalEntryUsers) {
                    await addNotification(`Reconciliation Discard`, `Reconciliation Discard Reason updated`, 'other', 'user', user?.userId);
                }
            }
            // await addNotification(`Reconciliation Discard`, `Reconciliation Discard Reason updated`, 'other', 'user', userId);
            return respond(res, true, HTTP_STATUS_CODE.OK, "Reconcile discard reason updated successfully");
        }

    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
};



const getReconciliationDiscardReasons = async (req, res) => {
    try {
        let { firm_name,
            account_name,
            account_number, start_date, end_date } = req.body;
        if (!firm_name || !account_name || !account_number || !start_date) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
        if (!end_date) end_date = null;
        const data = await getReconciliationDiscard(firm_name, account_name, account_number, start_date, end_date);
        return respond(res, true, HTTP_STATUS_CODE.OK, "Reconcile discard reason fetched successfully", data);
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}

const confirmReconciliation = async (req, res) => {
    try {
        let { firm_name, bank_name, account_name, account_number, start_date, end_date, is_journal_balance_q1_reconciled, is_ledger_a_q1_reconciled, is_ledger_a_q2_reconciled, is_ledger_b_q1_reconciled, is_bank_statement_q1_reconciled, key } = req.body;
        const userId = req?.user?.userid;
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        if (!firm_name || !bank_name || !account_name || !account_number || !start_date) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "Required fields are missing");
        if (!end_date) end_date = null;
        let message = "";
        switch (key) {
            case 'journal_balance_q1':
                message = "Journal balance reconciled successfully";
                break;
            case 'ledger_a_q1':
                message = 'Individual client ledger balance reconciled successfully';
                break;
            case 'ledger_a_q2':
                message = 'Each entry contain the information satisfied the Standard (1)(b) under the ledger';
                break;
            case 'ledger_b_q1':
                message = 'Total bank charges reconciled successfully';
                break;
            case 'bank_statement_q1':
                message = 'Adjusted bank statement balance Reconciled Successfully';
                break;
            default:
                return;
        }
        const existingDiscardData = await getReconciliationDiscard(firm_name, account_name, account_number, start_date, end_date);
        let existingDiscardDataId = existingDiscardData?.id || null;

        if (existingDiscardDataId == null) {

            const newDiscardData = await insertReconciliationDiscard({
                firm_name,
                account_name,
                account_number,
                start_date,
                end_date,
                is_journal_balance_q1_reconciled,
                is_ledger_a_q1_reconciled,
                is_ledger_a_q2_reconciled,
                is_ledger_b_q1_reconciled,
                is_bank_statement_q1_reconciled,
                adminId,
                userId
            });

            if (!newDiscardData) {
                return respond(res, true, HTTP_STATUS_CODE.OK, "Failed to confirm reconciliation");
            }
        } else {

            const updated = await updateReconciliationDiscard(existingDiscardDataId, {
                is_journal_balance_q1_reconciled,
                is_ledger_a_q1_reconciled,
                is_ledger_a_q2_reconciled,
                is_ledger_b_q1_reconciled,
                is_bank_statement_q1_reconciled,
            });

            if (!updated) {
                return respond(res, true, HTTP_STATUS_CODE.OK, "Failed to confirm reconciliation");
            }
        }
        return respond(res, true, HTTP_STATUS_CODE.OK, message);
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}

module.exports = {
    prepareReconcilement,
    discardReconciliation,
    getReconciliationDiscardReasons,
    confirmReconciliation
}
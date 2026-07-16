const Joi = require("joi");
const { respond, HTTP_STATUS_CODE, normalizeDate, getMonthNumber } = require("../../utils/reponseHelper");
const { isClientExists, createClient, modifyClient } = require("../../model/user/clientModel");
const { insertTrustDocuments, getRecentClientTrustEntryDocuments } = require("../../model/user/clientTrustEntryModel");
const path = require('path');
const fs = require('fs');
const { insertBankStatements } = require("../../model/user/bankStatementsModel");
const { saveJournalEntry } = require("../../model/user/journalModel");
const { createJournal } = require("./journalController");
const { proccessOcr } = require("../../services/BankStatementParser");
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { sanitizePathSegment } = require("../../utils/pathSafety");


// Validation schema for client trust entry payload
const clientTrustEntrySchema = Joi.object({
    bank_name: Joi.string().required().messages({
        'any.required': 'Bank name is mandatory.',
        'string.empty': 'Bank name cannot be empty.',
    }),
    bank_info: Joi.string().allow('').optional() // Optional field, can be an empty string
});


const fetchClientEntry = Joi.object({
    client_id: Joi.number().required().messages({
        'any.required': 'Client ID is mandatory.',
        'number.base': 'Client ID must be a number.'
    })
});

// Allowed file types for client trust entry documents
const allowedTypes = {
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    'text/csv': true,
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true
};


/**
 * Controller to handle client trust entry
 * Handles file upload metadata and saves trust document info
 * Method: POST
 * Endpoint: /user/client-trust-entry/upload
 * @param {*} req 
 * @param {*} res 
 * @param {*} files 
 * @returns JSON
 */
const clientTrustEntry = async (req, res) => {
    try {
        const { error } = clientTrustEntrySchema.validate(req.body);
        if (error) {
            return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message);
        }

        const file = req.file;
        const logged_in_user_id = req?.user?.userid;
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(logged_in_user_id);
        if (!file) return respond(res, false, HTTP_STATUS_CODE.BAD_REQUEST, "No file uploaded.");
        const safeFileName = sanitizePathSegment(file.filename);
        const filePath = `uploads/${safeFileName}`;

        const { bank_name, bank_info } = req.body;

        // To save client trust entry
        const result = await insertTrustDocuments({
            date: new Date(),
            bank_info: bank_info,
            bank_name: bank_name,
            document_path: filePath,
            userId: logged_in_user_id,
            adminId: adminId,
        });

        if (!result) {
            return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, 'Error saving client trust entry');
        }

        return respond(res, true, HTTP_STATUS_CODE.CREATED, 'Client trust entry created successfully', { file_path: filePath });
    } catch (err) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
};


/**
 *  To get recent client trust entry documents
 * METHOD: GET
 * ENDPOINT: /user/client-trust-entry
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
const clientTrustEntryRecentDocuments = async (req, res) => {
    try {
        const logged_in_user_id = req?.user?.userid;
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(logged_in_user_id);

        // fetching from db
        const clientTrustEntries = await getRecentClientTrustEntryDocuments(adminId);

        // formatting the fetched data from database
        const data = clientTrustEntries.map((entry) => {
            entry.date = new Date(entry.date).toLocaleDateString('en-CA');
            return entry;
        });

        // formatting for serial number
        const formattedData = await addSerialNoComman(data);

        // return success
        return respond(res, true, HTTP_STATUS_CODE.OK, 'Client trust entry recent documents fetched successfully', formattedData);
    } catch (err) {
        // return error
        respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, err.message);
    }
}



module.exports = {
    clientTrustEntry,
    clientTrustEntryRecentDocuments
}

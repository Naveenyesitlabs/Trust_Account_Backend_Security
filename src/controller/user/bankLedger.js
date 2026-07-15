const { getClientInfosById } = require("../../model/admin/clientLedgerModel");
const { getAdminId } = require("../../model/admin/userManagementModel");
const { allBankLedgers, getBankDaitles, getClientsBankLedger, getFirmInfoByClientId } = require("../../model/user/bankLedgerModal")
const addSerialNoComman = require("../../utils/addSerialNoComman");
const { respond, HTTP_STATUS_CODE } = require("../../utils/reponseHelper");


const getBankChargesLedgerClients = async (req, res) => {
    try {
        const userId = req?.user?.userid
        const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

        const bankLegderClients = await getClientsBankLedger(adminId);

        return respond(res, true, HTTP_STATUS_CODE.OK, "Bank Ledger data fetched successfully", bankLegderClients);
    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


const getAllBankLedgers = async (req, res) => {
    const { client_id, purpose } = req?.body
    const userId = req?.user?.userid
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);

    if (!client_id) {
        return res.status(400).json({
            status: 200,
            success: false,
            message: "Please select client"
        })
    }
    const firmInfo = await getFirmInfoByClientId(client_id)


    const bankLedgers = await allBankLedgers(client_id, purpose, userId, adminId);
    const bankLedgerWithSno = await addSerialNoComman(bankLedgers);

    return res.status(200).json({
        status: 200,
        success: true,
        message: "Bank Ledger data fetched successfully",
        data: {
            bankLedgers: bankLedgerWithSno,
            firmData: {
                firm_name: firmInfo?.firm_name,
                account_name: firmInfo?.account_name,
                client_id,
                purpose: purpose || '',
                case_open_date: null,
                case_close_date: null
            }
        },
    })

}


const addBankLedger = async (req, res) => {
    try {

    } catch (error) {
        return respond(res, false, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, error.message);
    }
}


module.exports = {
    getAllBankLedgers,
    getBankChargesLedgerClients
}
const { getAdminId } = require("../../model/admin/userManagementModel");
const { getLedgersClient, getLedgerSummary } = require("../../model/user/clientLdegerSummary");
const addSerialNoComman = require("../../utils/addSerialNoComman");


const getClientLedgerSummary = async (req, res) => {
    try {
        const role = req?.user?.role;
        let userId, adminId;
        if (role.toLowerCase() == 'admin') {
            adminId = req?.user?.userid
            userId = null;
        } else {
            userId = req?.user?.userid
            adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
        }
        const { client_name, month, year, case_status } = req?.body;

        const getAllClientsLedger = await getLedgerSummary(client_name, month, year, case_status, adminId, userId);
        if (getAllClientsLedger.length === 0) {
            return res.status(404).json({
                success: false,
                status: 404,
                message: "No ledger summary found.",
            })
        }
        const summaryWithSno = await addSerialNoComman(getAllClientsLedger);
        return res.status(200).json({
            success: true,
            status: 200,
            message: "Geting ledger summary successfully",
            data: summaryWithSno
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 500,
            message: "Something went wrong",
            error: error.message
        })
    }
}

const getAllLedgersClient = async (req, res) => {
    const userId = req?.user?.userid;
    const adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    const rows = await getLedgersClient(adminId, userId);
    try {
        if (rows) {
            res.status(200).json({
                success: true,
                status: 200,
                message: "Geting all ledgers client successfully",
                data: rows
            })
        }
        else {
            res.status(404).json({
                success: false,
                status: 404,
                message: "No ledgers client found",
            })
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 500,
            message: "Error to get all ledgers client",
        })
    }
}



module.exports = { getClientLedgerSummary, getAllLedgersClient }
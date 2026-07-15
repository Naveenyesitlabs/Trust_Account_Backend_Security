const { getAdminId } = require("../../model/admin/userManagementModel")
const { getOutstandings } = require("../../model/user/outstandingDepositeModel")
const addSerialNoComman = require("../../utils/addSerialNoComman")



const getOutstandingDisbursementAmount = async (req, res) => {
    const role = req?.user?.role
    let userId, adminId
    if (role.toLowerCase() == 'admin') {
        adminId = req?.user?.userid
        userId = null;
    } else {
        userId = req?.user?.userid
        adminId = req?.user?.role.toLowerCase() === "admin" ? req?.user?.userid : await getAdminId(userId);
    }
    try {
        const result = await getOutstandings(adminId, userId, 'disbursement');
        const addedSerialNo = await addSerialNoComman(result);
        return res.status(200).json({
            success: true,
            status: 200,
            message: 'Outstanding disbursement Amount',
            data: addedSerialNo
        })
    } catch (error) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Error getting outstanding disbursement amount',
            error: error.message
        })
    }
}


module.exports = {
    getOutstandingDisbursementAmount
}
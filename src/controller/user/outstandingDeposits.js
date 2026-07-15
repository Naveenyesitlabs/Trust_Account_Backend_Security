const { getAdminId } = require("../../model/admin/userManagementModel")
const { getOutstandings } = require("../../model/user/outstandingDepositeModel")
const addSerialNoComman = require("../../utils/addSerialNoComman")




const getOutstandingDepositsAmount = async (req, res) => {
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
        const outDepositeAmount = await getOutstandings(adminId, userId, 'deposit');
        const addedSerialNo = await addSerialNoComman(outDepositeAmount);
        return res.status(200).json({
            success: true,
            status: 200,
            message: 'Outstanding Deposits Amount',
            data: addedSerialNo
        })
    } catch (error) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Error getting outstanding deposits amount',
            error: error.message
        })
    }
}



module.exports = {
    getOutstandingDepositsAmount
}
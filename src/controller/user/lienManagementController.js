const { newLien } = require("../../model/user/lienManagementModel");


const addLien = async (req, res) => {
    try {
        const role = req?.user?.role;
        let adminId, userId
        if (role === 'admin') {
            adminId = req?.body?.userid
        }
        else if (role === 'user') {
            userId = req?.user?.userid
        }
        const { lien_holder_name, amount, date_of_issue, status, notes } = req.body;
        if (!lien_holder_name || !amount || !date_of_issue || !status) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: "Please fill in all fields"
            });
        }
        const addNewLien = await newLien({ lien_holder_name, amount, date_of_issue, status, notes, adminId, userId, role });

        return res.status(200).json({
            status: 200,
            success: true,
            message: "Lien added successfully",
            data: addNewLien
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
}


module.exports = {
    addLien
}
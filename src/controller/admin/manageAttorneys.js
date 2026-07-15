const { status } = require("init");
const { isExistsAttorneyByEmail, addNewAttorney, getAttorneys, updateAttorneyById, deleteAttorneyById } = require("../../model/admin/manageAttorneyModel");
const addSerialNoComman = require("../../utils/addSerialNoComman");


const addAttorneyController = async (req, res) => {
    const { attorney_name, email, phone } = req?.body;
    // console.log(req.body)
    if (!attorney_name || !email || !phone) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: "Please provide all the required fields"
        })
    }
    try {
        const isExists = await isExistsAttorneyByEmail(email)
        if (isExists) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: "Attorney already exists"
            })
        }
        const newAttorney = await addNewAttorney({ attorney_name, email, phone })
        if (newAttorney) {
            return res.status(201).json({
                status: 201,
                success: true,
                message: "Attorney added successfully",
                data: newAttorney
            })
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while adding attorney"
        })
    }
}

const getAllAttorneyController = async (req, res) => {
    try {
        const getAllAttorneys = await getAttorneys()
        if (getAllAttorneys.length > 0) {
            const addSerialNo = await addSerialNoComman(getAllAttorneys)
            return res.status(200).json({
                status: 200,
                success: true,
                message: "Attorney getting successfully",
                data: addSerialNo
            })
        } else {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "No attorney found"
            })
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while getting attorney"
        })
    }
}

const updateAttorneyController = async (req, res) => {
    const { id } = req?.params;
    const { attorney_name, email, phone } = req?.body;
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: "Please provide attorney id"
        })
    }

    try {
        const updatedAttorney = await updateAttorneyById({ id, attorney_name, email, phone })
        if (updatedAttorney.UpdatedId) {
            return res.status(200).json({
                status: 200,
                success: true,
                message: "Attorney updated successfully",
                data: updatedAttorney
            })
        } else {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "Attorney not found"
            })
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while updating attorney"
        })
    }

}

const deleteAttorneyController = async (req, res) => {
    const { id } = req?.params;
    if (!id) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: "Please provide attorney id"
        })
    }
    try {
        const deletedAttorney = await deleteAttorneyById(id)
        if (deletedAttorney.DeletedId) {
            return res.status(200).json({
                status: 200,
                success: true,
                message: "Attorney deleted successfully",
            })
        } else {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "Attorney not found"
            })
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: error.message || "An error occurred while deleting attorney"
        })
    }
}

module.exports = {
    addAttorneyController,
    getAllAttorneyController,
    updateAttorneyController,
    deleteAttorneyController
}
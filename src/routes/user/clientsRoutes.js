const express = require("express");
const router = express.Router();

const { getAllClients, getLedgers, addClient, updateClient, getAllClientsUser } = require("../../controller/user/clientController");

// router.get('/all', getAllClients);
router.get('/all', getAllClientsUser);
router.get('/ledgers', getLedgers);
router.post("/create", addClient);
router.put('/update/:id', updateClient);



module.exports = router;
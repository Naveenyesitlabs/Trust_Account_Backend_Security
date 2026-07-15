const express = require("express");
const router = express.Router();

const clientTrustEntryRoutes = require("./clientTrustEntryRoutes");
// const clientsRoutes = require("./clientsRoutes");
const matterRoutes = require("./matterRoutes");
const journalRoutes = require("./journalRoutes");

// // Mount under /client-trust-entry 
// router.use("/client-trust-entry", clientTrustEntryRoutes);
// // Mount under /client
// router.use("/client", clientsRoutes);
// // Mount under /matter
// router.use("/matter", matterRoutes);
// // Mount under /journal
// router.use("/journal", journalRoutes);


module.exports = router;

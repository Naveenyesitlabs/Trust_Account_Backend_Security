const express = require("express");
const { addNewJournalEntry, getJournalList } = require("../../controller/user/journalController");
const { getAllJurnalEntryController, getJurnalEntryController, addJurnalEntryController, updateJurnalEntryController } = require("../../controller/admin/JournalEntryController");
const router = express.Router();



module.exports = router;
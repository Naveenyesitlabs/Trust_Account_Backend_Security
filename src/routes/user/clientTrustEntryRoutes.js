// const express = require("express");
// const { clientTrustEntry, clientTrustEntryRecentDocuments, testOCR } = require("../../controller/user/clientTrustEntryController");
// const multer = require("multer");
// const router = express.Router();

// // Use multer memory storage so we can move files manually in controller
// const upload = multer({ storage: multer.memoryStorage() });

// // POST route for uploading client trust entry documents
// router.post("/documents/create", upload.single('document'), clientTrustEntry);
// router.get("/documents", clientTrustEntryRecentDocuments);
// // router.post('/testocr', upload.single('document'), testOCR);

// module.exports = router;

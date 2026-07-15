const multer = require("multer");
const path = require("path");

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/x-png", // fallback for older browsers
  "application/vnd.intu.qbo",
  "application/ofx",
];


// Fallback check based on file extension
const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".jpeg", ".jpg", ".png", ".qbo", ".ofx"];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "src/uploads");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase(); // Get original file extension
    const fileName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, fileName); // Set filename with extension
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedMimeTypes.includes(mime) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

module.exports = upload;

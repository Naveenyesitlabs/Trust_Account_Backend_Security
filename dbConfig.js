const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a MySQL connection pool with promise support
const dbConn = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the database connection with promise-based API
dbConn.getConnection()
    .then(() => {
        console.log("Database connected successfully!");
    })
    .catch((err) => {
        console.error("Error connecting to the database:", err);
        process.exit(1);
    });

module.exports = dbConn;
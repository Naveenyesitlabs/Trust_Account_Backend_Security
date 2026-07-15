// utils/logger.js
const fs = require('fs');
const path = require('path');

const logToFile = (message) => {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toISOString().split('T')[1].replace('Z', '');
  const logDir = path.join(__dirname, '..', 'logs');
  const logFile = path.join(logDir, `${date}.txt`);

  const logMessage = `[${date} ${time}] ${message}\n`;

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true, mode: 0o777 });
    }

    fs.appendFileSync(logFile, logMessage, { mode: 0o777 });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
};

module.exports = { logToFile };

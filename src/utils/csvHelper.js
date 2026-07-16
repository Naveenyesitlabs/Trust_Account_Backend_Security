const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify');
const puppeteer = require('puppeteer');
const { escapeHtml, resolvePathWithin, sanitizePathSegment } = require('./pathSafety');


async function generateCSV(adminId, reports, month, year, type, headers) {
  try {
    // Validate input parameters
    if (!adminId || !reports || !month || !year || !type || !headers) {
      throw new Error('Missing required parameters');
    }

    // Create folder structure if it doesn't exist
    const safeType = sanitizePathSegment(type, 'report');
    // nosemgrep: report type is normalized before building a directory path.
    const baseDir = resolvePathWithin(path.join(__dirname, '../downloads'), safeType);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Define the file path
    const filename = sanitizePathSegment(`${month}_${year}_${adminId}.csv`, 'report.csv');
    // nosemgrep: generated filename is normalized and constrained to the report directory.
    const filePath = resolvePathWithin(baseDir, filename);

    // Public-facing URL for download
    const relativeUrlPath = path.posix.join('downloads', safeType, filename); // ensures forward slashes
    // const fileUrl = `${baseUrl}/${relativeUrlPath}`;

    // Map headers to CSV format (convert snake_case to Title Case)
    const csvHeaders = headers.map(header => {
      // Convert snake_case to space separated
      let formatted = header.replace(/_/g, ' ');
      // Convert to title case
      formatted = formatted.replace(/\w\S*/g, txt => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
      return formatted;
    });

    // Prepare the data for CSV
    const data = reports.map(report => {
      return headers.map(header => {
        // Handle special case for serial_no if needed
        if (header === 'serial_no') {
          return report[header] !== undefined ? report[header] : '';
        }

        if (header === 'date') {
          return report[header] ? new Date(report[header]).toLocaleDateString('en-CA') : '';
        }

        if (['reconciled_to_ledger', 'reconciled_to_bank_statement', 'reconciled'].includes(header)) {
          return report[header] === 1 ? 'Yes' : 'No';
        }

        if (header === 'lien_count') {
          return report[header] > 0 ? 'Yes' : 'No';
        }

        return report[header] !== undefined ? report[header] : '';
      });
    });

    // Create CSV stringifier
    const stringifier = stringify({
      header: true,
      columns: csvHeaders
    });

    // Create write stream
    const writableStream = fs.createWriteStream(filePath);

    // Pipe the data to the file
    stringifier.pipe(writableStream);

    // Write the data
    data.forEach(row => stringifier.write(row));
    stringifier.end();

    return new Promise((resolve, reject) => {
      writableStream.on('finish', () => {
        resolve(relativeUrlPath); // Just return the path string directly
      });

      writableStream.on('error', (error) => {
        reject(new Error(`Error writing CSV file: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Error generating CSV:', error);
    throw error;
  }
}


const formatHeader = (str) => {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')              // replace underscores with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase words
    .replace(/\s+/g, ' ')            // clean extra spaces
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
};


const buildReportHtml = (reports, headers, reportName) => {
  const rowsPerPage = 12;

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const toSentenceCase = str => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  const formatDateMMDDYYYY = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const chunkedData = chunkArray(reports, rowsPerPage);

  return chunkedData.map((chunk, pageIndex) => `
    <div style="
      width: 100%;
      height: 90%;
      box-sizing: border-box;
      page-break-after: always;
      padding: 10px;
      background-color: #fff;
      position: relative;
      font-family: Arial, sans-serif;
    ">
      <div style="
        position: absolute;
        top: 10px;
        right: 20px;
        font-size: 12px;
        color: #444;
      ">
        Page ${pageIndex + 1}
      </div>

      <h2 style="text-align: center; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">
        ${reportName}
      </h2>

      <table style="
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        word-wrap: break-word;
        font-size: 10px;
      ">
        <thead>
          <tr>
            ${headers.map(key => `
              <th style="
                padding: 6px;
                border: 1px solid #aaa;
                background-color: #030F23;
                color: #fff;
                font-weight: 800;
                max-width: 150px;
                overflow-wrap: break-word;
              ">
                ${escapeHtml(formatHeader(key))}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${chunk.map(row => `
            <tr>
             ${headers.map(key => {
    let cellText = row[key] ?? '';

    // ✅ Format date fields to MM/DD/YYYY
    if (key.toLowerCase().includes('date') && cellText) {
      cellText = formatDateMMDDYYYY(cellText);
    }

    // ✅ Handle reconcile fields
    if (key.toLowerCase().includes('reconcile')) {
      cellText = (Number(cellText) === 0 ? 'False' : 'True');
    }

    const len = String(cellText).length;
    let fontSize = '9px';
    if (len > 100) fontSize = '7px';
    else if (len > 60) fontSize = '8px';

    return `<td style="
              border: 1px solid #aaa;
              padding: 6px;
              color: #070707;
              font-weight: 400;
              overflow-wrap: break-word;
              word-break: break-word;
              font-size: ${fontSize};
            ">${escapeHtml(cellText)}</td>`;
  }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
};


async function generatePDF(adminId, reports, month, year, type, headers) {
  try {
    if (!adminId || !reports || !month || !year || !type || !headers) {
      throw new Error('Missing required parameters');
    }

    // Create folder structure if it doesn't exist
    const safeType = sanitizePathSegment(type, 'report');
    // nosemgrep: report type is normalized before building a directory path.
    const baseDir = resolvePathWithin(path.join(__dirname, '../downloads'), safeType);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const filename = sanitizePathSegment(`${month}_${year}_${adminId}.pdf`, 'report.pdf');
    // nosemgrep: generated filename is normalized and constrained to the report directory.
    const filePath = resolvePathWithin(baseDir, filename);
    const relativeUrlPath = path.posix.join('downloads', safeType, filename);

    // Generate HTML using buildReportHtml
    const htmlContent = buildReportHtml(reports, headers, safeType.toUpperCase());

    const html = `
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(safeType.toUpperCase().replace('_', ' '))} Report</title>
        <style>
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10px; }
          h2 { font-size: 18px; margin: 0 0 10px 0; }
          table { border-collapse: collapse; width: 100%; table-layout: fixed; word-wrap: break-word; }
          th, td { border: 1px solid #aaa; padding: 6px; word-break: break-word; }
          th { background-color: #030F23; color: #fff; font-weight: 800; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      // nosemgrep: javascript.puppeteer.security.audit.puppeteer-setcontent-injection.puppeteer-setcontent-injection
      // HTML content is generated from escaped report values before rendering.
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      });
    } finally {
      await browser.close();
    }

    return relativeUrlPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}



module.exports = {
  generateCSV,
  generatePDF,
};

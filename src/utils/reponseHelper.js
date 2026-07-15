/**
 * To response in proper format for all api calls
 * it will return success, error, data, metadata in format like below
 * 
 *   {
 *     success: true,
 *     message: '',
 *     data: [],
 *     metadata: []
 *   }
 * 
 * @param {object} res - response object
 * @param {boolean} success - success flag
 * @param {number} statusCode - status code
 * @param {string} message - message
 * @param {array} data - data
 * @param {array} metadata - metadata
 * 
 * @returns {object} response
 */
const respond = (res, success = true, statusCode = 200, message = '', data = [], metadata = []) => {
    // create response
    const response = {
        success: success,
        message: message,
    };

    // set error and data
    if (!success) {
        response.error = statusCode; // error code
    } else {
        response.data = data; // data
    }

    // set metadata
    if (metadata && metadata.length > 0) {
        response.metadata = metadata;
    }

    // send response
    return res.status(statusCode).json(response);
}

/**
 * To create pagination details
 * @param {*} totalRecords 
 * @param {*} currentPage 
 * @param {*} itemsPerPage 
 * @param {*} pageRange 
 * @returns 
 */
const getPagination = (totalRecords, currentPage = 1, itemsPerPage = 10, pageRange = 5) => {
    try {
        const total = parseInt(totalRecords);
        const perPage = parseInt(itemsPerPage);
        const current = Math.max(1, parseInt(currentPage));
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const offset = (current - 1) * perPage;

        // Calculate start & end item numbers
        const startItem = total === 0 ? 0 : offset + 1;
        const endItem = Math.min(offset + perPage, total);

        // Calculate visible page numbers (e.g., [3, 4, 5, 6, 7])
        let startPage = Math.max(1, current - Math.floor(pageRange / 2));
        let endPage = startPage + pageRange - 1;

        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - pageRange + 1);
        }

        const pages = [];
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return {
            current_page: current,
            items_per_page: perPage,
            total_records: total,
            total_number_of_pages: totalPages,
            offset, // for DB queries
            has_previous: current > 1,
            has_next: current < totalPages,
            previous_page: current > 1 ? current - 1 : null,
            next_page: current < totalPages ? current + 1 : null,
            start_item: startItem,
            end_item: endItem,
            pages // array of visible page numbers for pagination controls
        };
    } catch (e) {
        throw new Error(e);
    }
}

/**
 * Flexible date formatter with preset formats, including dd-mm-yyyy
 * @param {Date | string | number} date - The date to format.
 * @param {string} [format='long'] - Format key.
 * @param {string} [locale='en-US'] - Locale string.
 * @returns {string} Formatted date.
 */
const formatDate = (date, format = 'long', locale = 'en-US') => {
    const validDate = new Date(date);
    if (isNaN(validDate)) return 'Invalid Date';

    if (format === 'dd-mm-yyyy') {
        const day = String(validDate.getDate()).padStart(2, '0');
        const month = String(validDate.getMonth() + 1).padStart(2, '0');
        const year = validDate.getFullYear();
        return `${day}-${month}-${year}`;
    }

    const formats = {
        short: { year: '2-digit', month: 'numeric', day: 'numeric' },
        medium: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric' },
        full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        numeric: { year: 'numeric', month: 'numeric', day: 'numeric' },
        'month-day': { month: 'long', day: 'numeric' },
        'day-month': { day: 'numeric', month: 'long' },
        'year-month-day': { year: 'numeric', month: '2-digit', day: '2-digit' },
        time: { hour: '2-digit', minute: '2-digit' },
        datetime: {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        },
    };

    return validDate.toLocaleString(locale, formats[format] || formats.long);
};

const normalizeDate = (rawDate) => {
    if (!rawDate) return null;

    // Remove ordinal suffixes (st, nd, rd, th)
    rawDate = rawDate.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();

    const formats = [
        { regex: /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/, order: ['year', 'month', 'day'] }, // mm/dd/yyyy or mm-dd-yyyy
        { regex: /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/, order: ['year', 'day', 'month'] }, // dd/mm/yyyy or dd-mm-yyyy
        { regex: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/, order: ['day', 'monthName', 'year'] }, // 12 February 2023
        { regex: /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/, order: ['monthName', 'day', 'year'] }  // February 12, 2023
    ];

    for (const { regex, order } of formats) {
        const match = rawDate.match(regex);
        if (!match) continue;

        let [, a, b, c] = match;
        let year, month, day;

        if (order.includes('monthName')) {
            const monthNames = {
                january: '01', february: '02', march: '03', april: '04',
                may: '05', june: '06', july: '07', august: '08',
                september: '09', october: '10', november: '11', december: '12'
            };
            const monthStr = (order[1] === 'monthName' ? b : a).toLowerCase();
            month = monthNames[monthStr];
            day = order[0] === 'day' ? a.padStart(2, '0') : b.padStart(2, '0');
            year = c;
        } else {
            if (order[0] === 'month') {
                [month, day, year] = [a, b, c];
            } else {
                [day, month, year] = [a, b, c];
            }
        }

        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // If no format matched, return null
    return null;
};


/**
 * To get HTTP status codes
 */
const HTTP_STATUS_CODE = {
    // 1xx: Informational - Request received, continuing process
    CONTINUE: 100,                         // Client should continue with request
    SWITCHING_PROTOCOLS: 101,             // Server is switching protocols
    PROCESSING: 102,                      // WebDAV: Processing request

    // 2xx: Success - The action was successfully received, understood, and accepted
    OK: 200,                              // Request succeeded
    CREATED: 201,                         // Resource created successfully
    ACCEPTED: 202,                        // Request accepted but not yet processed
    NON_AUTHORITATIVE_INFORMATION: 203,  // Returned meta-information is not from the origin server
    NO_CONTENT: 204,                      // No content to return
    RESET_CONTENT: 205,                   // Request successful; reset document view
    PARTIAL_CONTENT: 206,                 // Partial content for range requests

    // 3xx: Redirection - Further action must be taken to complete the request
    MULTIPLE_CHOICES: 300,                // Multiple options for the resource
    MOVED_PERMANENTLY: 301,               // Resource has moved permanently
    FOUND: 302,                           // Resource temporarily located elsewhere
    SEE_OTHER: 303,                       // See another URI
    NOT_MODIFIED: 304,                    // Resource has not been modified
    TEMPORARY_REDIRECT: 307,             // Temporary redirect (method preserved)
    PERMANENT_REDIRECT: 308,             // Permanent redirect (method preserved)

    // 4xx: Client Error - The request contains bad syntax or cannot be fulfilled
    BAD_REQUEST: 400,                     // Malformed request syntax
    UNAUTHORIZED: 401,                    // Authentication required
    PAYMENT_REQUIRED: 402,               // Reserved for future use
    FORBIDDEN: 403,                       // Server refuses to fulfill request
    NOT_FOUND: 404,                       // Resource not found
    METHOD_NOT_ALLOWED: 405,             // HTTP method not allowed
    NOT_ACCEPTABLE: 406,                 // Requested format not acceptable
    REQUEST_TIMEOUT: 408,                // Request timed out
    CONFLICT: 409,                        // Conflict in request
    GONE: 410,                            // Resource no longer available
    LENGTH_REQUIRED: 411,                // Content-Length header is missing
    PAYLOAD_TOO_LARGE: 413,              // Payload too large
    URI_TOO_LONG: 414,                   // URI too long
    UNSUPPORTED_MEDIA_TYPE: 415,         // Unsupported media type
    TOO_MANY_REQUESTS: 429,              // Too many requests in a given time

    // 5xx: Server Error - Server failed to fulfill a valid request
    INTERNAL_SERVER_ERROR: 500,          // Generic server error
    NOT_IMPLEMENTED: 501,                // Server does not support functionality
    BAD_GATEWAY: 502,                    // Invalid response from upstream server
    SERVICE_UNAVAILABLE: 503,            // Server unavailable (overloaded or down)
    GATEWAY_TIMEOUT: 504,                // Gateway timed out
    HTTP_VERSION_NOT_SUPPORTED: 505      // HTTP version not supported
};

const getMonthNumber = (transaction_date) => {
    const date = new Date(transaction_date);  // Convert string to Date object
    return date.getMonth() + 1;  // getMonth() returns a 0-based month, so add 1
};


function calculateInterestRates(bankStatement) {
    // Extract relevant data
    const { interestPaid, dailyBalances, ownerData } = bankStatement;
    const { from, to } = ownerData.statementPeriod;

    // Calculate the number of days in the statement period
    const startDate = new Date(from);
    const endDate = new Date(to);
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1; // Inclusive of both dates

    // Calculate Average Daily Balance (ADB)
    let totalBalance = 0;
    let prevBalance = bankStatement.beginningBalance;
    let prevDate = startDate;

    // Sort daily balances by date (ascending)
    const sortedBalances = [...dailyBalances].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Add beginning balance if missing
    if (sortedBalances.length === 0 || new Date(sortedBalances[0].date) > startDate) {
        sortedBalances.unshift({ date: from, amount: prevBalance });
    }

    // Calculate weighted sum of balances
    for (const balance of sortedBalances) {
        const currentDate = new Date(balance.date);
        const daysBetween = Math.ceil((currentDate - prevDate) / (1000 * 60 * 60 * 24));

        if (daysBetween > 0) {
            totalBalance += prevBalance * daysBetween;
            prevBalance = balance.amount;
            prevDate = currentDate;
        }
    }

    // Add remaining days (last balance to endDate)
    const remainingDays = Math.ceil((endDate - prevDate) / (1000 * 60 * 60 * 24));
    if (remainingDays > 0) {
        totalBalance += prevBalance * remainingDays;
    }

    const averageDailyBalance = totalBalance / daysInPeriod;

    // Calculate Monthly Interest Rate
    const monthlyInterestRate = (interestPaid / averageDailyBalance) * 100;

    // Calculate Annual Interest Rate
    const annualInterestRate = (interestPaid * 365) / (averageDailyBalance * daysInPeriod) * 100;

    return {
        interestPaid,
        daysInPeriod,
        averageDailyBalance,
        monthlyInterestRate: monthlyInterestRate,  // Monthly rate (%)
        annualInterestRate: annualInterestRate,    // Annual rate (%)
    };
}



// Helper function to extract a section between header and next section
const extractSection = (text, sectionHeader, nextSectionHeaders) => {
    const headerIndex = text.indexOf(sectionHeader);
    if (headerIndex === -1) return null;

    let endIndex = -1;
    for (const nextHeader of nextSectionHeaders) {
        const nextIndex = text.indexOf(nextHeader, headerIndex);
        if (nextIndex !== -1 && (endIndex === -1 || nextIndex < endIndex)) {
            endIndex = nextIndex;
        }
    }

    return text.slice(
        headerIndex,
        endIndex !== -1 ? endIndex : text.length
    );
};

const countMonths = (startDate, endDate) => {
    const months = new Set();
    const d = new Date(startDate);

    while (d <= endDate) {
        months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
        d.setMonth(d.getMonth() + 1);
    }

    return months.size;
};

const cleanDescription = (desc) => {
    if (!desc) return '';

    // Remove amount if it appears at start
    desc = desc.replace(/^\s*[\d,]+\.\d{2}\s*/g, '').trim();
    // Remove dates
    desc = desc.replace(/\d{2}\/\d{2}/g, '').trim();
    // Remove "Total" lines
    desc = desc.replace(/^\s*Total\s+.*/i, '').trim();
    // Normalize spaces
    desc = desc.replace(/\s{2,}/g, ' ').trim();

    return desc;
};

// const all_bank_charges_regex = /(?:^|\W)(?:interest(?:\s*payment)?|check\s*charge|bank\s*charges?|service\s*charge|maintenance\s*fee|monthly\s*(?:fee|payment)|account\s*fee|dividend|earnings|yield|trust\s*fee|iolta\s*(?:fee|payment)|wire\s*fee|nsf\s*fee|overdraft\s*fee|transaction\s*fee|atm\s*fee|stop\s*payment\s*fee|returned\s*item\s*fee|deposit\s*fee|statement\s*fee)(?=$|\W)/i;

const all_bank_charges_regex = /\b(?:interest(?:\s*(?:payment|transfer))|trust\s*interest\s*transfer|check\s*charge|bank\s*(?:charges?|fees)|service\s*charge|maintenance\s*fee|monthly\s*(?:fee|payment)|account\s*fee|dividend|earnings|yield|trust\s*fee|iolta\s*(?:fee|payment)|wire\s*fee|nsf\s*fee|overdraft\s*fee|transaction\s*fee|atm\s*fee|stop\s*payment\s*fee|returned\s*item\s*fee|deposit\s*fee|statement\s*fee|check\s*fee)\b/i;

function extractTransactionIds(description) {
    // Patterns to extract potential transaction IDs
    // const patterns = [
    //     // Alphanumeric (8-20 chars, may include hyphens/dashes)
    //     /(?:[^a-zA-Z0-9]|^)([A-Z0-9-]{8,20})(?=[^a-zA-Z0-9]|$)/i,

    //     // Numeric only (8+ digits)
    //     /(?:[^0-9]|^)(\d{8,})(?=[^0-9]|$)/,

    //     // Special cases (e.g., "ST-H5O4J1D8E4P7")
    //     /(?:st[-_\s]*)([a-z0-9]{8,20})/i,

    //     // CCD/ACH reference formats
    //     /(?:ccd|ach)[-\s]*(?:id|ref)[:\s-]*([a-z0-9-]{8,20})/i
    // ];
    const patterns = [
        // Only match 'Check <number>' exactly
        /\bCheck\s+(\d{1,20})\b/i,

        // Alphanumeric (8-20 chars, may include hyphens/dashes)
        /(?:[^a-zA-Z0-9]|^)([A-Z0-9-]{8,20})(?=[^a-zA-Z0-9]|$)/i,

        // Numeric only (8+ digits)
        /(?:[^0-9]|^)(\d{8,})(?=[^0-9]|$)/,

        // Special cases (e.g., "ST-H5O4J1D8E4P7")
        /(?:st[-_\s]*)([a-z0-9]{8,20})/i,

        // CCD/ACH reference formats
        /(?:ccd|ach)[-\s]*(?:id|ref)[:\s-]*([a-z0-9-]{8,20})/i
    ];



    const matches = [];

    patterns.forEach(pattern => {
        const found = description.match(pattern);
        if (found && found[1]) {
            const match = found[1].toUpperCase();

            // Check if the match is either:
            // 1. Numeric only (e.g., "12345678"), OR
            // 2. Alphanumeric (may include hyphens, e.g., "ABC-123-XYZ")
            const isNumeric = /^\d+$/.test(match);
            const isAlphanumeric = /^[A-Z0-9-]+$/.test(match);

            if (isNumeric || isAlphanumeric) {
                matches.push(match);
            }
        }
    });

    // Return unique matches
    return [...new Set(matches)];
}


/**
 * Returns the current date and time in California (America/Los_Angeles) timezone,
 * formatted as "YYYY-MM-DD HH:MM:SS".
 * @returns {string}
 */
function getCaliforniaDateTime() {
    const now = new Date();

    // Convert to California time using Intl.DateTimeFormat
    const options = {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(now);

    const get = (type) => parts.find(p => p.type === type)?.value;

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}



module.exports = {
    respond,
    HTTP_STATUS_CODE,
    getPagination,
    formatDate,
    normalizeDate,
    getMonthNumber,
    calculateInterestRates,
    countMonths,
    cleanDescription,
    extractSection,
    all_bank_charges_regex,
    extractTransactionIds,
    getCaliforniaDateTime
};

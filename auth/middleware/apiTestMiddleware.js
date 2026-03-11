const pool = require('../../db');
const xss = require('xss');

// Helper function to safely stringify and truncate data
const safeStringify = (data, maxLength = 4000) => {
    try {
        const str = JSON.stringify(data);
        return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
    } catch {
        return '';
    }
};

// Helper function to mask sensitive fields
const maskSensitiveFields = (body) => {
    const maskedBody = { ...body };
    if (maskedBody.password) maskedBody.password = '*****';
    return maskedBody;
};

// Middleware to log API requests and responses to dev_apitest
const apiTestLogger = async (req, res, next) => {
    const startTime = new Date();
    const api = `${req.method} ${req.originalUrl}`;
    const header = safeStringify(req.headers);
    const body = safeStringify(maskSensitiveFields(req.body));

    // Store requestno for response logging
    let requestno;

    try {
        // Insert request into dev_apitest
        const insertQuery = `
            INSERT INTO dev_apitest (api, header, body, calledat)
            VALUES ($1, $2, $3, $4)
            RETURNING requestno
        `;
        const result = await pool.query(insertQuery, [api, header, body, startTime]);
        requestno = result.rows[0].requestno;
    } catch (err) {
        console.error('Error logging request to dev_apitest:', err);
        // Continue even if logging fails
    }

    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function (data) {
        const response = safeStringify(data);
        const status = res.statusCode;
        const responsedat = new Date();

        // Update dev_apitest with response and status
        if (requestno) {
            const updateQuery = `
                UPDATE dev_apitest
                SET response = $1, status = $2, responsedat = $3
                WHERE requestno = $4
            `;
            pool.query(updateQuery, [response, status, responsedat, requestno]).catch(err => {
                console.error('Error updating dev_apitest with response:', err);
            });
        }

        return originalJson.call(this, data);
    };

    const originalRender = res.render;
    res.render = function (view, options, callback) {
        const response = safeStringify({ view, options });
        const status = res.statusCode || 200;
        const responsedat = new Date();

        if (requestno) {
            const updateQuery = `
                UPDATE dev_apitest
                SET response = $1, status = $2, responsedat = $3
                WHERE requestno = $4
            `;
            pool.query(updateQuery, [response, status, responsedat, requestno]).catch(err => {
                console.error('Error updating dev_apitest with render response:', err);
            });
        }

        return originalRender.call(this, view, options, callback);
    };

    next();
};

module.exports = apiTestLogger;

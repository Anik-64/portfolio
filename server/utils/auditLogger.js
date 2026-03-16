const pool = require('../../db');

/**
 * Logs an administrative action to the audit_log table.
 * 
 * @param {string} admin_uid - The unique identifier of the admin performing the action.
 * @param {string} action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param {string} table_name - The name of the table affected by the action.
 * @param {string|number} record_id - The ID of the primary record affected.
 * @param {Object} metadata - Additional information about the action (e.g., changed fields).
 */
const logAudit = async (admin_uid, action, table_name, record_id, metadata = {}) => {
    const query = `
        INSERT INTO audit_log (admin_uid, action, table_name, record_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
    `;
    try {
        await pool.query(query, [String(admin_uid), action, table_name, String(record_id), JSON.stringify(metadata)]);
    } catch (err) {
        console.error('Failed to log audit:', err);
        // We don't throw the error here to avoid breaking the main request flow
        // but we log it to the console for monitoring.
    }
};

module.exports = { logAudit };

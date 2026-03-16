const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 
const { logAudit } = require('../utils/auditLogger');

const contactMessagesRouter = express.Router();

commonMiddlewares(contactMessagesRouter);
contactMessagesRouter.use(createRateLimiter());

contactMessagesRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM contact_messages ORDER BY created_at DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

contactMessagesRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM contact_messages WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

contactMessagesRouter.post('/',
    [
        body('sender_name').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('sender_email').notEmpty().isEmail().normalizeEmail(),
        body('subject').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 500 }),
        body('message').notEmpty().isString().trim(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { sender_name, sender_email, subject, message } = req.body;
        
        const query = `
            INSERT INTO contact_messages (sender_name, sender_email, subject, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [sender_name, sender_email, subject, xss(message)]);
            res.status(201).json({ error: false, message: 'Message sent successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

contactMessagesRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('is_read').notEmpty().isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { is_read } = req.body;
        
        const query = `
            UPDATE contact_messages 
            SET is_read=$2
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, is_read]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Message not found!' });
            
            await logAudit(req.user.userno, 'UPDATE', 'contact_messages', req.params.id, { sender_name: result.rows[0].sender_name, is_read });
            
            res.status(200).json({ error: false, message: 'Message updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

contactMessagesRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM contact_messages WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Message not found!' });
            
            await logAudit(req.user.userno, 'DELETE', 'contact_messages', req.params.id, { sender_name: result.rows[0].sender_name, subject: result.rows[0].subject });
            
            res.status(200).json({ error: false, message: 'Message deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = contactMessagesRouter;

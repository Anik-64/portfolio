const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 
const { logAudit } = require('../utils/auditLogger');

const experiencesRouter = express.Router();

commonMiddlewares(experiencesRouter);
experiencesRouter.use(createRateLimiter());

experiencesRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM experiences ORDER BY display_order ASC, start_date DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

experiencesRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM experiences WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

experiencesRouter.post('/',
    [
        body('company').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('role').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('employment_type').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 50 }),
        body('start_date').notEmpty().isISO8601(),
        body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('description').optional({ nullable: true, checkFalsy: true }).isString().trim(), // Allow some HTML for descripton or strip it
        body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('company_logo_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { company, role, employment_type, start_date, end_date, description, location, company_logo_url, display_order, is_visible } = req.body;
        
        const query = `
            INSERT INTO experiences (company, role, employment_type, start_date, end_date, description, location, company_logo_url, display_order, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [company, role, employment_type, start_date, end_date, description?xss(description):null, location, company_logo_url, display_order, is_visible]);
            const newRecord = result.rows[0];
            
            await logAudit(req.user.userno, 'CREATE', 'experiences', newRecord.id, { company, role });
            
            res.status(201).json({ error: false, message: 'Experience created successfully', data: newRecord });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

experiencesRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('company').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('role').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('employment_type').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 50 }),
        body('start_date').notEmpty().isISO8601(),
        body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('description').optional({ nullable: true, checkFalsy: true }).isString().trim(),
        body('location').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('company_logo_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { company, role, employment_type, start_date, end_date, description, location, company_logo_url, display_order, is_visible } = req.body;
        
        const query = `
            UPDATE experiences 
            SET company = $2, role = $3, employment_type = $4, start_date = $5, end_date = $6, description = $7, location = $8, company_logo_url = $9, display_order = COALESCE($10, display_order), is_visible = COALESCE($11, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, company, role, employment_type, start_date, end_date, description?xss(description):null, location, company_logo_url, display_order, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Experience not found!' });
            
            await logAudit(req.user.userno, 'UPDATE', 'experiences', req.params.id, { company, role });
            
            res.status(200).json({ error: false, message: 'Experience updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

experiencesRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM experiences WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Experience not found!' });
            
            await logAudit(req.user.userno, 'DELETE', 'experiences', req.params.id, { company: result.rows[0].company, role: result.rows[0].role });
            
            res.status(200).json({ error: false, message: 'Experience deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = experiencesRouter;

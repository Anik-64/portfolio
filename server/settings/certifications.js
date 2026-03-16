const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 
const { logAudit } = require('../utils/auditLogger');

const certificationsRouter = express.Router();

commonMiddlewares(certificationsRouter);
certificationsRouter.use(createRateLimiter());

certificationsRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM certifications ORDER BY display_order ASC, issued_date DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ 
            error: false, 
            data: result.rows 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            error: true, 
            message: 'Internal Server Error' 
        });
    }
});

certificationsRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM certifications WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({  
                error: false, 
                data: result.rows[0] 
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                error: true, 
                message: 'Internal Server Error' 
            });
        }
    }
);

certificationsRouter.post('/',
    [
        body('title').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('issuer').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('issued_date').optional({ nullable: true, checkFalsy: true }).isString().trim().escape(),
        body('expiry_date').optional({ nullable: true, checkFalsy: true }).isString().trim().escape(),
        body('credential_id').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('credential_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('pdf_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('badge_image_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('status').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 50 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, issuer, issued_date, expiry_date, credential_id, credential_url, pdf_url, badge_image_url, status, display_order, is_visible } = req.body;
        
        const query = `
            INSERT INTO certifications (title, issuer, issued_date, expiry_date, credential_id, credential_url, pdf_url, badge_image_url, status, display_order, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'active'), COALESCE($10, 0), COALESCE($11, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [title, issuer, issued_date, expiry_date, credential_id, credential_url, pdf_url, badge_image_url, status, display_order, is_visible]);
            const newRecord = result.rows[0];
            
            await logAudit(req.user.userno, 'CREATE', 'certifications', newRecord.id, { title, issuer });
            
            res.status(201).json({ 
                error: false, 
                message: 'Certification created successfully', 
                data: newRecord 
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                error: true, 
                message: 'Internal Server Error' 
            });
        }
    }
);

certificationsRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('title').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('issuer').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('issued_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('expiry_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('credential_id').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('credential_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('pdf_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('badge_image_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('status').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 50 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, issuer, issued_date, expiry_date, credential_id, credential_url, pdf_url, badge_image_url, status, display_order, is_visible } = req.body;
        
        const query = `
            UPDATE certifications 
            SET title=$2, issuer=$3, issued_date=$4, expiry_date=$5, credential_id=$6, credential_url=$7, pdf_url=$8, badge_image_url=$9, status=COALESCE($10, status), display_order=COALESCE($11, display_order), is_visible=COALESCE($12, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, title, issuer, issued_date, expiry_date, credential_id, credential_url, pdf_url, badge_image_url, status, display_order, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Certification not found!' });
            
            await logAudit(req.user.userno, 'UPDATE', 'certifications', req.params.id, { title, issuer });
            
            res.status(200).json({ 
                error: false, 
                message: 'Certification updated successfully', 
                data: result.rows[0] 
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                error: true, 
                message: 'Internal Server Error' 
            });
        }
    }
);

certificationsRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM certifications WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Certification not found!' });
            
            await logAudit(req.user.userno, 'DELETE', 'certifications', req.params.id, { title: result.rows[0].title, issuer: result.rows[0].issuer });
            
            res.status(200).json({ 
                error: false, 
                message: 'Certification deleted successfully', 
                data: result.rows[0] 
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ 
                error: true, 
                message: 'Internal Server Error' 
            });
        }
    }
);

module.exports = certificationsRouter;

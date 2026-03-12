const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const { validationResult, param } = require('express-validator');
const pool = require('../../db'); 

const auditLogRouter = express.Router();

commonMiddlewares(auditLogRouter);
auditLogRouter.use(createRateLimiter());

// ONLY GET ENDPOINTS FOR AUDIT LOG AS PER USER REQUIREMENT

auditLogRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM audit_log ORDER BY created_at DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

auditLogRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM audit_log WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

module.exports = auditLogRouter;

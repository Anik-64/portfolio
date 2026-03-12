const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const trainingsRouter = express.Router();

commonMiddlewares(trainingsRouter);
trainingsRouter.use(createRateLimiter());

trainingsRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM trainings ORDER BY start_date DESC, id DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

trainingsRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM trainings WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

trainingsRouter.post('/',
    [
        body('institute').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('program_name').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('start_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('certificate_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { institute, program_name, start_date, end_date, certificate_url, is_visible } = req.body;
        
        const query = `
            INSERT INTO trainings (institute, program_name, start_date, end_date, certificate_url, is_visible)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [institute, program_name, start_date, end_date, certificate_url, is_visible]);
            res.status(201).json({ error: false, message: 'Training created successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

trainingsRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('institute').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('program_name').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('start_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('certificate_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { institute, program_name, start_date, end_date, certificate_url, is_visible } = req.body;
        
        const query = `
            UPDATE trainings 
            SET institute=$2, program_name=$3, start_date=$4, end_date=$5, certificate_url=$6, is_visible=COALESCE($7, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, institute, program_name, start_date, end_date, certificate_url, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Training not found!' });
            res.status(200).json({ error: false, message: 'Training updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

trainingsRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM trainings WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Training not found!' });
            res.status(200).json({ error: false, message: 'Training deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = trainingsRouter;

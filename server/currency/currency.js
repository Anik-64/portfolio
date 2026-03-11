const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const currencyRouter = express.Router();

// Security Middlewares
commonMiddlewares(currencyRouter);

// Rate Limiting
const currencyRouterLimiter = createRateLimiter();
currencyRouter.use(currencyRouterLimiter);

currencyRouter.get('/', async (req, res) => {
    const query = `
        SELECT * 
        FROM gen_currency
    `;

    try {
        const result = await pool.query(query);

        if (result.rowCount === 0) {
            res.status(404).json({
                error: true,
                message: "No data found!",
            });
        }

        res.status(200).json({
            error: false,
            data: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

currencyRouter.get('/:cid',
    [
        param('cid')
            .isString().withMessage('Currency id must be a string')
            .trim().escape()
            .isLength({ max: 10 }).withMessage('Currency id must be at most 10 characters long')
            .customSanitizer(value => xss(value))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }
        
        const { cid } = req.params;

        const query = `
            SELECT * 
            FROM gen_currency
            WHERE cid = $1
        `;

        try {
            const result = await pool.query(query, [cid]);

            if(result.rowCount === 0) {
                return res.status(404).json({
                    error: true,
                    message: 'No data found !'
                });
            }
            
            res.status(200).json({
                error: false,
                data: result.rows[0]
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// POST create new currency
currencyRouter.post('/',
    [
        body('cid')
            .notEmpty().withMessage('Currency ID is required')
            .isString().withMessage('Currency ID must be a string')
            .trim().escape()
            .isLength({ max: 10 }).withMessage('Currency ID must be at most 10 characters long')
            .customSanitizer(value => xss(value)),
        body('ctext')
            .notEmpty().withMessage('Currency text is required')
            .isString().withMessage('Currency text must be a string')
            .trim().escape()
            .isLength({ max: 50 }).withMessage('Currency text must be at most 50 characters long')
            .customSanitizer(value => xss(value))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }

        const { cid, ctext } = req.body;

        const query = `
            INSERT INTO gen_currency (cid, ctext)
            VALUES ($1, $2)
            RETURNING *
        `;

        const values = [cid, ctext];

        try {
            const result = await pool.query(query, values);

            res.status(201).json({
                error: false,
                message: 'Currency created successfully',
                data: result.rows[0]
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

// PUT update currency by cid
currencyRouter.put('/:cid',
    [
        param('cid')
            .isString().withMessage('Currency ID must be a string')
            .trim().escape()
            .isLength({ max: 10 }).withMessage('Currency ID must be at most 10 characters long')
            .customSanitizer(value => xss(value)),
        body('ctext')
            .notEmpty().withMessage('Currency text is required')
            .isString().withMessage('Currency text must be a string')
            .trim().escape()
            .isLength({ max: 50 }).withMessage('Currency text must be at most 50 characters long')
            .customSanitizer(value => xss(value))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }

        const { cid } = req.params;
        const { ctext } = req.body;

        const query = `
            UPDATE gen_currency
            SET ctext = $2
            WHERE cid = $1
            RETURNING *
        `;

        try {
            const result = await pool.query(query, [cid, ctext]);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: true,
                    message: 'Currency not found!'
                });
            }

            res.status(200).json({
                error: false,
                message: 'Currency updated successfully',
                data: result.rows[0]
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

// DELETE currency by cid
currencyRouter.delete('/:cid',
    [
        param('cid')
            .isString().withMessage('Currency ID must be a string')
            .trim().escape()
            .isLength({ max: 10 }).withMessage('Currency ID must be at most 10 characters long')
            .customSanitizer(value => xss(value))
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map((err) => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0],
            });
        }

        const { cid } = req.params;

        const query = `
            DELETE FROM gen_currency
            WHERE cid = $1
            RETURNING *
        `;

        try {
            const result = await pool.query(query, [cid]);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: true,
                    message: 'Currency not found!'
                });
            }

            res.status(200).json({
                error: false,
                message: 'Currency deleted successfully',
                data: result.rows[0]
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = currencyRouter;
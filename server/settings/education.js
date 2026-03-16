const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const he = require('he');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const educationRouter = express.Router();

commonMiddlewares(educationRouter);
educationRouter.use(createRateLimiter());

educationRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM education ORDER BY display_order ASC, start_year DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });

        const data = result.rows.map(row => {
            return {
                ...row,
                cgpa: he.decode(row.cgpa),
            };
        });

        res.status(200).json({ 
            error: false, 
            data: data 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            error: true, 
            message: 'Internal Server Error' 
        });
    }
});

educationRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM education WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            
            const data = {
                ...result.rows[0],
                cgpa: he.decode(result.rows[0].cgpa),
            };
            
            res.status(200).json({ 
                error: false, 
                data: data 
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

educationRouter.post('/',
    [
        body('institution').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('degree').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('field_of_study').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('start_year').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 10 }),
        body('end_year').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 10 }),
        body('cgpa').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 20 }),
        body('institution_logo_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { institution, degree, field_of_study, start_year, end_year, cgpa, institution_logo_url, display_order, is_visible } = req.body;
        
        const query = `
            INSERT INTO education (institution, degree, field_of_study, start_year, end_year, cgpa, institution_logo_url, display_order, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [institution, degree, field_of_study, start_year, end_year, cgpa, institution_logo_url, display_order, is_visible]);
            res.status(201).json({ error: false, message: 'Education created successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

educationRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('institution').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('degree').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('field_of_study').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('start_year').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 10 }),
        body('end_year').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 10 }),
        body('cgpa').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 20 }),
        body('institution_logo_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { institution, degree, field_of_study, start_year, end_year, cgpa, institution_logo_url, display_order, is_visible } = req.body;
        
        const query = `
            UPDATE education 
            SET institution=$2, degree=$3, field_of_study=$4, start_year=$5, end_year=$6, cgpa=$7, institution_logo_url=$8, display_order=COALESCE($9, display_order), is_visible=COALESCE($10, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, institution, degree, field_of_study, start_year, end_year, cgpa, institution_logo_url, display_order, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Education not found!' });
            res.status(200).json({ error: false, message: 'Education updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

educationRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM education WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Education not found!' });
            res.status(200).json({ error: false, message: 'Education deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = educationRouter;

const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const skillsRouter = express.Router();

commonMiddlewares(skillsRouter);
const skillsRouterLimiter = createRateLimiter();
skillsRouter.use(skillsRouterLimiter);

// GET all skills
skillsRouter.get('/', async (req, res) => {
    const query = `SELECT * FROM skills ORDER BY display_order ASC, id DESC`;
    try {
        const result = await pool.query(query);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: true, message: "No data found!" });
        }
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET skill by id
skillsRouter.get('/:id',
    [
        param('id').isInt().withMessage('ID must be an integer').toInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM skills WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// POST create skill
skillsRouter.post('/',
    [
        body('category').notEmpty().withMessage('Category is required').isString().trim().escape().isLength({ max: 100 }),
        body('name').notEmpty().withMessage('Name is required').isString().trim().escape().isLength({ max: 100 }),
        body('icon_slug').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 100 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { category, name, icon_slug, display_order, is_visible } = req.body;
        
        const query = `
            INSERT INTO skills (category, name, icon_slug, display_order, is_visible)
            VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [category, name, icon_slug, display_order, is_visible]);
            res.status(201).json({ error: false, message: 'Skill created successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

// PUT update skill
skillsRouter.put('/:id',
    [
        param('id').isInt().withMessage('ID must be an integer').toInt(),
        body('category').notEmpty().withMessage('Category is required').isString().trim().escape().isLength({ max: 100 }),
        body('name').notEmpty().withMessage('Name is required').isString().trim().escape().isLength({ max: 100 }),
        body('icon_slug').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 100 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { category, name, icon_slug, display_order, is_visible } = req.body;
        
        const query = `
            UPDATE skills 
            SET category = $2, name = $3, icon_slug = $4, display_order = COALESCE($5, display_order), is_visible = COALESCE($6, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, category, name, icon_slug, display_order, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Skill not found!' });
            res.status(200).json({ error: false, message: 'Skill updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

// DELETE skill
skillsRouter.delete('/:id',
    [ param('id').isInt().withMessage('ID must be an integer').toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM skills WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Skill not found!' });
            res.status(200).json({ error: false, message: 'Skill deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = skillsRouter;

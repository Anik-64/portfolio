const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const projectsRouter = express.Router();

commonMiddlewares(projectsRouter);
projectsRouter.use(createRateLimiter());

projectsRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM projects ORDER BY display_order ASC, created_at DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

projectsRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

projectsRouter.post('/',
    [
        body('title').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('slug').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('short_description').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 500 }),
        body('long_description').optional({ nullable: true, checkFalsy: true }).isString().trim(),
        body('thumbnail_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('live_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('github_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('tags').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('category').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 100 }),
        body('is_featured').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, slug, short_description, long_description, thumbnail_url, live_url, github_url, tags, category, is_featured, display_order, is_visible } = req.body;
        
        const query = `
            INSERT INTO projects (title, slug, short_description, long_description, thumbnail_url, live_url, github_url, tags, category, is_featured, display_order, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, false), COALESCE($11, 0), COALESCE($12, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [title, slug, short_description, long_description?xss(long_description):null, thumbnail_url, live_url, github_url, tags, category, is_featured, display_order, is_visible]);
            res.status(201).json({ error: false, message: 'Project created successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

projectsRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('title').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('slug').notEmpty().isString().trim().escape().isLength({ max: 255 }),
        body('short_description').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 500 }),
        body('long_description').optional({ nullable: true, checkFalsy: true }).isString().trim(),
        body('thumbnail_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('live_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('github_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('tags').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('category').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 100 }),
        body('is_featured').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean(),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt(),
        body('is_visible').optional({ nullable: true, checkFalsy: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, slug, short_description, long_description, thumbnail_url, live_url, github_url, tags, category, is_featured, display_order, is_visible } = req.body;
        
        const query = `
            UPDATE projects 
            SET title=$2, slug=$3, short_description=$4, long_description=$5, thumbnail_url=$6, live_url=$7, github_url=$8, tags=$9, category=$10, is_featured=COALESCE($11, is_featured), display_order=COALESCE($12, display_order), is_visible=COALESCE($13, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, title, slug, short_description, long_description?xss(long_description):null, thumbnail_url, live_url, github_url, tags, category, is_featured, display_order, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Project not found!' });
            res.status(200).json({ error: false, message: 'Project updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

projectsRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM projects WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Project not found!' });
            res.status(200).json({ error: false, message: 'Project deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = projectsRouter;

const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const projectImagesRouter = express.Router();

commonMiddlewares(projectImagesRouter);
projectImagesRouter.use(createRateLimiter());

projectImagesRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM project_images ORDER BY project_id ASC, display_order ASC, id DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

projectImagesRouter.get('/project/:projectId',
    [ param('projectId').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM project_images WHERE project_id = $1 ORDER BY display_order ASC`, [req.params.projectId]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

projectImagesRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM project_images WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });
            res.status(200).json({ error: false, data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

projectImagesRouter.post('/',
    [
        body('project_id').notEmpty().isInt().toInt(),
        body('image_url').notEmpty().isURL(),
        body('caption').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { project_id, image_url, caption, display_order } = req.body;
        
        const query = `
            INSERT INTO project_images (project_id, image_url, caption, display_order)
            VALUES ($1, $2, $3, COALESCE($4, 0))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [project_id, image_url, caption, display_order]);
            res.status(201).json({ error: false, message: 'Image created successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

projectImagesRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('project_id').notEmpty().isInt().toInt(),
        body('image_url').notEmpty().isURL(),
        body('caption').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('display_order').optional({ nullable: true, checkFalsy: true }).isInt().toInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { project_id, image_url, caption, display_order } = req.body;
        
        const query = `
            UPDATE project_images 
            SET project_id=$2, image_url=$3, caption=$4, display_order=COALESCE($5, display_order)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, project_id, image_url, caption, display_order]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Image not found!' });
            res.status(200).json({ error: false, message: 'Image updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

projectImagesRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM project_images WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Image not found!' });
            res.status(200).json({ error: false, message: 'Image deleted successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.detail || 'Internal Server Error' });
        }
    }
);

module.exports = projectImagesRouter;

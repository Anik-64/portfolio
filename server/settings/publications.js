const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../../auth/middleware/commonMiddleware');
const xss = require('xss');
const he = require('he');
const { validationResult, body, param } = require('express-validator');
const pool = require('../../db'); 

const publicationsRouter = express.Router();

commonMiddlewares(publicationsRouter);
publicationsRouter.use(createRateLimiter());

publicationsRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM publications ORDER BY published_date DESC, id DESC`);
        if (result.rowCount === 0) return res.status(404).json({ error: true, message: "No data found!" });

        const formattedData = result.rows.map((row) => {
            return {
                ...row,
                doi: row.doi ? he.decode(row.doi) : null,
            };
        });
        
        res.status(200).json({ 
            error: false, 
            data: formattedData
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            error: true, 
            message: 'Internal Server Error' 
        });
    }
});

publicationsRouter.get('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });
        
        try {
            const result = await pool.query(`SELECT * FROM publications WHERE id = $1`, [req.params.id]);
            if(result.rowCount === 0) return res.status(404).json({ error: true, message: 'No data found!' });

            const formattedData = result.rows.map((row) => {
                return {
                    ...row,
                    doi: row.doi ? he.decode(row.doi) : null,
                };
            });

            res.status(200).json({ 
                error: false, 
                data: formattedData[0] 
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

publicationsRouter.post('/',
    [
        body('title').notEmpty().isString().trim().escape().isLength({ max: 500 }),
        body('journal_name').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('publisher').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('authors').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('author_linkedin_urls').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('abstract').optional({ nullable: true, checkFalsy: true }).isString().trim(),
        body('published_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('doi').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('publication_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('pdf_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('thumbnail_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('is_visible').optional({ nullable: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, journal_name, publisher, authors, author_linkedin_urls, abstract, published_date, doi, publication_url, pdf_url, thumbnail_url, is_visible } = req.body;
        
        const query = `
            INSERT INTO publications (title, journal_name, publisher, authors, author_linkedin_urls, abstract, published_date, doi, publication_url, pdf_url, thumbnail_url, is_visible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, true))
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [title, journal_name, publisher, authors, author_linkedin_urls, abstract?xss(abstract):null, published_date, doi, publication_url, pdf_url, thumbnail_url, is_visible]);
            res.status(201).json({ 
                error: false, 
                message: 'Publication created successfully', 
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

publicationsRouter.put('/:id',
    [
        param('id').isInt().toInt(),
        body('title').notEmpty().isString().trim().escape().isLength({ max: 500 }),
        body('journal_name').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('publisher').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('authors').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('author_linkedin_urls').optional({ nullable: true, checkFalsy: true }).isArray(),
        body('abstract').optional({ nullable: true, checkFalsy: true }).isString().trim(),
        body('published_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
        body('doi').optional({ nullable: true, checkFalsy: true }).isString().trim().escape().isLength({ max: 255 }),
        body('publication_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('pdf_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('thumbnail_url').optional({ nullable: true, checkFalsy: true }).isURL(),
        body('is_visible').optional({ nullable: true }).isBoolean().toBoolean()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const { title, journal_name, publisher, authors, author_linkedin_urls, abstract, published_date, doi, publication_url, pdf_url, thumbnail_url, is_visible } = req.body;
        
        const query = `
            UPDATE publications 
            SET title=$2, journal_name=$3, publisher=$4, authors=$5, author_linkedin_urls=$6, abstract=$7, published_date=$8, doi=$9, publication_url=$10, pdf_url=$11, thumbnail_url=$12, is_visible=COALESCE($13, is_visible)
            WHERE id = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, title, journal_name, publisher, authors, author_linkedin_urls, abstract?xss(abstract):null, published_date, doi, publication_url, pdf_url, thumbnail_url, is_visible]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Publication not found!' });
            res.status(200).json({ 
                error: false, 
                message: 'Publication updated successfully', 
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

publicationsRouter.delete('/:id',
    [ param('id').isInt().toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        try {
            const result = await pool.query(`DELETE FROM publications WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Publication not found!' });
            res.status(200).json({ 
                error: false, 
                message: 'Publication deleted successfully', 
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

module.exports = publicationsRouter;

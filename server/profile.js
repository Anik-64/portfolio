const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('../auth/middleware/commonMiddleware');
const xss = require('xss');
const { validationResult, body, param } = require('express-validator');
const pool = require('../db'); 
const { logAudit } = require('./utils/auditLogger');

const profileRouter = express.Router();

commonMiddlewares(profileRouter);
const profileRouterLimiter = createRateLimiter();
profileRouter.use(profileRouterLimiter);

// GET profile info
profileRouter.get('/', async (req, res) => {
    const peopleno = req.user.peopleno;
    if (!peopleno) return res.status(400).json({ error: true, message: 'User profile not found' });

    try {
        const result = await pool.query(`SELECT * FROM gen_peopleprimary WHERE peopleno = $1`, [peopleno]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: true, message: "Profile data not found!" });
        }
        res.status(200).json({ error: false, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT update profile info
profileRouter.put('/',
    [
        body('firstname').notEmpty().withMessage('First Name is required').isString().trim().escape().isLength({ max: 127 }),
        body('lastname').optional({ nullable: true }).isString().trim().escape().isLength({ max: 127 }),
        body('tagline').optional({ nullable: true }).isArray(),
        body('bio').optional({ nullable: true }).isString().trim(),
        body('profilepicurl').optional({ nullable: true }).isString().trim().isLength({ max: 511 }),
        body('resume_url').optional({ nullable: true }).isString().trim(),
        body('years_of_experience').optional({ nullable: true }).isInt().toInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const peopleno = req.user.peopleno;
        if (!peopleno) return res.status(400).json({ error: true, message: 'User profile not found' });

        const { firstname, lastname, tagline, bio, profilepicurl, resume_url, years_of_experience } = req.body;
        
        const query = `
            UPDATE gen_peopleprimary 
            SET firstname = $2, lastname = $3, tagline = $4, bio = $5, profilepicurl = $6, resume_url = $7, years_of_experience = $8
            WHERE peopleno = $1
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [peopleno, firstname, lastname, tagline, bio, profilepicurl, resume_url, years_of_experience]);
            await logAudit(req.user.userno, 'UPDATE', 'gen_peopleprimary', peopleno, { firstname, lastname });
            
            res.status(200).json({ error: false, message: 'Profile updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// GET all contact types
profileRouter.get('/contact-types', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM gen_contacttype ORDER BY contacttypetitle ASC`);
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET user contacts
profileRouter.get('/contacts', async (req, res) => {
    const peopleno = req.user.peopleno;
    try {
        const query = `
            SELECT pc.*, ct.contacttypetitle 
            FROM gen_peoplecontact pc
            JOIN gen_contacttype ct ON pc.contacttypeno = ct.contacttypeno
            WHERE pc.peopleno = $1
            ORDER BY pc.id DESC
        `;
        const result = await pool.query(query, [peopleno]);
        res.status(200).json({ error: false, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST add contact
profileRouter.post('/contacts',
    [
        body('contacttypeno').notEmpty().withMessage('Contact Type is required').isInt().toInt(),
        body('contact').notEmpty().withMessage('Contact detail is required').isString().trim().escape().isLength({ max: 511 }),
        body('contactprefix').optional({ nullable: true }).isString().trim().escape().isLength({ max: 15 }),
        body('usenote').optional({ nullable: true }).isString().trim().escape().isLength({ max: 255 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const peopleno = req.user.peopleno;
        const { contacttypeno, contact, contactprefix, usenote } = req.body;

        const query = `
            INSERT INTO gen_peoplecontact (peopleno, contacttypeno, contact, contactprefix, usenote)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [peopleno, contacttypeno, contact, contactprefix, usenote]);
            const newRecord = result.rows[0];
            await logAudit(req.user.userno, 'CREATE', 'gen_peoplecontact', newRecord.id, { contact });
            
            res.status(201).json({ error: false, message: 'Contact added successfully', data: newRecord });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// PUT update contact
profileRouter.put('/contacts/:id',
    [
        param('id').isInt().withMessage('ID must be an integer').toInt(),
        body('contacttypeno').notEmpty().withMessage('Contact Type is required').isInt().toInt(),
        body('contact').notEmpty().withMessage('Contact detail is required').isString().trim().escape().isLength({ max: 511 }),
        body('contactprefix').optional({ nullable: true }).isString().trim().escape().isLength({ max: 15 }),
        body('usenote').optional({ nullable: true }).isString().trim().escape().isLength({ max: 255 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const peopleno = req.user.peopleno;
        const { contacttypeno, contact, contactprefix, usenote } = req.body;

        const query = `
            UPDATE gen_peoplecontact 
            SET contacttypeno = $3, contact = $4, contactprefix = $5, usenote = $6
            WHERE id = $1 AND peopleno = $2
            RETURNING *
        `;
        try {
            const result = await pool.query(query, [req.params.id, peopleno, contacttypeno, contact, contactprefix, usenote]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Contact not found!' });
            
            await logAudit(req.user.userno, 'UPDATE', 'gen_peoplecontact', req.params.id, { contact });
            
            res.status(200).json({ error: false, message: 'Contact updated successfully', data: result.rows[0] });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

// DELETE contact
profileRouter.delete('/contacts/:id',
    [ param('id').isInt().withMessage('ID must be an integer').toInt() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ error: true, message: errors.array()[0].msg });

        const peopleno = req.user.peopleno;
        try {
            const result = await pool.query(`DELETE FROM gen_peoplecontact WHERE id = $1 AND peopleno = $2 RETURNING *`, [req.params.id, peopleno]);
            if (result.rowCount === 0) return res.status(404).json({ error: true, message: 'Contact not found!' });
            
            await logAudit(req.user.userno, 'DELETE', 'gen_peoplecontact', req.params.id, { contact: result.rows[0].contact });
            
            res.status(200).json({ error: false, message: 'Contact deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
);

module.exports = profileRouter;

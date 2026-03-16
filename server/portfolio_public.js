const express = require('express');
const pool = require('../db');
const rateLimit = require('express-rate-limit');
const he = require('he');
const portfolioPublicRouter = express.Router();

// Rate limiter for contact form: 3 messages per hour per IP
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, 
    message: { error: true, message: 'Too many messages sent from this IP, please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Recursive helper to decode HTML entities in any data structure
 */
const decodeData = (data) => {
    if (typeof data === 'string') {
        return he.decode(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => decodeData(item));
    }
    if (typeof data === 'object' && data !== null) {
        const decodedObj = {};
        for (const key in data) {
            decodedObj[key] = decodeData(data[key]);
        }
        return decodedObj;
    }
    return data;
};

// Helper to fetch all data for the public portfolio
portfolioPublicRouter.get('/data', async (req, res) => {
    try {
        // Fetch everything in parallel
        const [
            profile,
            contacts,
            skills,
            experiences,
            projects,
            projectImages,
            certifications,
            publications,
            education,
            trainings
        ] = await Promise.all([
            pool.query('SELECT * FROM gen_peopleprimary LIMIT 1'),
            pool.query(`
                SELECT pc.*, ct.contacttypetitle 
                FROM gen_peoplecontact pc
                JOIN gen_contacttype ct ON pc.contacttypeno = ct.contacttypeno
            `),
            pool.query('SELECT * FROM skills WHERE is_visible = true ORDER BY category, display_order'),
            pool.query('SELECT * FROM experiences WHERE is_visible = true ORDER BY display_order, start_date DESC'),
            pool.query('SELECT * FROM projects WHERE is_visible = true ORDER BY display_order, created_at DESC'),
            pool.query('SELECT * FROM project_images ORDER BY display_order'),
            pool.query('SELECT * FROM certifications WHERE is_visible = true ORDER BY display_order, issued_date DESC'),
            pool.query('SELECT * FROM publications WHERE is_visible = true ORDER BY published_date DESC'),
            pool.query('SELECT * FROM education WHERE is_visible = true ORDER BY display_order, end_year DESC'),
            pool.query('SELECT * FROM trainings WHERE is_visible = true ORDER BY end_date DESC')
        ]);

        // Group skills by category
        const groupedSkills = skills.rows.reduce((acc, skill) => {
            if (!acc[skill.category]) acc[skill.category] = [];
            acc[skill.category].push(skill);
            return acc;
        }, {});

        // Attach images to projects
        const projectsWithImages = projects.rows.map(project => {
            return {
                ...project,
                images: projectImages.rows.filter(img => img.project_id === project.id)
            };
        });

        const rawData = {
            profile: profile.rows[0] || null,
            contacts: contacts.rows,
            skills: groupedSkills,
            experiences: experiences.rows,
            projects: projectsWithImages,
            certifications: certifications.rows,
            publications: publications.rows,
            education: education.rows,
            trainings: trainings.rows
        };

        // Decode All Data for Public Consumption
        const decodedData = decodeData(rawData);

        res.status(200).json({
            error: false,
            data: decodedData
        });
    } catch (err) {
        console.error('Error fetching public portfolio data:', err);
        res.status(500).json({ error: true, message: 'Internal Server Error' });
    }
});

// Submit contact message with rate limiting
portfolioPublicRouter.post('/contact', contactLimiter, async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: true, message: 'Name, email, and message are required' });
    }

    try {
        const query = `
            INSERT INTO contact_messages (sender_name, sender_email, subject, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await pool.query(query, [name, email, subject, message]);
        
        // Decode result data
        const decodedResult = decodeData(result.rows[0]);

        res.status(201).json({ error: false, message: 'Message sent successfully', data: decodedResult });
    } catch (err) {
        console.error('Error saving contact message:', err);
        res.status(500).json({ error: true, message: 'Internal Server Error' });
    }
});

module.exports = portfolioPublicRouter;

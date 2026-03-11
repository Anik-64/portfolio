const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('./middleware/commonMiddleware');
const xss = require('xss');
const { body, validationResult, query } = require('express-validator');
const pool = require('../db');
const admin = require('../server/firebase');

const registrationRouter = express.Router();

// Security Middlewares
commonMiddlewares(registrationRouter);

// Rate Limiting
const registrationLimiter = createRateLimiter();
registrationRouter.use(registrationLimiter);

// It is handling a GET request to check if a username exists in a database table called `gen_users` 
registrationRouter.get('/exists',
    [
        query('username')
            .notEmpty().withMessage('Username is required')
            .isString().withMessage('Username must be a string')
            .trim().escape()
            .isLength({ min: 3, max: 255 }).withMessage('Username must be between 3 to 255 characters long')
            .customSanitizer(value => xss(value))
            .custom(value => {
                if (/\s/.test(value)) {
                    throw new Error('Username must not contain spaces');
                }
                return true;
            }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(err => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0]
            });
        }

        const { username } = req.query;

        const query = `
            SELECT username FROM gen_users
            WHERE username = $1;
        `;

        try {
            const result = await pool.query(query, [username]);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: true,
                    message: 'Username does not exist'
                });
            }

            res.status(200).json({
                error: false,
                message: 'Username exists'
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                error: true,
                message: "Internal server error"
            });
        }
    }
);

// It is handling a POST request to register a new user.
registrationRouter.post('/',
    [
        body('token').notEmpty().withMessage('Firebase ID Token is required'),
        body('firstname')
            .notEmpty().withMessage('First name is required')
            .isString().withMessage('First name must be a string')
            .trim().escape()
            .isLength({ max: 127 }).withMessage('First name must be at most 127 characters long')
            .matches(/^[A-Za-z. ]+$/).withMessage('First name can contain only letters, periods, and spaces')
            .customSanitizer(value => {
                return xss(
                    value.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')
                );
            }),
        body('lastname')
            .optional({ checkFalsy: true })
            .isString().withMessage('Last name must be a string')
            .trim().escape()
            .isLength({ max: 127 }).withMessage('Last name must be at most 127 characters long')
            .matches(/^[a-zA-Z ]+$/).withMessage('Last name must contain only alphabetic characters')
            .customSanitizer(value => {
                return xss(
                    value.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')
                );
            })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(err => err.msg);
            return res.status(400).json({
                error: true,
                message: errorMessages[0]
            });
        }

        const {
            token,
            firstname,
            lastname
        } = req.body;

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const firebase_uid = decodedToken.uid;
            const email = decodedToken.email;

            let contact = email;
            let contacttypeno = 3;

            if (!contact && decodedToken.phone_number) {
                contact = decodedToken.phone_number;
                contacttypeno = 1;
            }

            if (!contact) {
                return res.status(400).json({
                    error: true,
                    message: "User must have an email or phone number associated with Firebase account."
                });
            }

            const username = contact;

            // Check if user already exists BEFORE transaction for faster response
            const existingUser = await pool.query(`
                SELECT username FROM gen_users 
                WHERE firebase_uid = $1 OR username = $2
            `, [firebase_uid, username]);

            if (existingUser.rowCount > 0) {
                return res.status(400).json({
                    error: true,
                    message: 'User already exists.'
                });
            }

            await pool.query("BEGIN");
            
            const peopleResult = await pool.query(`
                    INSERT INTO gen_peopleprimary 
                        (peopleid, firstname, lastname, gendersetno) 
                    VALUES ($1, $2, $3, $4)
                    RETURNING peopleno;
                `, [contact, firstname, lastname, 4] // 4 = Not mentioned
            );
            const peopleno = peopleResult.rows[0].peopleno;

            await pool.query(`
                    INSERT INTO gen_peoplecontact 
                        (peopleno, contacttypeno, contact, isverified) 
                    VALUES ($1, $2, $3, $4)
                `, [peopleno, contacttypeno, contact, 1]
            );

            const userResult = await pool.query(`
                    INSERT INTO gen_users 
                        (peopleno, username, firebase_uid, primaryuserroleno) 
                    VALUES ($1, $2, $3, $4)
                    RETURNING userno;
                `, [peopleno, username, firebase_uid, 3]
            );
            const userno = userResult.rows[0].userno;

            await pool.query(`
                INSERT INTO gen_userroles (userno, userroleno)
                VALUES ($1, 3)
            `, [userno]);

            await pool.query("COMMIT");

            res.status(201).json({
                error: false,
                message: 'Registration successful',
                referralcode: newReferralCode
            });
        } catch (err) {
            await pool.query("ROLLBACK");
            console.error(err);

            if (err.code && err.code.startsWith('auth/')) {
                return res.status(401).json({
                    error: true,
                    message: "Invalid or expired token."
                });
            }

            res.status(500).json({
                error: true,
                message: "Internal server error"
            });
        }
    }
);

module.exports = registrationRouter;
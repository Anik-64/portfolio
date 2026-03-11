const express = require('express');
const { commonMiddlewares, createRateLimiter } = require('./middleware/commonMiddleware');
const { generateTokens } = require('./middleware/authMiddleware')
const xss = require('xss');
const axios = require("axios");
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const admin = require('../server/firebase');
const loginRouter = express.Router();

// Middleware
commonMiddlewares(loginRouter);

// Rate Limiting
const loginRouterLimiter = createRateLimiter(5 * 60 * 1000, 100, "Too many login attempts, please try again later.");
loginRouter.use(loginRouterLimiter);

// Router for login
loginRouter.post('/',
    [
        body('token').notEmpty().withMessage('Firebase ID Token is required')
    ],
    async (req, res) => {
        const { token } = req.body;
        let ipaddress = req.get('X-Appengine-User-Ip') ||
            req.get('CF-Connecting-IP') ||
            req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
            req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'Unknown';

        console.log(`Login attempt from IP: ${ipaddress}`);

        const attemptno = await insertLoginAttempt('FIREBASE_AUTH', ipaddress, req.get('User-Agent'));

        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorMessages = errors.array().map(err => err.msg);
                await markLoginFailure(attemptno, errorMessages[0]);
                return res.status(400).json({
                    error: true,
                    message: errorMessages[0]
                });
            }

            const decodedToken = await admin.auth().verifyIdToken(token);
            const firebase_uid = decodedToken.uid;
            const email = decodedToken.email;
            let userResult = await pool.query(`
                SELECT 
                    u.userno, u.peopleno, u.userstatusno, u.primaryuserroleno, u.primaryuserroletitle, u.username,
                    us.userstatustitle,
                    pp.dob, pp.profilepicurl,
                    COALESCE(pp.firstname, '') || ' ' || COALESCE(pp.lastname, '') AS fullname
                FROM 
                    (
                        SELECT 
                            userno, username, peopleno, userstatusno, primaryuserroleno,
                            (SELECT userroletitle from gen_userrolesetting WHERE userroleno=u.primaryuserroleno) as primaryuserroletitle
                        FROM gen_users as u
                        WHERE firebase_uid = $1
                    ) AS u
                    INNER JOIN 
                    (
                        SELECT userstatusno, userstatustitle FROM gen_userstatus
                    ) AS us
                    ON u.userstatusno = us.userstatusno
                    INNER JOIN 
                    (
                        SELECT peopleno, profilepicurl, firstname, lastname FROM gen_peopleprimary
                    ) AS pp
                    ON u.peopleno = pp.peopleno
            `, [firebase_uid]);

            if (userResult.rowCount === 0 && email) {
                userResult = await pool.query(`
                    SELECT 
                        u.userno, u.peopleno, u.userstatusno, u.primaryuserroleno, u.username,
                        us.userstatustitle,
                        pp.profilepicurl,
                        COALESCE(pp.firstname, '') || ' ' || COALESCE(pp.lastname, '') AS fullname
                    FROM 
                        (
                            SELECT 
                                userno, username, peopleno, userstatusno, primaryuserroleno,
                                (SELECT userroletitle from gen_userrolesetting WHERE userroleno=u.primaryuserroleno) as primaryuserroletitle
                            FROM gen_users as u
                            WHERE username = $1
                        ) AS u
                        INNER JOIN 
                        (
                            SELECT userstatusno, userstatustitle FROM gen_userstatus
                        ) AS us
                        ON u.userstatusno = us.userstatusno
                        INNER JOIN 
                        (
                            SELECT peopleno, profilepicurl, firstname, lastname FROM gen_peopleprimary
                        ) AS pp
                        ON u.peopleno = pp.peopleno
                `, [email]);

                if (userResult.rowCount > 0) {
                    await pool.query('UPDATE gen_users SET firebase_uid = $1 WHERE userno = $2', [firebase_uid, userResult.rows[0].userno]);
                }
            }


            if (userResult.rowCount === 0) {
                await markLoginFailure(attemptno, 'User not found');
                return res.status(401).json({
                    error: true,
                    message: 'User not registered in system.'
                });
            }

            const user = userResult.rows[0];
            const userno = user['userno'];
            const username = user['username'];

            // Check if the user is active
            if (user.userstatusno !== 1) {
                return res.status(403).json({
                    error: true,
                    message: `Account status: ${user.userstatustitle}`
                });
            }

            const userRoleResult = await pool.query(`
                SELECT userno, userroleno, validuntil
                    FROM gen_userroles
                    WHERE userroleno IN (
                            SELECT userroleno
                            FROM gen_userrolesetting
                        ) AND userno = $1
                `, [userno]
            );

            // Get current time
            const currentTime = new Date().toISOString();

            const payload = {
                userno: user.userno,
                peopleno: user.peopleno,
                fullname: user.fullname,
                primaryuserroleno: user.primaryuserroleno,
                primaryuserroletitle: user.primaryuserroletitle,
                userroles: userRoleResult.rows, 
                profilepicurl: user.profilepicurl ? user.profilepicurl : null,
                currenttime: currentTime
            };
            console.log(payload);

            const { accessToken, refreshToken } = generateTokens(payload);

            await markLoginSuccess(attemptno, userno, 'Login successful');

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.cookie('token', accessToken, {
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 4 * 24 * 60 * 60 * 1000 // 4 days
            });

            res.status(200).json({
                message: 'Login successful',
                token: accessToken,
                refreshToken: refreshToken,
                ...payload
            });

        } catch (err) {
            await markLoginFailure(attemptno, err.message || 'Firebase Error');
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

// Logout Endpoint
loginRouter.post('/logout', (req, res) => {
    console.log('Logout request received');
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.status(200).json({
        error: false,
        message: 'Logout successful'
    });
});

module.exports = loginRouter;
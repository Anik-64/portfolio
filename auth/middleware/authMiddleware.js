const jwt = require('jsonwebtoken');
const fs = require("fs");
const dotenv = require("dotenv");
const pool = require('../../db');

dotenv.config();

if (!process.env.JWT_SECRET && fs.existsSync("project.env")) {
    console.log("Default .env not found or missing JWT_SECRET. Loading from project.env...");
    dotenv.config({ path: "project.env" });
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Generates both access and refresh tokens
const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '4d' }); // TODO: Have to change the time to (1h) for production
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' }); // Valid for 7 days

    return { accessToken, refreshToken };
};


// Function to validate JWT token
const authenticateToken = (req, res, next) => {
    // Get the token from the request headers
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: true,
            message: 'Access denied, token missing!'
        });
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Check for specific expiration error
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ 
                    error: true,
                    message: 'Token has expired!'
                });
            }

            return res.status(403).json({ 
                error: true,
                message: 'Invalid token!'
            });
        }

        req.user = user;
        next();
    });
};

// Middleware for rendering pages with authenticated user data
const authenticateRender = (req, res, next) => {
    const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        console.log("No token found - redirecting to login");
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        req.user = user;
        res.locals.user = {
            fullname: user.fullname,
            profilepicurl: user.profilepicurl
        };
    });

    next();
};


module.exports = {
    generateTokens,
    authenticateToken,
    authenticateRender
};

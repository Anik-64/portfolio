const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const routers = require('./routers/routers');
const { login, signup, refreshToken, authenticateToken, authorizeRoles, authenticateRender, authorizeAdminRender } = require('./auth/routers/authRouters.js');
const apiTestLogger = require('./auth/middleware/apiTestMiddleware');

require('dotenv').config();

const app = express();
app.use(cookieParser());
app.use('/api/v1', apiTestLogger);

app.use(
    '/api/v1/upload',
    authenticateToken,
    authorizeRoles([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]),
    routers.profilePicRouter
);
app.use(
    '/api/v1/books/upload',
    authenticateToken,
    authorizeRoles([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]),
    routers.bookUploadRouter
);

app.use(express.json());

const corsOptions = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

app.use(cors(corsOptions));

// Log file
const logPath = process.platform === 'win32'
    ? path.join(process.env.TEMP || __dirname, 'access.log')
    : path.join('/tmp', 'access.log');

// const logStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
console.log('Access log file path:', logStream.path);
morgan.token('body', (req) => {
    const body = { ...req.body };
    if (body.password) body.password = '*****';
    return JSON.stringify(body);
});

app.use(morgan(':date[iso] :method :url :status :response-time ms - :body', { stream: logStream }));
app.use(morgan('dev'));

// Health Check
app.get('/api/v1/healthcheck', (req, res) => {
    try {
        res.status(200).json({ 'status': 'Ok' }).end();
    } catch (err) {
        res.status(503).end();
    }
});

app.set('trust proxy', 2);

// Templet Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(expressLayouts);

app.use((req, res, next) => {
    res.locals.appName = 'Ebook Admin';
    res.locals.message = 'Welcome to Ebook API Service!';
    res.locals.layout = 'layout';
    next();
});

app.get('/', (req, res) => {
    res.redirect('/login');
});
app.get('/login', (req, res) => {
    res.render('pages/login', {
        title: 'Login',
        layout: false
    });
});

app.get('/signup', (req, res) => {
    res.render('pages/signup', {
        title: 'Sign Up',
        layout: false
    });
});

app.get('/unauthorized', (req, res) => {
    res.render('pages/unauthorized', {
        title: 'Unauthorized Access',
        layout: false,
    });
});

app.get('/dashboard', authenticateRender, authorizeAdminRender, (req, res) => {
    res.render('pages/dashboard', {
        layout: 'layout',
        title: 'Dashboard',
        currentPath: 'dashboard',
        customJS: '/js/dashboard.js',
        // cache: true,
    });
});
app.get('/currency', authenticateRender, authorizeAdminRender, (req, res) => {
    res.render('pages/currency', {
        layout: 'layout',
        title: 'Currency Settings',
        currentPath: 'currency',
        customJS: '/js/currency.js',
        // cache: true,
    });
});

// AUTH API Gateways
app.use('/api/v1/signup', signup);
app.use('/api/v1/login', login);
app.use('/api/v1/refresh-token', authenticateToken, refreshToken);

app.use(
    '/api/v1/currency',
    authenticateToken,
    authorizeRoles([1, 2, 3]),
    routers.currencyRouter
);

app.listen(process.env.PORT || 8080, () => {
    console.log(`Server running on port ${process.env.PORT || 8080}`);
});

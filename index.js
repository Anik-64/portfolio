const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const routers = require('./routers/routers');
const { login, signup, refreshToken, authenticateToken, authenticateRender } = require('./auth/routers/authRouters.js');

require('dotenv').config();

const app = express();
app.use(cookieParser());

app.use(
    '/api/v1/upload',
    authenticateToken,
    routers.profilePicRouter
);
app.use(
    '/api/v1/upload/book',
    authenticateToken,
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
    res.locals.appName = 'Portfolio Admin';
    res.locals.message = 'Welcome to Portfolio API Service!';
    res.locals.layout = 'layout';
    next();
});

app.get('/', (req, res) => {
    res.redirect('/login');
});
app.get('/login', (req, res) => {
    res.render('pages/login', {
        title: 'Login',
        layout: false,
        firebaseConfig: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            measurementId: process.env.FIREBASE_MEASUREMENT_ID
        }
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

// Public Portfolio Route
app.get('/portfolio', async (req, res) => {
    res.render('pages/portfolio', {
        layout: false, 
        title: 'Portfolio | Software Engineer'
    });
});

// Settings Frontend Routes
app.get('/settings/skills', authenticateRender, (req, res) => {
    res.render('pages/settings/skills', { 
        layout: 'layout', 
        title: 'Skills Settings', 
        currentPath: 'settings/skills', 
        customJS: '/js/settings/skills.js',
        cache: true,
    });
});
app.get('/settings/experiences', authenticateRender, (req, res) => {
    res.render('pages/settings/experiences', { 
        layout: 'layout', 
        title: 'Experiences Settings', 
        currentPath: 'settings/experiences', 
        customJS: '/js/settings/experiences.js',
        cache: true,
    });
});
app.get('/settings/projects', authenticateRender, (req, res) => {
    res.render('pages/settings/projects', { 
        layout: 'layout', 
        title: 'Projects Settings', 
        currentPath: 'settings/projects', 
        customJS: '/js/settings/projects.js',
        cache: true,
    });
});
app.get('/settings/project-images', authenticateRender, (req, res) => {
    res.render('pages/settings/project_images', { 
        layout: 'layout', 
        title: 'Project Images Settings', 
        currentPath: 'settings/project-images', 
        customJS: '/js/settings/project_images.js',
        cache: true,
    });
});
app.get('/settings/certifications', authenticateRender, (req, res) => {
    res.render('pages/settings/certifications', { 
        layout: 'layout', 
        title: 'Certifications Settings', 
        currentPath: 'settings/certifications', 
        customJS: '/js/settings/certifications.js',
        cache: true,
    });
});
app.get('/settings/publications', authenticateRender, (req, res) => {
    res.render('pages/settings/publications', { 
        layout: 'layout', 
        title: 'Publications Settings', 
        currentPath: 'settings/publications', 
        customJS: '/js/settings/publications.js',
        cache: true,
    });
});
app.get('/settings/education', authenticateRender, (req, res) => {
    res.render('pages/settings/education', { 
        layout: 'layout', 
        title: 'Education Settings', 
        currentPath: 'settings/education', 
        customJS: '/js/settings/education.js',
        cache: true,
    });
});
app.get('/settings/trainings', authenticateRender, (req, res) => {
    res.render('pages/settings/trainings', { 
        layout: 'layout', 
        title: 'Trainings Settings', 
        currentPath: 'settings/trainings', 
        customJS: '/js/settings/trainings.js',
        cache: true,
    });
});
app.get('/settings/contact-messages', authenticateRender, (req, res) => {
    res.render('pages/settings/contact_messages', { 
        layout: 'layout', 
        title: 'Contact Messages', 
        currentPath: 'settings/contact-messages', 
        customJS: '/js/settings/contact_messages.js',
        cache: true,
    });
});
app.get('/settings/audit-log', authenticateRender, (req, res) => {
    res.render('pages/settings/audit_log', { 
        layout: 'layout', 
        title: 'Audit Log', 
        currentPath: 'settings/audit-log', 
        customJS: '/js/settings/audit_log.js',
        cache: true,
    });
});

app.get('/profile', authenticateRender, (req, res) => {
    res.render('pages/profile', { 
        layout: 'layout', 
        title: 'My Profile', 
        currentPath: 'profile', 
        customJS: '/js/profile.js',
        cache: true,
    });
});

// AUTH API Gateways
app.use('/api/v1/signup', signup);
app.use('/api/v1/login', login);
app.use('/api/v1/refresh-token', authenticateToken, refreshToken);

app.use(
    '/api/v1/settings/skills', 
    authenticateToken, 
    routers.skillsRouter
);
app.use(
    '/api/v1/settings/experiences', 
    authenticateToken, 
    routers.experiencesRouter
);
app.use(
    '/api/v1/settings/projects', 
    authenticateToken, 
    routers.projectsRouter
);
app.use(
    '/api/v1/settings/project-images', 
    authenticateToken, 
    routers.projectImagesRouter
);
app.use(
    '/api/v1/settings/certifications', 
    authenticateToken, 
    routers.certificationsRouter
);
app.use(
    '/api/v1/settings/publications', 
    authenticateToken, 
    routers.publicationsRouter
);
app.use(
    '/api/v1/settings/education', 
    authenticateToken, 
    routers.educationRouter
);
app.use(
    '/api/v1/settings/trainings', 
    authenticateToken, 
    routers.trainingsRouter
);
app.use(
    '/api/v1/settings/contact-messages', 
    authenticateToken, 
    routers.contactMessagesRouter
);
app.use(
    '/api/v1/settings/audit-log', 
    authenticateToken, 
    routers.auditLogRouter
);

app.use(
    '/api/v1/profile', 
    authenticateToken, 
    routers.profileRouter
);

// Public API Gateways (No authentication required)
app.use('/api/v1/public', routers.portfolioPublicRouter);

app.listen(process.env.PORT || 8080, () => {
    console.log(`Server running on port ${process.env.PORT || 8080}`);
});

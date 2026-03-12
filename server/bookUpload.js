const express = require('express');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const path = require('path');
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();
if (!process.env.PROJECT_ID && fs.existsSync("project.env")) {
    console.log("Default .env not found or missing PROJECT_ID. Loading from project.env...");
    dotenv.config({ path: "project.env" });
}

const bookUploadRouter = express.Router();

const projectId = process.env.PROJECT_ID;
const bucketName = process.env.BUCKET_NAME;
const credentials = {
    type: process.env.CYBERNETIC_TYPE,
    project_id: process.env.CYBERNETIC_PROJECT_ID,
    private_key_id: process.env.CYBERNETIC_PRIVATE_KEY_ID,
    private_key: process.env.CYBERNETIC_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.CYBERNETIC_CLIENT_KEY,
    client_id: process.env.CYBERNETIC_CLIENT_ID,
    auth_uri: process.env.CYBERNETIC_AUTH_URI,
    token_uri: process.env.CYBERNETIC_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.CYBERNETIC_AUTH_PROVIDER_x509_CERT_URL,
    client_x509_cert_url: process.env.CYBERNETIC_CLIENT_x509_CERT_URL,
    universe_domain: process.env.CYBERNETIC_UNIVERSE_DOMAIN,
};

const storage = new Storage({ projectId, credentials });

// Configure Multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for books/audio
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.epub', '.mp3'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: .png, .jpg, .jpeg, .pdf, .epub, .mp3'), false);
        }
    }
});

async function uploadFileToGCS(file, destinationPath) {
    try {
        const bucket = storage.bucket(bucketName);
        const blob = bucket.file(destinationPath);

        const blobStream = blob.createWriteStream({
            metadata: { contentType: file.mimetype }
        });

        blobStream.end(file.buffer);

        await new Promise((resolve, reject) => {
            blobStream.on('finish', resolve);
            blobStream.on('error', reject);
        });

        // Use the gs:// path or just the destinationPath for internal reference
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
        console.log(`✅ Uploaded: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('❌ Upload Error:', error);
        throw error;
    }
}

async function getSignedUrl(filePath, expiresInMinutes = 60) {
    try {
        // Handle full URLs if passed by mistake
        let path = filePath;
        if (filePath.startsWith('https://storage.googleapis.com/')) {
            const parts = filePath.split('/');
            // https://storage.googleapis.com/bucket-name/path/to/file
            path = parts.slice(4).join('/');
        }

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(path);

        // Generate a signed URL for the file
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });

        return url;
    } catch (error) {
        console.error('❌ Error generating signed URL:', error);
        return null;
    }
}

// Upload Book File (PDF, EPUB, Audio)
bookUploadRouter.post('/file', upload.single('bookFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: true, message: 'No file uploaded' });
        }

        const file = req.file;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const ext = path.extname(file.originalname).toLowerCase();

        let folder = 'books/misc/';
        if (ext === '.pdf') folder = 'books/pdf/';
        else if (ext === '.epub') folder = 'books/epub/';
        else if (ext === '.mp3') folder = 'books/audio/';

        const fileOutputName = `${folder}${Date.now()}_${safeName}`;
        const publicUrl = await uploadFileToGCS(file, fileOutputName);

        res.status(200).json({
            error: false,
            message: 'File uploaded successfully',
            data: {
                url: publicUrl,
                size: file.size,
                mimetype: file.mimetype,
                extension: ext
            }
        });
    } catch (error) {
        console.error('Error uploading book file:', error);
        res.status(500).json({ error: true, message: 'Failed to upload file' });
    }
});

// Upload Cover Image
bookUploadRouter.post('/cover', upload.single('coverImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: true, message: 'No file uploaded' });
        }

        const file = req.file;
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
            return res.status(400).json({ error: true, message: 'Only images allowed for cover' });
        }

        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileOutputName = `books/covers/${Date.now()}_${safeName}`;

        const publicUrl = await uploadFileToGCS(file, fileOutputName);

        res.status(200).json({
            error: false,
            message: 'Cover uploaded successfully',
            data: { url: publicUrl }
        });
    } catch (error) {
        console.error('Error uploading cover:', error);
        res.status(500).json({ error: true, message: 'Failed to upload cover' });
    }
});


function normalizeGcsUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.split('?')[0];
}

module.exports = {
    bookUploadRouter,
    getSignedUrl,
    uploadFileToGCS,
    normalizeGcsUrl
};

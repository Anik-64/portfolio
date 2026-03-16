const express = require('express');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const path = require('path');
const fs = require("fs");
const dotenv = require("dotenv");
const { logAudit } = require('./utils/auditLogger');

dotenv.config();
if (!process.env.PROJECT_ID && fs.existsSync("project.env")) {
    console.log("Default .env not found or missing PROJECT_ID. Loading from project.env...");
    dotenv.config({ path: "project.env" });
}

const profilePicRouter = express.Router();

const projectId = process.env.PROJECT_ID;
// const keyFilename = process.env.KEYFILE_NAME;
const bucketName = process.env.BUCKET_NAME;
const credentials = {
    type: process.env.CYBERNETIC_TYPE,
    project_id: process.env.CYBERNETIC_PROJECT_ID,
    private_key_id: process.env.CYBERNETIC_PRIVATE_KEY_ID,
    private_key: process.env.CYBERNETIC_PRIVATE_KEY?.replace(/\\n/g, "\n"), // fix line breaks
    client_email: process.env.CYBERNETIC_CLIENT_KEY,
    client_id: process.env.CYBERNETIC_CLIENT_ID,
    auth_uri: process.env.CYBERNETIC_AUTH_URI,
    token_uri: process.env.CYBERNETIC_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.CYBERNETIC_AUTH_PROVIDER_x509_CERT_URL,
    client_x509_cert_url: process.env.CYBERNETIC_CLIENT_x509_CERT_URL,
    universe_domain: process.env.CYBERNETIC_UNIVERSE_DOMAIN,
};

const storage = new Storage({ projectId, credentials });

// Configure Multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.mp3'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only .png, .jpg, .jpeg, .pdf and.mp3 files are allowed'), false);
        }
    }
});

async function uploadFileToGCS(file, destinationPath) {
    try {
        const bucket = storage.bucket(bucketName);
        const blob = bucket.file(destinationPath);

        // Create a write stream for uploading the buffer
        const blobStream = blob.createWriteStream({
            metadata: { contentType: file.mimetype }
        });

        // Pipe the file buffer to the GCS blob
        blobStream.end(file.buffer);

        // Wait for upload to finish
        await new Promise((resolve, reject) => {
            blobStream.on('finish', resolve);
            blobStream.on('error', reject);
        });

        // await blob.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
        console.log(`✅ Uploaded & made public: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error('❌ Upload Error:', error);
        throw error;
    }
}

// Endpoint: POST /api/v1/upload/profile-pic
profilePicRouter.post('/profile-pic', upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                error: true, 
                message: 'No file uploaded' 
            });
        }

        const file = req.file;
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'); // sanitize
        const fileOutputName = `user-pic/${Date.now()}_${safeName}`;

        // const ext = path.extname(file.originalname).toLowerCase();
        // let folder = 'user-pic/';
        // if (ext === '.pdf') folder = 'prescriptions/';
        // if (ext === '.mp3') folder = 'voices/';
        // const fileOutputName = `${folder}${Date.now()}_${safeName}`;

        const publicUrl = await uploadFileToGCS(file, fileOutputName);
        
        await logAudit(req.user.userno, 'UPLOAD', 'files', 0, { type: 'profile-pic', url: publicUrl });
        
        res.status(200).json({ 
            error: false, 
            profilepicurl: publicUrl 
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ 
            error: true, 
            message: 'Failed to upload file' 
        });
    }
});

module.exports = profilePicRouter;

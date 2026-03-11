const admin = require('firebase-admin');
require('dotenv').config();

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT from .env. Please ensure it is valid JSON.");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;

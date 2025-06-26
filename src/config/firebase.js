const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // If using a service account key file
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // If using env variables for credentials
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    throw new Error("Firebase credentials are not set.");
  }
}

const db = admin.firestore();

module.exports = { admin, db };


import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// Ensure this environment variable is set with the JSON content of your service account key
const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;

if (!admin.apps.length) {
  if (!serviceAccountKeyJson) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set. Firebase Admin SDK could not be initialized.'
    );
  } else {
    try {
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountKeyJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // If you have a databaseURL (for Realtime Database), you can add it here
        // databaseURL: `https://<YOUR_PROJECT_ID>.firebaseio.com` 
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (error: any) {
      console.error('Firebase Admin SDK initialization error:', error.message);
      // More detailed error logging could be useful here
      // console.error('Full error object:', error);
    }
  }
}

const db = admin.firestore();
const authAdmin = admin.auth(); // For user management if needed later

export { db, authAdmin, admin };

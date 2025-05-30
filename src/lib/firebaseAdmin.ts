
import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// These will be assigned after successful initialization
let db: admin.firestore.Firestore;
let authAdmin: admin.auth.Auth;

// Check if Firebase Admin SDK has already been initialized
if (!admin.apps.length) {
  console.log('Firebase Admin SDK: No apps initialized. Attempting to initialize...');
  const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;

  if (!serviceAccountKeyJson || serviceAccountKeyJson.trim() === '') {
    console.error(
      'CRITICAL SERVER ERROR: FIREBASE_SERVICE_ACCOUNT_KEY_JSON environment variable is not set or is empty. ' +
      'Firebase Admin SDK cannot be initialized. The application will not function correctly with Firestore or Firebase Auth.'
    );
    // db and authAdmin will remain undefined. Accesses will fail.
  } else {
    try {
      console.log('Firebase Admin SDK: Parsing FIREBASE_SERVICE_ACCOUNT_KEY_JSON...');
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountKeyJson);
      console.log('Firebase Admin SDK: Service account parsed successfully. Initializing app...');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK: Initialization successful.');
      // Assign firestore and auth instances only after successful initialization
      db = admin.firestore();
      authAdmin = admin.auth();
      console.log('Firebase Admin SDK: Firestore and Auth services instances created.');
    } catch (error: any) {
      console.error(
        `CRITICAL SERVER ERROR: Firebase Admin SDK initialization failed. Error: ${error.message}. ` +
        'This often happens if FIREBASE_SERVICE_ACCOUNT_KEY_JSON is malformed. Please verify its content and format in your .env file. ' +
        'The application will not function correctly with Firestore or Firebase Auth.',
      );
      // db and authAdmin will remain undefined. Accesses will fail.
    }
  }
} else {
  console.log(`Firebase Admin SDK: Already initialized with ${admin.apps.length} app(s). Using the default app.`);
  // If already initialized, get the default app and its services
  const defaultApp = admin.app();
  db = defaultApp.firestore();
  authAdmin = defaultApp.auth();
  console.log('Firebase Admin SDK: Firestore and Auth services instances retrieved from existing app.');
}

export { db, authAdmin, admin };

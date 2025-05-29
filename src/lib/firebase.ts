
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let firebaseConfig: FirebaseOptions;

try {
  const rawFirebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  // This log will appear in your SERVER terminal when the app starts or a page is server-rendered
  console.log(
    "SERVER LOG: Attempting to parse NEXT_PUBLIC_FIREBASE_CONFIG. Raw value:",
    rawFirebaseConfig
  );

  if (!rawFirebaseConfig) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_CONFIG is not set in .env file. This is required for client-side Firebase initialization."
    );
  }
  firebaseConfig = JSON.parse(rawFirebaseConfig);
} catch (error) {
  // This console.error will appear in your SERVER terminal if parsing fails
  console.error(
    "SERVER LOG: Failed to parse NEXT_PUBLIC_FIREBASE_CONFIG. Ensure it's a valid JSON string in your .env file.",
    "\nRaw value attempted to parse:", process.env.NEXT_PUBLIC_FIREBASE_CONFIG,
    "\nOriginal parsing error:", error
  );
  throw new Error(
    "Firebase configuration error: Could not parse NEXT_PUBLIC_FIREBASE_CONFIG."
  );
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase client app initialized successfully.");
} else {
  app = getApp();
  console.log("Firebase client app already initialized.");
}

const auth = getAuth(app);
const dbClient = getFirestore(app); // Renamed to dbClient to avoid conflict with db from firebaseAdmin

export { app, auth, dbClient };

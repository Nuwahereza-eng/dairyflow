
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let firebaseConfig: FirebaseOptions;

try {
  if (!process.env.NEXT_PUBLIC_FIREBASE_CONFIG) {
    throw new Error("NEXT_PUBLIC_FIREBASE_CONFIG is not set in .env file. This is required for client-side Firebase initialization.");
  }
  firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
} catch (error) {
  console.error("Failed to parse NEXT_PUBLIC_FIREBASE_CONFIG. Ensure it's a valid JSON string in your .env file.", error);
  // Provide a fallback or throw to prevent app from running with misconfigured Firebase
  // For now, let's throw to make the issue obvious during development.
  throw new Error("Firebase configuration error: Could not parse NEXT_PUBLIC_FIREBASE_CONFIG.");
}


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const dbClient = getFirestore(app); // Renamed to dbClient to avoid conflict with db from firebaseAdmin

export { app, auth, dbClient };

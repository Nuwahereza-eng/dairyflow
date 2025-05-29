
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

<<<<<<< HEAD
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

=======
// TypeScript declaration for Vite env variables
interface ImportMetaEnv {
  readonly VITE_GOOGLE_API_KEY: string;
  // add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLc0DpKSMs1ESUHYaqXYU3NmuVY7biRaw",
  authDomain: "dairyconnect-7b93a.firebaseapp.com",
  projectId: "dairyconnect-7b93a",
  storageBucket: "dairyconnect-7b93a.appspot.com", // Corrected from firebasestorage.app to appspot.com
  messagingSenderId: "715517548720",
  appId: "1:715517548720:web:610ce64f0ad61a69508375"
};
>>>>>>> ccee686ab170091e4f10ef1f09501473a51d3141

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

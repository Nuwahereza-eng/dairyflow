
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

let firebaseConfig: FirebaseOptions;

try {
  // This log will appear in your SERVER terminal when the app starts or a page is server-rendered
  // Client-side (browser) will not see this directly unless it's also logged there or passed.
  if (typeof window === 'undefined') { // Log only on server-side during build/SSR
    console.log(
      "SERVER LOG: Attempting to parse NEXT_PUBLIC_FIREBASE_CONFIG. Raw value:",
      process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    );
  }

  const rawFirebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!rawFirebaseConfig) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_CONFIG is not set in .env file. This is required for client-side Firebase initialization."
    );
  }
  firebaseConfig = JSON.parse(rawFirebaseConfig);
} catch (error) {
  // This console.error will appear in your SERVER terminal if parsing fails
  if (typeof window === 'undefined') { // Log error details only on server-side
    console.error(
      "SERVER LOG: Failed to parse NEXT_PUBLIC_FIREBASE_CONFIG. Ensure it's a valid JSON string in your .env file.",
      "\nRaw value attempted to parse:", process.env.NEXT_PUBLIC_FIREBASE_CONFIG,
      "\nOriginal parsing error:", error
    );
  }
  // Throw a generic error to the client or for server-side build to catch
  throw new Error(
    "Firebase configuration error: Could not parse NEXT_PUBLIC_FIREBASE_CONFIG."
  );
}

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  if (typeof window !== 'undefined') { // Log only on client-side
      console.log("Firebase client app initialized successfully.");
  } else {
      console.log("Firebase client app initialized successfully (server context).");
  }
} else {
  app = getApp();
   if (typeof window !== 'undefined') { // Log only on client-side
      console.log("Firebase client app already initialized.");
  } else {
      console.log("Firebase client app already initialized (server context).");
  }
}

const auth = getAuth(app);
const dbClient = getFirestore(app); // Renamed to dbClient to avoid conflict with db from firebaseAdmin

export { app, auth, dbClient };

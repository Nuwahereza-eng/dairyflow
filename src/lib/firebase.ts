// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

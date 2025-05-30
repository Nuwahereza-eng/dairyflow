
import { config } from 'dotenv';
config(); // Ensure environment variables are loaded first

// Ensure Firebase Admin SDK is initialized (it's used by flows if they interact with Firebase directly,
// or by any direct admin operations in this dev script).
// The actual initialization logic is within firebaseAdmin.ts which is implicitly loaded if authAdmin is used.
// For clarity, if you were to perform operations here directly:
// import { authAdmin } from '@/lib/firebaseAdmin'; 

// Import your Genkit flows so they are registered with the Genkit system
import '@/ai/flows/sms-notifications.ts';
import '@/ai/flows/payment-notification.ts';

// The temporary script for setting custom claims has been removed
// as it should have been run once successfully.
// If you need to set claims again for another user, you can re-add a similar script temporarily.

console.log("Genkit dev server configured. Imported flows should be registered.");
console.log("Ensure your .env file is correctly populated with API keys (GOOGLE_API_KEY, TWILIO_*, FIREBASE_SERVICE_ACCOUNT_KEY_JSON, NEXT_PUBLIC_FIREBASE_CONFIG).");


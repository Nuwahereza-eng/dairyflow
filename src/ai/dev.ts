
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

// --- TEMPORARY SCRIPT TO SET CUSTOM CLAIM ---
// IMPORTANT:
// 1. Replace 'A54rWWPfcVhDwcDekfznY55m1dr1' below with the actual User UID of the user you want to make an admin (e.g., peter@admin.dairyflow.com).
// 2. Ensure your FIREBASE_SERVICE_ACCOUNT_KEY_JSON is correctly set in your .env file.
// 3. Run `npm run genkit:dev` (or `npm run genkit:watch`) ONCE.
// 4. Check the console output for success.
// 5. After successful execution, REMOVE OR COMMENT OUT this entire script block.
// (async () => {
//   const userUID = '0iM3zNNoSfZQNSmE9MQuPfp8B8x1'; // <--- !!! PASTE THE UID OF THE USER HERE (e.g., peter@admin.dairyflow.com's UID) !!!
//   const desiredRole = 'admin';

  // if (userUID === '0iM3zNNoSfZQNSmE9MQuPfp8B8x1') { // Check against the specific placeholder
  //   console.warn(
  //     '\n[Custom Claim Script] SKIPPING: Please replace "0iM3zNNoSfZQNSmE9MQuPfp8B8x1" in src/ai/dev.ts with the actual User UID you want to make an admin.\n'
  //   );
  //   return;
  // }

//   if (!authAdmin) {
//     console.error(
//       '[Custom Claim Script] Firebase Admin SDK (authAdmin) is not available. ' +
//       'This might be because `firebaseAdmin.ts` had an issue during initialization ' +
//       '(e.g., FIREBASE_SERVICE_ACCOUNT_KEY_JSON missing or invalid in .env). ' +
//       'The script cannot run.'
//     );
//     return;
//   }

//   try {
//     console.log(`[Custom Claim Script] Attempting to set role '${desiredRole}' for user UID: ${userUID}`);
//     await authAdmin.setCustomUserClaims(userUID, { role: desiredRole });
//     console.log(`[Custom Claim Script] Successfully set role '${desiredRole}' for user UID: ${userUID}`);
//     console.log(`[Custom Claim Script] You should now REMOVE or COMMENT OUT this script from src/ai/dev.ts.`);
//   } catch (error) {
//     console.error(`[Custom Claim Script] Error setting custom claim for UID ${userUID}:`, error);
//   }
// })();

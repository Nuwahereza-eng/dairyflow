

import { config } from 'dotenv';
config(); // Ensure environment variables are loaded first

import { authAdmin } from '@/lib/firebaseAdmin';
import '@/ai/flows/sms-notifications.ts';
import '@/ai/flows/payment-notification.ts';

// --- TEMPORARY SCRIPT TO SET CUSTOM CLAIM ---
// IMPORTANT:
// 1. Replace 'USER_UID_TO_SET_ADMIN_CLAIM' below with the actual User UID of peter@admin.dairyflow.com.
// 2. Ensure your FIREBASE_SERVICE_ACCOUNT_KEY_JSON is correctly set in your .env file.
// 3. Run `npm run genkit:dev` (or `npm run genkit:watch`) ONCE.
// 4. Check the console output for success.
// 5. After successful execution, REMOVE OR COMMENT OUT this entire script block.
(async () => {
  const userUID = 'A54rWWPfcVhDwcDekfznY55m1dr1'; // <--- !!! PASTE THE UID HERE !!!
  const desiredRole = 'admin';

  if (userUID === 'A54rWWPfcVhDwcDekfznY55m1dr1') {
    console.warn(
      '\n[Custom Claim Script] SKIPPING: Please replace "USER_UID_TO_SET_ADMIN_CLAIM" in src/ai/dev.ts with the actual User UID.\n'
    );
    return;
  }

  if (!authAdmin) {
    console.error(
      '[Custom Claim Script] Firebase Admin SDK (authAdmin) is not available. ' +
      'This might be because `firebaseAdmin.ts` had an issue during initialization ' +
      '(e.g., FIREBASE_SERVICE_ACCOUNT_KEY_JSON missing or invalid in .env). ' +
      'The script cannot run.'
    );
    return;
  }

  try {
    console.log(`[Custom Claim Script] Attempting to set role '${desiredRole}' for user UID: ${userUID}`);
    await authAdmin.setCustomUserClaims(userUID, { role: desiredRole });
    console.log(`[Custom Claim Script] Successfully set role '${desiredRole}' for user UID: ${userUID}`);
    console.log(`[Custom Claim Script] You should now REMOVE or COMMENT OUT this script from src/ai/dev.ts.`);
  } catch (error) {
    console.error(`[Custom Claim Script] Error setting custom claim for UID ${userUID}:`, error);
  }
})();

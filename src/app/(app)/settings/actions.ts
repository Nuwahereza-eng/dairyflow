
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SystemSettings, User, UserRole } from "@/types";
import { ADMIN_EMAIL_DOMAIN, OPERATOR_EMAIL_DOMAIN } from "@/types";
import { db, authAdmin } from "@/lib/firebaseAdmin";
import { initialSystemSettings } from "@/lib/mockData";

const SETTINGS_COLLECTION = "system_config";
const SETTINGS_DOC_ID = "main";

const systemSettingsSchema = z.object({
  milkPricePerLiter: z.coerce.number().min(0, "Milk price must be non-negative"),
  smsProvider: z.enum(["africas_talking", "twilio", "none"]),
  smsApiKey: z.string().optional().default(''),
  smsUsername: z.string().optional().default(''),
});

const appUserSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .refine(s => !s.includes('@'), { message: "Username cannot contain '@' symbol. It's used for system emails." }),
  role: z.enum(["operator", "admin"], { required_error: "Role is required" }),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  status: z.enum(["active", "inactive"]),
});


export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const settingsDocRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    const settingsDoc = await settingsDocRef.get();

    if (settingsDoc.exists) {
      console.log("Fetched system settings from Firestore.");
      return settingsDoc.data() as SystemSettings;
    } else {
      console.log("No system settings found in Firestore. Creating with defaults and returning them.");
      const defaultsToSave: SystemSettings = {
        milkPricePerLiter: initialSystemSettings.milkPricePerLiter,
        smsProvider: initialSystemSettings.smsProvider,
        smsApiKey: initialSystemSettings.smsApiKey || '',
        smsUsername: initialSystemSettings.smsUsername || '',
      };
      await settingsDocRef.set(defaultsToSave);
      console.log("Default system settings saved to Firestore.");
      return defaultsToSave;
    }
  } catch (error) {
    console.error("Error fetching or creating system settings:", error);
    console.warn("Falling back to initialSystemSettings due to Firestore error.");
    return { ...initialSystemSettings };
  }
}

export async function saveSystemSettingsAction(data: Partial<SystemSettings>) {
  const validatedData = systemSettingsSchema.partial().safeParse(data);
  if (!validatedData.success) {
    console.error("System settings validation failed:", validatedData.error.flatten().fieldErrors);
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    const settingsDocRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    await settingsDocRef.set(validatedData.data, { merge: true });
    console.log("System settings saved successfully to Firestore:", validatedData.data);

    revalidatePath("/settings");

    const updatedSettingsDoc = await settingsDocRef.get();
    if (updatedSettingsDoc.exists) { // Corrected: .exists is a property, not a function
      return { success: true, settings: updatedSettingsDoc.data() as SystemSettings };
    }
    console.warn("Updated settings document not found immediately after save. This is unexpected.");
    return { success: true, settings: { ...initialSystemSettings, ...validatedData.data } };

  } catch (error: any) {
    console.error("Error saving system settings to Firestore:", error);
    return { success: false, errors: { _form: ["Failed to save settings to database."] }, message: error.message };
  }
}

export async function getUsers(): Promise<Omit<User, 'password'>[]> {
  try {
    const listUsersResult = await authAdmin.listUsers(1000);
    const appUsers: Omit<User, 'password'>[] = [];

    for (const userRecord of listUsersResult.users) {
      const role = userRecord.customClaims?.role as UserRole;
      if (role === 'admin' || role === 'operator') {
        let plainUsername = userRecord.displayName || userRecord.uid;
        if (userRecord.email) {
            if (role === 'admin' && userRecord.email.endsWith(ADMIN_EMAIL_DOMAIN)) {
                plainUsername = userRecord.email.replace(ADMIN_EMAIL_DOMAIN, '');
            } else if (role === 'operator' && userRecord.email.endsWith(OPERATOR_EMAIL_DOMAIN)) {
                plainUsername = userRecord.email.replace(OPERATOR_EMAIL_DOMAIN, '');
            }
        }
        appUsers.push({
          id: userRecord.uid,
          username: plainUsername,
          email: userRecord.email,
          role: role,
          status: userRecord.disabled ? 'inactive' : 'active',
        });
      }
    }
    appUsers.sort((a, b) => a.username.localeCompare(b.username));
    return appUsers;
  } catch (error) {
    console.error("Error fetching app users from Firebase Auth:", error);
    return [];
  }
}

export async function addUserAction(data: Omit<User, 'id'>) {
  const newUserSchema = appUserSchema.extend({
    password: z.string().min(6, "Password must be at least 6 characters."),
  }).refine(s => !s.username.includes('@'), {
    message: "Username cannot contain '@' symbol.",
    path: ["username"],
  });
  const validatedData = newUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const { username, role, password, status } = validatedData.data;
  const emailDomain = role === 'admin' ? ADMIN_EMAIL_DOMAIN : OPERATOR_EMAIL_DOMAIN;
  const emailForFirebase = username.trim() + emailDomain;
  const defaultPassword = password; // Password now comes from the form

  try {
    console.log(`Attempting to create Firebase Auth user for ${role}. Pseudo-email: ${emailForFirebase}`);
    const userRecord = await authAdmin.createUser({
      email: emailForFirebase,
      password: defaultPassword,
      displayName: username,
      disabled: status === 'inactive',
      emailVerified: true, // Consider if email verification is needed/meaningful for pseudo-emails
    });

    await authAdmin.setCustomUserClaims(userRecord.uid, { role });
    console.log(
      `Firebase Auth user ${username} (UID: ${userRecord.uid}) created with pseudo-email: ${emailForFirebase}, role: ${role}. Default password set was: ${defaultPassword}`
    );

    revalidatePath("/settings");
    return {
      success: true,
      user: {
        id: userRecord.uid,
        username: username,
        email: emailForFirebase,
        role,
        status
      }
    };
  } catch (error: any) {
    console.error("Error adding app user to Firebase Auth:", error);
    if (error.code === 'auth/email-already-exists') {
      return { success: false, errors: { username: ["A user with this username (derived email) already exists."] } };
    }
    if (error.code === 'auth/invalid-email') {
       return { success: false, errors: { username: ["The constructed email for Firebase Auth is invalid. Ensure username is simple."] } };
    }
    return { success: false, errors: { _form: [`Firebase Auth user creation failed: ${error.message}`] } };
  }
}

export async function updateUserAction(id: string, data: Partial<Omit<User, 'id' | 'password'>>) {
  const partialUserSchema = appUserSchema.pick({username: true, role: true, status: true}).partial();
  const validatedData = partialUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const { username, role, status } = validatedData.data;

  try {
    const updates: any = {};
    const currentUserRecord = await authAdmin.getUser(id);

    if (username && username !== currentUserRecord.displayName) {
      updates.displayName = username;
      const currentRole = currentUserRecord.customClaims?.role as UserRole;
      let newEmail = currentUserRecord.email; 

      if (currentRole === 'admin' && currentUserRecord.email?.endsWith(ADMIN_EMAIL_DOMAIN)) {
        newEmail = username + ADMIN_EMAIL_DOMAIN;
      } else if (currentRole === 'operator' && currentUserRecord.email?.endsWith(OPERATOR_EMAIL_DOMAIN)) {
        newEmail = username + OPERATOR_EMAIL_DOMAIN;
      }
      
      if (newEmail && newEmail !== currentUserRecord.email) {
        updates.email = newEmail;
      }
    }
    if (status) updates.disabled = status === 'inactive';

    if(Object.keys(updates).length > 0) {
        await authAdmin.updateUser(id, updates);
        console.log(`Firebase Auth user ${id} updated with:`, updates);
    }


    if (role && role !== currentUserRecord.customClaims?.role) {
      await authAdmin.setCustomUserClaims(id, { role });
       console.log(`Firebase Auth user ${id} custom claims updated to role: ${role}`);
    }

    const updatedUserRecord = await authAdmin.getUser(id);
    let updatedPlainUsername = updatedUserRecord.displayName || updatedUserRecord.uid;
    if (updatedUserRecord.email) {
        const userActualRole = updatedUserRecord.customClaims?.role as UserRole;
        if (userActualRole === 'admin' && updatedUserRecord.email.endsWith(ADMIN_EMAIL_DOMAIN)) {
            updatedPlainUsername = updatedUserRecord.email.replace(ADMIN_EMAIL_DOMAIN, '');
        } else if (userActualRole === 'operator' && updatedUserRecord.email.endsWith(OPERATOR_EMAIL_DOMAIN)) {
            updatedPlainUsername = updatedUserRecord.email.replace(OPERATOR_EMAIL_DOMAIN, '');
        }
    }


    revalidatePath("/settings");
    return {
      success: true,
      user: {
        id: updatedUserRecord.uid,
        username: updatedPlainUsername!,
        email: updatedUserRecord.email,
        role: (updatedUserRecord.customClaims?.role as UserRole) || role,
        status: updatedUserRecord.disabled ? 'inactive' : 'active'
      }
    };
  } catch (error: any) {
    console.error("Error updating app user in Firebase Auth:", error);
     if (error.code === 'auth/user-not-found') {
        return { success: false, errors: { _form: ["User not found in Firebase Auth."] } };
    }
    if (error.code === 'auth/email-already-exists') {
        return { success: false, errors: { username: ["A user with the new username (derived email) already exists."] } };
    }
    return { success: false, errors: { _form: [`Firebase Auth user update failed: ${error.message}`] } };
  }
}


export async function deleteUserAction(id: string) {
  try {
    await authAdmin.deleteUser(id);
    console.log(`Firebase Auth user UID: ${id} deleted successfully.`);
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting app user from Firebase Auth:", error);
    if (error.code === 'auth/user-not-found') {
        return { success: false, errors: { _form: ["User not found in Firebase Auth."] } };
    }
    return { success: false, errors: { _form: [`Firebase Auth user deletion failed: ${error.message}`] } };
  }
}

export async function updateUserPasswordAction(id: string, newPassword: string) {
  if (newPassword.length < 6) {
    return { success: false, message: "Password must be at least 6 characters." };
  }
  try {
    await authAdmin.updateUser(id, { password: newPassword });
    revalidatePath("/settings"); // Not strictly necessary for password but good for consistency
    return { success: true, message: "Password updated successfully for user." };
  } catch (error: any) {
    console.error("Error updating user password in Firebase Auth:", error);
     if (error.code === 'auth/user-not-found') {
        return { success: false, message: "User not found for password update." };
    }
    return { success: false, message: `Password update failed: ${error.message}` };
  }
}




"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SystemSettings, User, UserRole } from "@/types";
import { ADMIN_EMAIL_DOMAIN, OPERATOR_EMAIL_DOMAIN } from "@/types";
import { db, authAdmin } from "@/lib/firebaseAdmin";
import { initialSystemSettings } from "@/lib/mockData"; // Keep for default settings

const SETTINGS_COLLECTION = "system_config";
const SETTINGS_DOC_ID = "main"; 

const systemSettingsSchema = z.object({
  milkPricePerLiter: z.coerce.number().min(0, "Milk price must be non-negative"),
  smsProvider: z.enum(["africas_talking", "twilio", "none"]),
  smsApiKey: z.string().optional().default(''),
  smsUsername: z.string().optional().default(''),
});

// Schema for adding/editing Admin/Operator users
const appUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  role: z.enum(["operator", "admin"], { required_error: "Role is required" }),
  password: z.string().min(6, "Password must be at least 6 characters").optional(), // Required for new, optional for edit
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
    return initialSystemSettings;
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
    if (updatedSettingsDoc.exists) {
      return { success: true, settings: updatedSettingsDoc.data() as SystemSettings };
    }
    console.warn("Updated settings document not found immediately after save. This is unexpected.");
    return { success: true, settings: { ...initialSystemSettings, ...validatedData.data } };

  } catch (error: any) {
    console.error("Error saving system settings to Firestore:", error);
    return { success: false, errors: { _form: ["Failed to save settings to database."] }, message: error.message };
  }
}

// User management functions now interact with Firebase Auth
export async function getUsers(): Promise<Omit<User, 'password'>[]> {
  try {
    const listUsersResult = await authAdmin.listUsers(1000); // Max 1000 users per page
    const appUsers: Omit<User, 'password'>[] = [];
    
    for (const userRecord of listUsersResult.users) {
      const role = userRecord.customClaims?.role as UserRole;
      if (role === 'admin' || role === 'operator') {
        const plainUsername = userRecord.email?.split('@')[0] || userRecord.displayName || userRecord.uid;
        appUsers.push({
          id: userRecord.uid,
          username: plainUsername,
          email: userRecord.email,
          role: role,
          status: userRecord.disabled ? 'inactive' : 'active',
        });
      }
    }
    // Sort users by username for consistent display
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
  });
  const validatedData = newUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const { username, role, password, status } = validatedData.data;
  const emailDomain = role === 'admin' ? ADMIN_EMAIL_DOMAIN : OPERATOR_EMAIL_DOMAIN;
  const emailForFirebase = username.trim() + emailDomain;
  const defaultPassword = password; // Password comes from form

  try {
    console.log(`Attempting to create Firebase Auth user. Pseudo-email: ${emailForFirebase}`);
    const userRecord = await authAdmin.createUser({
      email: emailForFirebase,
      password: defaultPassword,
      displayName: username,
      disabled: status === 'inactive',
      emailVerified: true, // Assuming admin/op emails are "verified" in this context
    });

    await authAdmin.setCustomUserClaims(userRecord.uid, { role });
    console.log(`Firebase Auth user ${username} (UID: ${userRecord.uid}) created with role ${role}.`);

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
      return { success: false, errors: { username: ["A user with this username (or derived email) already exists."] } };
    }
    return { success: false, errors: { _form: [`Firebase Auth user creation failed: ${error.message}`] } };
  }
}

export async function updateUserAction(id: string, data: Partial<Omit<User, 'id' | 'password'>>) {
  const partialUserSchema = appUserSchema.omit({ password: true }); // Password update is separate
  const validatedData = partialUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const { username, role, status } = validatedData.data;

  try {
    const updates: any = {};
    if (username) updates.displayName = username;
    if (status) updates.disabled = status === 'inactive';
    // Note: Changing email (derived from username) is complex and not handled here.
    // If username changes, it should ideally trigger an email update if they are linked.
    // For now, we assume username only changes displayName.

    await authAdmin.updateUser(id, updates);

    if (role) {
      await authAdmin.setCustomUserClaims(id, { role });
    }
    
    const updatedUserRecord = await authAdmin.getUser(id);
    const updatedPlainUsername = updatedUserRecord.email?.split('@')[0] || updatedUserRecord.displayName || updatedUserRecord.uid;


    revalidatePath("/settings");
    return { 
      success: true, 
      user: { 
        id: updatedUserRecord.uid, 
        username: updatedPlainUsername, 
        email: updatedUserRecord.email,
        role: (updatedUserRecord.customClaims?.role as UserRole) || role, // Use new role if provided
        status: updatedUserRecord.disabled ? 'inactive' : 'active' 
      } 
    };
  } catch (error: any) {
    console.error("Error updating app user in Firebase Auth:", error);
     if (error.code === 'auth/user-not-found') {
        return { success: false, errors: { _form: ["User not found in Firebase Auth."] } };
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
    revalidatePath("/settings"); 
    return { success: true, message: "Password updated successfully for user." };
  } catch (error: any) {
    console.error("Error updating user password in Firebase Auth:", error);
    return { success: false, message: `Password update failed: ${error.message}` };
  }
}

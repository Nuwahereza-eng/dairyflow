
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SystemSettings, User, UserRole } from "@/types";
import { db } from "@/lib/firebaseAdmin";
import { initialSystemSettings, initialUsers } from "@/lib/mockData"; // Keep initialUsers for now

// For demo, user management remains in-memory for now.
let usersStore: User[] = [...initialUsers];

const SETTINGS_COLLECTION = "system_config";
const SETTINGS_DOC_ID = "main";

const systemSettingsSchema = z.object({
  milkPricePerLiter: z.coerce.number().min(0, "Milk price must be non-negative"),
  smsProvider: z.enum(["africas_talking", "twilio", "none"]),
  smsApiKey: z.string().optional().default(''), // Provide default for optional to align with Firestore
  smsUsername: z.string().optional().default(''),// Provide default for optional
});

const userSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
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
      console.log("No system settings found in Firestore. Creating with defaults.");
      // If document doesn't exist, create it with initial/default settings
      // Ensure initialSystemSettings has all fields or defaults for optional ones.
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
    // Fallback to in-memory defaults if Firestore fails critically
    return initialSystemSettings;
  }
}

export async function saveSystemSettingsAction(data: Partial<SystemSettings>) {
  // Use partial schema for updates, as not all fields might be sent
  const validatedData = systemSettingsSchema.partial().safeParse(data);
  if (!validatedData.success) {
    console.error("System settings validation failed:", validatedData.error.flatten().fieldErrors);
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }
  
  try {
    const settingsDocRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    // Use set with merge: true to create if not exists or update existing
    await settingsDocRef.set(validatedData.data, { merge: true }); 
    console.log("System settings saved successfully to Firestore:", validatedData.data);
    
    revalidatePath("/settings");
    // Fetch the updated settings to return
    const updatedSettingsDoc = await settingsDocRef.get();
    if (updatedSettingsDoc.exists()) {
      return { success: true, settings: updatedSettingsDoc.data() as SystemSettings };
    }
    // Should not happen if set was successful, but as a fallback
    return { success: true, settings: { ...initialSystemSettings, ...validatedData.data } };

  } catch (error) {
    console.error("Error saving system settings to Firestore:", error);
    return { success: false, errors: { _form: ["Failed to save settings to database."] } };
  }
}


// User management functions remain in-memory for now
export async function getUsers(): Promise<Omit<User, 'password'>[]> {
  return JSON.parse(JSON.stringify(usersStore.map(({ password, ...user }) => user)));
}

export async function addUserAction(data: Omit<User, 'id'>) {
  const newUserSchema = userSchema.extend({
    password: z.string().min(6, "Password must be at least 6 characters"),
  }).omit({ id: true });

  const validatedData = newUserSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  if (usersStore.some(u => u.username === validatedData.data.username)) {
    return { success: false, errors: { username: ["Username already exists."] } };
  }

  const newUser: User = {
    ...validatedData.data,
    id: (usersStore.length + 1 + Math.random()).toString(), // Simple ID
  };
  usersStore.push(newUser);
  
  revalidatePath("/settings");
  const { password, ...userToReturn } = newUser;
  return { success: true, user: userToReturn };
}

export async function updateUserAction(id: string, data: Partial<Omit<User, 'id' | 'password'>>) {
   const userIndex = usersStore.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return { success: false, errors: { _form: ["User not found"] } };
  }
  
  const partialUserSchema = userSchema.partial().omit({id: true, password: true});
  const validatedData = partialUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }
  
  if (validatedData.data.username && validatedData.data.username !== usersStore[userIndex].username && usersStore.some(u => u.username === validatedData.data.username)) {
      return { success: false, errors: { username: ["Username already exists."] } };
  }

  usersStore[userIndex] = { ...usersStore[userIndex], ...validatedData.data };
  const { password, ...updatedUserNoPass } = usersStore[userIndex];
  
  revalidatePath("/settings");
  return { success: true, user: updatedUserNoPass };
}


export async function deleteUserAction(id: string) {
  const initialLength = usersStore.length;
  usersStore = usersStore.filter(u => u.id !== id);

  if (usersStore.length === initialLength) {
     return { success: false, errors: { _form: ["User not found or already deleted"] } };
  }
  
  revalidatePath("/settings");
  return { success: true };
}

export async function updateUserPasswordAction(id: string, newPassword: string) {
  const userIndex = usersStore.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return { success: false, message: "User not found." };
  }
  if (newPassword.length < 6) {
    return { success: false, message: "Password must be at least 6 characters." };
  }
  
  usersStore[userIndex].password = newPassword;
  
  revalidatePath("/settings"); 
  return { success: true, message: "Password updated successfully." };
}

    
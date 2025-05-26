"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SystemSettings, User, UserRole } from "@/types";
import { initialSystemSettings, initialUsers } from "@/lib/mockData";

// For demo, mutate in-memory stores.
let systemSettingsStore: SystemSettings = { ...initialSystemSettings };
let usersStore: User[] = [...initialUsers];

const systemSettingsSchema = z.object({
  milkPricePerLiter: z.coerce.number().min(0, "Milk price must be non-negative"),
  smsProvider: z.enum(["africas_talking", "twilio", "none"]),
  smsApiKey: z.string().optional(), // Keep optional, user might not want to update if already set
  smsUsername: z.string().optional(),
});

const userSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  role: z.enum(["operator", "admin"], { required_error: "Role is required" }),
  password: z.string().min(6, "Password must be at least 6 characters").optional(), // Optional for updates if not changing
  status: z.enum(["active", "inactive"]),
});


export async function getSystemSettings(): Promise<SystemSettings> {
  // Omit sensitive fields like API key when sending to client if necessary,
  // but for a settings form, they need to be editable (though perhaps masked).
  return JSON.parse(JSON.stringify(systemSettingsStore));
}

export async function saveSystemSettingsAction(data: SystemSettings) {
  const validatedData = systemSettingsSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }
  
  systemSettingsStore = { ...systemSettingsStore, ...validatedData.data };
  // In real app: ensure API keys are stored securely, not just revalidated.
  // Here we update the whole object.
  
  revalidatePath("/settings");
  return { success: true, settings: systemSettingsStore };
}


export async function getUsers(): Promise<Omit<User, 'password'>[]> {
  return JSON.parse(JSON.stringify(usersStore.map(({ password, ...user }) => user)));
}

export async function addUserAction(data: Omit<User, 'id'>) {
  // Ensure password is provided for new users
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
    id: (usersStore.length + 1).toString(), // Simple ID
    // password: hashedPassword, // In real app, hash password
  };
  usersStore.push(newUser);
  
  revalidatePath("/settings");
  return { success: true, user: {username: newUser.username, role: newUser.role, status: newUser.status, id: newUser.id } };
}

export async function updateUserAction(id: string, data: Partial<Omit<User, 'id' | 'password'>>) {
   const userIndex = usersStore.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return { success: false, errors: { _form: ["User not found"] } };
  }
  
  const partialUserSchema = userSchema.partial().omit({id: true, password: true}); // Don't validate/update password here
  const validatedData = partialUserSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }
  
  // Prevent username change for simplicity or ensure uniqueness if allowed
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

// Action to update a user's password (example, keep separate for security)
export async function updateUserPasswordAction(id: string, newPassword: string) {
  const userIndex = usersStore.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return { success: false, message: "User not found." };
  }
  if (newPassword.length < 6) {
    return { success: false, message: "Password must be at least 6 characters." };
  }
  
  // In real app: usersStore[userIndex].password = await hashPassword(newPassword);
  usersStore[userIndex].password = newPassword; // Storing plain text for demo
  
  revalidatePath("/settings"); // Might not be needed if not displayed
  return { success: true, message: "Password updated successfully." };
}

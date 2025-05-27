
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin"; // Import Firestore instance

const farmerSchema = z.object({
  id: z.string().optional(), // Firestore generates IDs, so this will be mainly for updates/reads
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format (e.g., +256701234567)."),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional(),
  notes: z.string().optional(),
  joinDate: z.string(), // Keep as string for Firestore, can be converted to Date object if needed
});

// Schema for adding, as joinDate will be auto-generated if not provided by client
const addFarmerServerSchema = farmerSchema.omit({ id: true }).extend({
  joinDate: z.string().optional(), // Make it optional here so server can default it
});

// Schema for updating, joinDate is usually not updated this way
const updateFarmerServerSchema = farmerSchema.partial().omit({ id: true, joinDate: true });


export async function getFarmers(): Promise<Farmer[]> {
  try {
    const farmersSnapshot = await db.collection("farmers").orderBy("name").get();
    const farmers: Farmer[] = [];
    farmersSnapshot.forEach((doc) => {
      farmers.push({ id: doc.id, ...doc.data() } as Farmer);
    });
    return farmers;
  } catch (error) {
    console.error("Error fetching farmers:", error);
    return []; // Or throw error
  }
}

export async function addFarmerAction(data: Omit<Farmer, 'id' | 'joinDate'> & { joinDate?: string }) {
  const farmerDataWithDefaultJoinDate = {
    ...data,
    joinDate: data.joinDate || new Date().toISOString().split("T")[0],
  };
  
  // Use the base farmerSchema (which includes joinDate as required string) for final validation before saving
  const validatedData = farmerSchema.omit({id: true}).safeParse(farmerDataWithDefaultJoinDate);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    const farmerRef = await db.collection("farmers").add(validatedData.data);
    const newFarmer: Farmer = { id: farmerRef.id, ...validatedData.data };

    console.log(`Simulated SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your Farmer ID is CF${newFarmer.id.substring(0,5).toUpperCase()}.`);

    revalidatePath("/farmers");
    return { success: true, farmer: newFarmer };
  } catch (error) {
    console.error("Error adding farmer:", error);
    return { success: false, errors: { _form: ["Failed to add farmer to database."] } };
  }
}

export async function updateFarmerAction(id: string, data: Partial<Omit<Farmer, 'id' | 'joinDate'>>) {
  if (!id) {
    return { success: false, errors: { _form: ["Farmer ID is required for update."] } };
  }
  
  const validatedData = updateFarmerServerSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    await db.collection("farmers").doc(id).update(validatedData.data);
    const updatedFarmerDoc = await db.collection("farmers").doc(id).get();
    const updatedFarmer = { id: updatedFarmerDoc.id, ...updatedFarmerDoc.data() } as Farmer;
    
    revalidatePath("/farmers");
    return { success: true, farmer: updatedFarmer };
  } catch (error) {
    console.error("Error updating farmer:", error);
    return { success: false, errors: { _form: ["Failed to update farmer in database."] } };
  }
}

export async function deleteFarmerAction(id: string) {
  if (!id) {
    return { success: false, errors: { _form: ["Farmer ID is required for deletion."] } };
  }
  try {
    const farmerDoc = await db.collection("farmers").doc(id).get();
    if (!farmerDoc.exists) {
      return { success: false, errors: { _form: ["Farmer not found."] } };
    }

    await db.collection("farmers").doc(id).delete();
    
    revalidatePath("/farmers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting farmer:", error);
    return { success: false, errors: { _form: ["Failed to delete farmer from database."] } };
  }
}

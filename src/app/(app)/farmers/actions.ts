
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { db, authAdmin } from "@/lib/firebaseAdmin"; // Import Firestore and Firebase Admin Auth

// Stricter phone validation for E.164
const farmerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format (e.g., +256701234567)."),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional().default(''), // Ensure default is empty string if not provided
  notes: z.string().optional().default(''),    // Ensure default is empty string if not provided
  joinDate: z.string(), 
});

const addFarmerServerSchema = farmerSchema.omit({ id: true }).extend({
  joinDate: z.string().optional(), 
});

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
    return []; 
  }
}

export async function addFarmerAction(data: Omit<Farmer, 'id' | 'joinDate'> & { joinDate?: string }) {
  const farmerDataWithDefaultJoinDate = {
    ...data,
    joinDate: data.joinDate || new Date().toISOString().split("T")[0],
    idNumber: data.idNumber || '', // Ensure optional fields are empty strings if not provided
    notes: data.notes || '',       // Ensure optional fields are empty strings if not provided
  };
  
  const validatedData = farmerSchema.omit({id: true}).safeParse(farmerDataWithDefaultJoinDate);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    // Check if farmer with this phone number already exists in Firestore (optional, good practice)
    const existingFarmerQuery = await db.collection("farmers").where("phone", "==", validatedData.data.phone).limit(1).get();
    if (!existingFarmerQuery.empty) {
      return { success: false, errors: { phone: ["A farmer with this phone number already exists."] } };
    }

    const farmerRef = await db.collection("farmers").add(validatedData.data);
    const newFarmer: Farmer = { id: farmerRef.id, ...validatedData.data };

    // Create Firebase Auth user for the farmer
    const defaultPassword = "Dairy!2345"; // Not secure for production
    try {
      await authAdmin.createUser({
        email: newFarmer.phone, // Using phone as email for Firebase Auth
        password: defaultPassword,
        displayName: newFarmer.name,
        emailVerified: true, // Assuming phone as email is effectively "verified" in this context
        // You could disable the account initially if you want a separate activation step
        // disabled: false, 
      });
      console.log(`Firebase Auth user created for ${newFarmer.name} with email/phone: ${newFarmer.phone}`);
      // For a real app, you would need a secure way to communicate the default password or a password reset link.
      // For this demo, we might simulate an SMS or just log it.
      console.log(`Simulated Welcome SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your Farmer ID is CF${newFarmer.id.substring(0,5).toUpperCase()}. You can login with your phone number and the default password: ${defaultPassword}`);
    } catch (authError: any) {
      console.error("Firebase Auth user creation failed for farmer:", newFarmer.phone, authError);
      // If Auth user creation fails, should we roll back Firestore farmer creation?
      // For simplicity now, we'll log the error and proceed with the farmer created in Firestore.
      // In production, you'd want a more robust transaction or cleanup.
      // We can add a specific error message to the form if needed.
      // For now, let's return a partial success with a warning if auth creation fails
       return { 
        success: true, // Farmer added to DB
        farmer: newFarmer, 
        warning: `Farmer ${newFarmer.name} added to database, but Firebase Auth user creation failed: ${authError.message}. Please create their login manually or retry.` 
      };
    }
    
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
  
  // Ensure optional fields are handled correctly (e.g. to allow clearing them)
  const dataForValidation = {
    ...data,
    idNumber: data.idNumber === undefined ? undefined : (data.idNumber || ''),
    notes: data.notes === undefined ? undefined : (data.notes || ''),
  };
  const validatedData = updateFarmerServerSchema.safeParse(dataForValidation);


  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    const farmerDocRef = db.collection("farmers").doc(id);
    const currentFarmerDoc = await farmerDocRef.get();
    if (!currentFarmerDoc.exists) {
        return { success: false, errors: { _form: ["Farmer not found."] } };
    }
    const currentFarmerData = currentFarmerDoc.data() as Farmer;

    await farmerDocRef.update(validatedData.data);
    
    // If phone number changed, update Firebase Auth email
    if (validatedData.data.phone && validatedData.data.phone !== currentFarmerData.phone) {
        try {
            const user = await authAdmin.getUserByEmail(currentFarmerData.phone); // Get user by old phone/email
            await authAdmin.updateUser(user.uid, { email: validatedData.data.phone });
            console.log(`Updated Firebase Auth email for farmer ${id} to ${validatedData.data.phone}`);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth email for farmer ${id}:`, authError);
            // Non-critical error for the farmer update itself, but should be logged.
        }
    }
    // If name changed, update Firebase Auth displayName
    if (validatedData.data.name && validatedData.data.name !== currentFarmerData.name) {
        try {
            // Need to get user by new phone/email if phone also changed, or old if not
            const userEmailForAuth = validatedData.data.phone || currentFarmerData.phone;
            const user = await authAdmin.getUserByEmail(userEmailForAuth);
            await authAdmin.updateUser(user.uid, { displayName: validatedData.data.name });
            console.log(`Updated Firebase Auth displayName for farmer ${id} to ${validatedData.data.name}`);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth displayName for farmer ${id}:`, authError);
        }
    }


    const updatedFarmerDoc = await farmerDocRef.get();
    const updatedFarmer = { id: updatedFarmerDoc.id, ...updatedFarmerDoc.data() } as Farmer;
    
    revalidatePath("/farmers");
    return { success: true, farmer: updatedFarmer };
  } catch (error)
 {
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
    const farmerData = farmerDoc.data() as Farmer;

    await db.collection("farmers").doc(id).delete();
    
    // Delete Firebase Auth user
    try {
      const user = await authAdmin.getUserByEmail(farmerData.phone); // Assuming phone was email
      await authAdmin.deleteUser(user.uid);
      console.log(`Firebase Auth user deleted for farmer ${farmerData.name} with email/phone: ${farmerData.phone}`);
    } catch (authError: any) {
      // If user not found in Auth, it might have failed creation earlier or was already deleted.
      if (authError.code === 'auth/user-not-found') {
        console.log(`Firebase Auth user for phone ${farmerData.phone} not found. No deletion needed or already deleted.`);
      } else {
        console.error("Firebase Auth user deletion failed for farmer:", farmerData.phone, authError);
        // Log error but proceed with successful farmer DB deletion.
        // In production, might flag for manual review.
      }
    }

    revalidatePath("/farmers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting farmer:", error);
    return { success: false, errors: { _form: ["Failed to delete farmer from database."] } };
  }
}

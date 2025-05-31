
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { FARMER_EMAIL_DOMAIN } from "@/types"; // Use FARMER_EMAIL_DOMAIN
import { db, authAdmin } from "@/lib/firebaseAdmin";

const farmerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format (e.g., +256701234567). It will be used for login."),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  joinDate: z.string(), // Should be in 'yyyy-MM-dd' format
});

const updateFarmerServerSchema = farmerSchema.partial().omit({ id: true, joinDate: true });


export async function getFarmers(farmerId?: string): Promise<Farmer[]> {
  try {
    if (farmerId) {
      const farmerDoc = await db.collection("farmers").doc(farmerId).get();
      if (farmerDoc.exists) {
        return [{ id: farmerDoc.id, ...farmerDoc.data() } as Farmer];
      }
      return []; // Farmer not found
    } else {
      const farmersSnapshot = await db.collection("farmers").orderBy("name").get();
      const farmers: Farmer[] = [];
      farmersSnapshot.forEach((doc) => {
        farmers.push({ id: doc.id, ...doc.data() } as Farmer);
      });
      return farmers;
    }
  } catch (error) {
    console.error("Error fetching farmers:", error);
    throw error; // Rethrow to allow UI to handle if necessary
  }
}

export async function addFarmerAction(data: Omit<Farmer, 'id' | 'joinDate'> & { joinDate?: string }) {
  const farmerDataWithDefaultJoinDate = {
    ...data,
    joinDate: data.joinDate || new Date().toISOString().split("T")[0],
    idNumber: data.idNumber || '', // Ensure empty string if undefined
    notes: data.notes || '',       // Ensure empty string if undefined
  };

  const validatedData = farmerSchema.omit({id: true}).safeParse(farmerDataWithDefaultJoinDate);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const { name, phone, location, joinDate, idNumber, notes } = validatedData.data;

  try {
    // Check if farmer with this phone number already exists in Firestore 'farmers' collection
    const existingFarmerQuery = await db.collection("farmers").where("phone", "==", phone).limit(1).get();
    if (!existingFarmerQuery.empty) {
      return { success: false, errors: { phone: ["A farmer with this phone number already exists in the database."] } };
    }
    
    const defaultPassword = "Dairy!2345"; // Consider making this configurable or more secure
    const emailForFirebase = phone.trim() + FARMER_EMAIL_DOMAIN;
    let firebaseUid = '';

    console.log(`Attempting to create Firebase Auth user for farmer. Pseudo-email: ${emailForFirebase}, Default Password: ${defaultPassword}`);

    try {
      const createdUser = await authAdmin.createUser({
        email: emailForFirebase,
        password: defaultPassword,
        displayName: name,
        emailVerified: true, // Or false, depending on your flow
      });
      firebaseUid = createdUser.uid;
      console.log(`Firebase Auth user created for ${name} (UID: ${firebaseUid}) with pseudo-email: ${emailForFirebase}`);
      // Set custom claim for role
      await authAdmin.setCustomUserClaims(firebaseUid, { role: 'farmer' });
      console.log(`Custom claim { role: 'farmer' } set for UID: ${firebaseUid}`);
      console.log(`Default password for ${name} is: ${defaultPassword}`);

    } catch (authError: any) {
      console.error("Firebase Auth user creation failed for farmer:", phone, authError);
      if (authError.code === 'auth/email-already-exists') {
         return {
          success: false,
          errors: { phone: ["A user with this phone number (or derived email) already exists in the authentication system. Farmer not fully added."] },
        };
      }
      return {
        success: false, 
        errors: { _form: [`Firebase Auth user creation failed: ${authError.message}. Farmer not added.`] }
      };
    }

    // Use the Firebase Auth UID as the document ID in Firestore 'farmers' collection
    const farmerRef = db.collection("farmers").doc(firebaseUid);
    // Save only the necessary farmer data, not the firebaseUid as 'id' field in Firestore document
    const farmerDataToSave = { name, phone, location, joinDate, idNumber, notes };
    await farmerRef.set(farmerDataToSave);
    
    const newFarmer: Farmer = { id: firebaseUid, ...farmerDataToSave };

    console.log(`Simulated Welcome SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your login is your phone number. Password: ${defaultPassword}`);
    
    revalidatePath("/farmers");
    revalidatePath("/dashboard"); // Farmer count might change
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
  
  // Ensure optional fields are handled correctly (e.g. empty string if provided)
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
    const currentFarmerData = currentFarmerDoc.data() as Omit<Farmer, 'id'>; // Firestore data doesn't store 'id' field

    // If phone number is being changed, check if the new phone number already exists for another farmer
    if (validatedData.data.phone && validatedData.data.phone !== currentFarmerData.phone) {
        const existingFarmerQuery = await db.collection("farmers").where("phone", "==", validatedData.data.phone).limit(1).get();
        if (!existingFarmerQuery.empty) {
            const conflictingFarmer = existingFarmerQuery.docs[0];
            if (conflictingFarmer.id !== id) { // Ensure it's not the same farmer's record
                 return { success: false, errors: { phone: ["This phone number is already in use by another farmer."] } };
            }
        }
    }


    await farmerDocRef.update(validatedData.data);

    // Update Firebase Auth if phone or name changes
    const authUpdates: { email?: string; displayName?: string } = {};
    if (validatedData.data.phone && validatedData.data.phone !== currentFarmerData.phone) {
        const oldEmailForFirebase = currentFarmerData.phone.trim() + FARMER_EMAIL_DOMAIN;
        const newEmailForFirebase = validatedData.data.phone.trim() + FARMER_EMAIL_DOMAIN;
        console.log(`Attempting to update Firebase Auth email for farmer ${id} from ${oldEmailForFirebase} to ${newEmailForFirebase}`);
        authUpdates.email = newEmailForFirebase;
    }
    if (validatedData.data.name && validatedData.data.name !== currentFarmerData.name) {
        console.log(`Attempting to update Firebase Auth displayName for farmer ${id} to ${validatedData.data.name}`);
        authUpdates.displayName = validatedData.data.name;
    }

    if (Object.keys(authUpdates).length > 0) {
        try {
            await authAdmin.updateUser(id, authUpdates); // id is the UID
            console.log(`Updated Firebase Auth details for farmer ${id}:`, authUpdates);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth details for farmer ${id}:`, authError);
            // Potentially rollback Firestore changes or log critical error
            if (authUpdates.email) { // If email update failed, it's more critical
                 await farmerDocRef.update({ phone: currentFarmerData.phone }); // Attempt rollback of phone in Firestore
                 return { success: false, errors: { phone: [`Failed to update auth email: ${authError.message}. Phone update rolled back.`] } };
            }
            // For displayName failure, we might just log and proceed
        }
    }

    const updatedFarmerDocSnap = await farmerDocRef.get();
    const updatedFarmerData = updatedFarmerDocSnap.data() as Omit<Farmer, 'id'>;
    const updatedFarmer: Farmer = { id: updatedFarmerDocSnap.id, ...updatedFarmerData };

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
    const farmerDocRef = db.collection("farmers").doc(id);
    const farmerDoc = await farmerDocRef.get();
    if (!farmerDoc.exists) {
      return { success: false, errors: { _form: ["Farmer not found."] } };
    }

    // Delete from Firestore
    await farmerDocRef.delete();

    // Delete from Firebase Auth
    // The farmer's document ID (id) IS their Firebase Auth UID
    try {
      console.log(`Attempting to delete Firebase Auth user for farmer UID: ${id}`);
      await authAdmin.deleteUser(id);
      console.log(`Firebase Auth user deleted for farmer UID: ${id}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.warn(`Firebase Auth user for UID ${id} not found during deletion. Might have been already deleted or never existed.`);
      } else {
        console.error("Firebase Auth user deletion failed for farmer UID:", id, authError);
        // Critical: Firestore doc deleted, but Auth user remains. Log for manual cleanup.
         return { success: false, errors: { _form: [`Farmer data deleted from DB, but Firebase Auth user deletion failed: ${authError.message}. Please resolve manually.`] } };
      }
    }

    revalidatePath("/farmers");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting farmer:", error);
    return { success: false, errors: { _form: ["Failed to delete farmer from database."] } };
  }
}


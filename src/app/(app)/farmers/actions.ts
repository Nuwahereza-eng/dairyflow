
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { DUMMY_EMAIL_DOMAIN } from "@/types";
import { db, authAdmin } from "@/lib/firebaseAdmin";

const farmerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format (e.g., +256701234567). It will be used for login."),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  joinDate: z.string(),
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
    return [];
  }
}

export async function addFarmerAction(data: Omit<Farmer, 'id' | 'joinDate'> & { joinDate?: string }) {
  const farmerDataWithDefaultJoinDate = {
    ...data,
    joinDate: data.joinDate || new Date().toISOString().split("T")[0],
    idNumber: data.idNumber || '',
    notes: data.notes || '',
  };

  const validatedData = farmerSchema.omit({id: true}).safeParse(farmerDataWithDefaultJoinDate);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  try {
    const existingFarmerQuery = await db.collection("farmers").where("phone", "==", validatedData.data.phone).limit(1).get();
    if (!existingFarmerQuery.empty) {
      return { success: false, errors: { phone: ["A farmer with this phone number already exists in the database."] } };
    }
    
    // Firestore ID will be generated automatically, or we can use a custom one if needed.
    // For this setup, farmer's Firebase Auth UID will become their document ID in Firestore 'farmers' collection for simplicity.

    const defaultPassword = "Dairy!2345";
    const emailForFirebase = validatedData.data.phone.trim() + DUMMY_EMAIL_DOMAIN;
    let firebaseUid = '';

    console.log(`Attempting to create Firebase Auth user. Pseudo-email: ${emailForFirebase}, Default Password: ${defaultPassword}`);

    try {
      const createdUser = await authAdmin.createUser({
        email: emailForFirebase,
        password: defaultPassword,
        displayName: validatedData.data.name,
        emailVerified: true, 
      });
      firebaseUid = createdUser.uid;
      console.log(`Firebase Auth user created for ${validatedData.data.name} (UID: ${firebaseUid}) with pseudo-email: ${emailForFirebase}`);
      console.log(`Default password for ${validatedData.data.name} is: ${defaultPassword}`);
    } catch (authError: any) {
      console.error("Firebase Auth user creation failed for farmer:", validatedData.data.phone, authError);
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
    await farmerRef.set(validatedData.data);
    const newFarmer: Farmer = { id: firebaseUid, ...validatedData.data };

    console.log(`Simulated Welcome SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your login is your phone number. Password: ${defaultPassword}`);
    
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

    if (validatedData.data.phone && validatedData.data.phone !== currentFarmerData.phone) {
        try {
            const oldEmailForFirebase = currentFarmerData.phone.trim() + DUMMY_EMAIL_DOMAIN;
            const newEmailForFirebase = validatedData.data.phone.trim() + DUMMY_EMAIL_DOMAIN;
            console.log(`Attempting to update Firebase Auth email for farmer ${id} from ${oldEmailForFirebase} to ${newEmailForFirebase}`);
            // The UID for updating is the farmer's ID (which is the Auth UID)
            await authAdmin.updateUser(id, { email: newEmailForFirebase });
            console.log(`Updated Firebase Auth email for farmer ${id} to ${newEmailForFirebase}`);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth email for farmer ${id}:`, authError);
             // Rollback Firestore phone update or log critical error
            await farmerDocRef.update({ phone: currentFarmerData.phone }); // Attempt rollback
            return { success: false, errors: { phone: [`Failed to update auth email: ${authError.message}. Phone update rolled back.`] } };
        }
    }
    if (validatedData.data.name && validatedData.data.name !== currentFarmerData.name) {
        try {
            console.log(`Attempting to update Firebase Auth displayName for farmer ${id} to ${validatedData.data.name}`);
            await authAdmin.updateUser(id, { displayName: validatedData.data.name });
            console.log(`Updated Firebase Auth displayName for farmer ${id} to ${validatedData.data.name}`);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth displayName for farmer ${id}:`, authError);
        }
    }

    const updatedFarmerDoc = await farmerDocRef.get();
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
    const farmerDocRef = db.collection("farmers").doc(id);
    const farmerDoc = await farmerDocRef.get();
    if (!farmerDoc.exists) {
      return { success: false, errors: { _form: ["Farmer not found."] } };
    }
    // const farmerData = farmerDoc.data() as Farmer; // No longer needed for auth email

    await farmerDocRef.delete();

    try {
      // The farmer's ID (id) IS their Firebase Auth UID
      console.log(`Attempting to delete Firebase Auth user for farmer UID: ${id}`);
      await authAdmin.deleteUser(id);
      console.log(`Firebase Auth user deleted for farmer UID: ${id}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log(`Firebase Auth user for UID ${id} not found. No deletion needed or already deleted.`);
      } else {
        console.error("Firebase Auth user deletion failed for farmer UID:", id, authError);
        // Potentially re-add farmer to Firestore if auth deletion fails critically, or log for manual cleanup
         return { success: false, errors: { _form: [`Farmer data deleted from DB, but Firebase Auth user deletion failed: ${authError.message}. Please resolve manually.`] } };
      }
    }

    revalidatePath("/farmers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting farmer:", error);
    return { success: false, errors: { _form: ["Failed to delete farmer from database."] } };
  }
}

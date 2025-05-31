
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { FARMER_EMAIL_DOMAIN } from "@/types"; // Use FARMER_EMAIL_DOMAIN
import { db, authAdmin } from "@/lib/firebaseAdmin";
import { getSystemSettings } from '@/app/(app)/settings/actions';
import { sendWelcomeNotification } from '@/ai/flows/welcome-notification'; // Import the new flow

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
    
    const defaultPassword = "Dairy!2345"; 
    const emailForFirebase = phone.trim() + FARMER_EMAIL_DOMAIN;
    let firebaseUid = '';

    console.log(`Attempting to create Firebase Auth user for farmer. Pseudo-email: ${emailForFirebase}, Default Password: ${defaultPassword}`);

    try {
      const createdUser = await authAdmin.createUser({
        email: emailForFirebase,
        password: defaultPassword,
        displayName: name,
        emailVerified: true, 
      });
      firebaseUid = createdUser.uid;
      console.log(`Firebase Auth user created for ${name} (UID: ${firebaseUid}) with pseudo-email: ${emailForFirebase}`);
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

    const farmerRef = db.collection("farmers").doc(firebaseUid);
    const farmerDataToSave = { name, phone, location, joinDate, idNumber, notes };
    await farmerRef.set(farmerDataToSave);
    
    const newFarmer: Farmer = { id: firebaseUid, ...farmerDataToSave };

    // Send Welcome SMS
    const currentSystemSettings = await getSystemSettings();
    if (currentSystemSettings.smsProvider !== 'none' && newFarmer.phone) {
      try {
        const smsResult = await sendWelcomeNotification({
          farmerName: newFarmer.name,
          phoneNumber: newFarmer.phone,
          defaultPassword: defaultPassword,
        });
        console.log("Welcome SMS Notification Result:", smsResult);
      } catch (error) {
        console.error("Failed to call sendWelcomeNotification flow:", error);
      }
    } else if (currentSystemSettings.smsProvider === 'none') {
      console.log(`Simulated Welcome SMS (provider 'none') to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your login is your phone number. Password: ${defaultPassword}`);
    } else if (!newFarmer.phone) {
        console.log(`Welcome SMS not sent: Farmer ${newFarmer.name} has no E.164 phone number.`);
    }
    
    revalidatePath("/farmers");
    revalidatePath("/dashboard"); 
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
    const currentFarmerData = currentFarmerDoc.data() as Omit<Farmer, 'id'>; 

    if (validatedData.data.phone && validatedData.data.phone !== currentFarmerData.phone) {
        const existingFarmerQuery = await db.collection("farmers").where("phone", "==", validatedData.data.phone).limit(1).get();
        if (!existingFarmerQuery.empty) {
            const conflictingFarmer = existingFarmerQuery.docs[0];
            if (conflictingFarmer.id !== id) { 
                 return { success: false, errors: { phone: ["This phone number is already in use by another farmer."] } };
            }
        }
    }

    await farmerDocRef.update(validatedData.data);

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
            await authAdmin.updateUser(id, authUpdates); 
            console.log(`Updated Firebase Auth details for farmer ${id}:`, authUpdates);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth details for farmer ${id}:`, authError);
            if (authUpdates.email) { 
                 await farmerDocRef.update({ phone: currentFarmerData.phone }); 
                 return { success: false, errors: { phone: [`Failed to update auth email: ${authError.message}. Phone update rolled back.`] } };
            }
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

    const batch = db.batch();

    console.log(`deleteFarmerAction: Querying deliveries for farmer ID: ${id}`);
    const deliveriesSnapshot = await db.collection("deliveries").where("farmerId", "==", id).get();
    const deliveryIdsToDelete = deliveriesSnapshot.docs.map(doc => doc.id);
    console.log(`deleteFarmerAction: Found ${deliveryIdsToDelete.length} deliveries to delete for farmer ${id}. IDs: ${deliveryIdsToDelete.join(', ')}`);
    deliveriesSnapshot.forEach(doc => batch.delete(doc.ref));

    console.log(`deleteFarmerAction: Querying payments for farmer ID: ${id}`);
    const paymentsSnapshot = await db.collection("payments").where("farmerId", "==", id).get();
    const paymentIdsToDelete = paymentsSnapshot.docs.map(doc => doc.id);
    console.log(`deleteFarmerAction: Found ${paymentIdsToDelete.length} payments to delete for farmer ${id}. IDs: ${paymentIdsToDelete.join(', ')}`);
    paymentsSnapshot.forEach(doc => batch.delete(doc.ref));

    batch.delete(farmerDocRef);
    console.log(`deleteFarmerAction: Farmer document ${id} added to batch delete.`);

    await batch.commit();
    console.log(`deleteFarmerAction: Firestore batch delete committed for farmer ${id} and ${deliveryIdsToDelete.length} deliveries, ${paymentIdsToDelete.length} payments.`);

    try {
      console.log(`deleteFarmerAction: Attempting to delete Firebase Auth user for farmer UID: ${id}`);
      await authAdmin.deleteUser(id);
      console.log(`deleteFarmerAction: Firebase Auth user deleted for farmer UID: ${id}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.warn(`deleteFarmerAction: Firebase Auth user for UID ${id} not found during deletion. Might have been already deleted or never existed.`);
      } else {
        console.error("deleteFarmerAction: Firebase Auth user deletion failed for farmer UID:", id, authError);
         return { success: false, errors: { _form: [`Farmer data deleted from DB, but Firebase Auth user deletion failed: ${authError.message}. Please resolve manually.`] } };
      }
    }

    revalidatePath("/farmers");
    revalidatePath("/deliveries");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting farmer and associated data:", error);
    if (error.code === 9 || error.code === 5 ) { 
         return { success: false, errors: { _form: [`Failed to delete farmer: A Firestore query requires an index. Details: ${error.message || error.details}. Please check Firestore console for index creation links.`] } };
    }
    return { success: false, errors: { _form: [`Failed to delete farmer from database: ${error.message}`] } };
  }
}

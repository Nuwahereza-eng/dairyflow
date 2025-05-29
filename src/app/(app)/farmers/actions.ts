
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { DUMMY_EMAIL_DOMAIN } from "@/types"; // Import the constant
import { db, authAdmin } from "@/lib/firebaseAdmin";

// Stricter phone validation for E.164, including the + sign.
const farmerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Phone number must be in E.164 format (e.g., +256701234567)."),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  joinDate: z.string(),
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

    const farmerRef = await db.collection("farmers").add(validatedData.data);
    const newFarmer: Farmer = { id: farmerRef.id, ...validatedData.data };

    const defaultPassword = "Dairy!2345";
    const emailForFirebase = validatedData.data.phone + DUMMY_EMAIL_DOMAIN;

    try {
      await authAdmin.createUser({
        email: emailForFirebase,
        password: defaultPassword,
        displayName: newFarmer.name,
        emailVerified: true, // Using phone as email, can be considered verified
      });
      console.log(`Firebase Auth user created for ${newFarmer.name} with pseudo-email: ${emailForFirebase}`);
      console.log(`Simulated Welcome SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your Farmer ID is CF${newFarmer.id.substring(0,5).toUpperCase()}. You can login with your phone number and the default password: ${defaultPassword}`);
    } catch (authError: any) {
      console.error("Firebase Auth user creation failed for farmer:", newFarmer.phone, authError);
      if (authError.code === 'auth/email-already-exists') {
         return {
          success: false, // Indicate overall failure if auth user can't be created as intended
          errors: { phone: ["A user with this phone number (or derived email) already exists in the authentication system. Farmer not fully added."] },
          warning: `Farmer ${newFarmer.name} data was added to database, but Firebase Auth user creation failed: ${authError.message}. Please resolve authentication conflict or delete the farmer data.`,
        };
      }
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
            const oldEmailForFirebase = currentFarmerData.phone + DUMMY_EMAIL_DOMAIN;
            const newEmailForFirebase = validatedData.data.phone + DUMMY_EMAIL_DOMAIN;
            const user = await authAdmin.getUserByEmail(oldEmailForFirebase);
            await authAdmin.updateUser(user.uid, { email: newEmailForFirebase });
            console.log(`Updated Firebase Auth email for farmer ${id} to ${newEmailForFirebase}`);
        } catch (authError: any) {
            console.error(`Failed to update Firebase Auth email for farmer ${id}:`, authError);
        }
    }
    // If name changed, update Firebase Auth displayName
    if (validatedData.data.name && validatedData.data.name !== currentFarmerData.name) {
        try {
            const userEmailForAuthLookup = (validatedData.data.phone || currentFarmerData.phone) + DUMMY_EMAIL_DOMAIN;
            const user = await authAdmin.getUserByEmail(userEmailForAuthLookup);
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
    const farmerData = farmerDoc.data() as Farmer;

    await db.collection("farmers").doc(id).delete();

    try {
      const emailForFirebase = farmerData.phone + DUMMY_EMAIL_DOMAIN;
      const user = await authAdmin.getUserByEmail(emailForFirebase);
      await authAdmin.deleteUser(user.uid);
      console.log(`Firebase Auth user deleted for farmer ${farmerData.name} with pseudo-email: ${emailForFirebase}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log(`Firebase Auth user for phone ${farmerData.phone} (pseudo-email ${farmerData.phone + DUMMY_EMAIL_DOMAIN}) not found. No deletion needed or already deleted.`);
      } else {
        console.error("Firebase Auth user deletion failed for farmer:", farmerData.phone, authError);
      }
    }

    revalidatePath("/farmers");
    return { success: true };
  } catch (error) {
    console.error("Error deleting farmer:", error);
    return { success: false, errors: { _form: ["Failed to delete farmer from database."] } };
  }
}

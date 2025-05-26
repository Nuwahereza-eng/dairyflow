"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Farmer } from "@/types";
import { initialFarmers, initialPayments } from "@/lib/mockData"; // In a real app, this would be a database
import { sendDeliveryNotification } from "@/ai/flows/sms-notifications"; // Example usage, though not directly for farmer creation

// For demo, we'll mutate an in-memory array.
// In a real app, use a database.
let farmersStore: Farmer[] = [...initialFarmers];
let paymentsStore = [...initialPayments]; // Keep payments in sync for new farmers

const farmerSchema = z.object({
  id: z.string().optional(), // Optional for creation
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[0-9\s-()]{7,20}$/, "Invalid phone number format"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  idNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function getFarmers(): Promise<Farmer[]> {
  return JSON.parse(JSON.stringify(farmersStore)); // Return a copy
}

export async function addFarmerAction(data: Omit<Farmer, 'id' | 'joinDate'>) {
  const validatedData = farmerSchema.omit({ id: true }).safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const newFarmer: Farmer = {
    ...validatedData.data,
    id: (farmersStore.length + 1).toString(), // Simple ID generation for demo
    joinDate: new Date().toISOString().split("T")[0],
  };
  farmersStore.push(newFarmer);

  // Add to payments tracking for the current period (example)
  const currentPeriod = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  paymentsStore.push({
    id: (paymentsStore.length + 1).toString(),
    farmerId: newFarmer.id,
    farmerName: newFarmer.name,
    period: currentPeriod,
    totalLiters: 0,
    amountDue: 0,
    status: 'pending',
  });
  
  // Example: Send welcome notification (though not specified, good practice)
  // Consider creating a dedicated "welcomeFarmer" Genkit flow
  /*
  try {
    await sendDeliveryNotification({ // This is a placeholder, use a proper welcome SMS
        phoneNumber: newFarmer.phone,
        quantity: 0, // Not applicable
        quality: "", // Not applicable
        amount: 0 // Not applicable
        // Ideally, a welcome message would be crafted by a different flow
    });
  } catch (error) {
    console.error("Failed to send welcome SMS:", error);
    // Don't let SMS failure block farmer creation
  }
  */
  console.log(`SMS to ${newFarmer.phone}: Welcome to DairyFlow, ${newFarmer.name}! Your Farmer ID is CF${newFarmer.id.padStart(3,'0')}.`);


  revalidatePath("/farmers");
  return { success: true, farmer: newFarmer };
}

export async function updateFarmerAction(id: string, data: Partial<Omit<Farmer, 'id' | 'joinDate'>>) {
  const farmerIndex = farmersStore.findIndex(f => f.id === id);
  if (farmerIndex === -1) {
    return { success: false, errors: { _form: ["Farmer not found"] } };
  }
  
  // Validate only the fields provided
  const partialSchema = farmerSchema.partial().omit({ id: true });
  const validatedData = partialSchema.safeParse(data);

  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  farmersStore[farmerIndex] = { ...farmersStore[farmerIndex], ...validatedData.data };
  
  revalidatePath("/farmers");
  return { success: true, farmer: farmersStore[farmerIndex] };
}

export async function deleteFarmerAction(id: string) {
  const initialLength = farmersStore.length;
  farmersStore = farmersStore.filter(f => f.id !== id);
  
  if (farmersStore.length === initialLength) {
     return { success: false, errors: { _form: ["Farmer not found or already deleted"] } };
  }

  // Also remove related payments for demo purposes
  paymentsStore = paymentsStore.filter(p => p.farmerId !== id);

  revalidatePath("/farmers");
  revalidatePath("/payments"); // if payments are affected
  return { success: true };
}


"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Delivery, Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin"; 
import { sendDeliveryNotification } from '@/ai/flows/sms-notifications';
import { getSystemSettings } from '@/app/(app)/settings/actions';


const deliverySchemaBase = z.object({
  farmerId: z.string().min(1, "Farmer selection is required"),
  quantity: z.number().min(0.1, "Quantity must be at least 0.1L"),
  quality: z.enum(["A", "B", "C"], { required_error: "Quality grade is required" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  notes: z.string().optional(),
});


async function calculateAmount(quantity: number, quality: 'A' | 'B' | 'C'): Promise<number> {
  const systemSettings = await getSystemSettings(); 
  const basePrice = systemSettings.milkPricePerLiter;
  let priceMultiplier = 1;
  if (quality === 'B') priceMultiplier = 0.9;
  else if (quality === 'C') priceMultiplier = 0.8;
  return parseFloat((quantity * basePrice * priceMultiplier).toFixed(2));
}

export async function getDeliveries(farmerId?: string): Promise<Delivery[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("deliveries");
    if (farmerId) {
      query = query.where("farmerId", "==", farmerId);
    }
    // Always order, Firestore might require an index for farmerId + date + time if querying by farmerId
    query = query.orderBy("date", "desc").orderBy("time", "desc");
    
    const deliveriesSnapshot = await query.get();
    const deliveries: Delivery[] = [];
    
    // Optimized farmer name fetching if not filtering by a single farmer
    let farmersMap: Map<string, string> | null = null;
    if (!farmerId) {
        const allFarmersSnapshot = await db.collection("farmers").get();
        farmersMap = new Map();
        allFarmersSnapshot.forEach(doc => {
            farmersMap!.set(doc.id, (doc.data() as Farmer).name);
        });
    }

    for (const doc of deliveriesSnapshot.docs) {
      const deliveryData = doc.data() as Omit<Delivery, 'id' | 'farmerName'>;
      let farmerName = "Unknown Farmer";

      if (deliveryData.farmerId) {
        if (farmersMap) { // Use pre-fetched map if available
            farmerName = farmersMap.get(deliveryData.farmerId) || "Unknown Farmer (from map)";
        } else if (farmerId && farmerId === deliveryData.farmerId) { // If fetching for a specific farmer, get their name
            const farmerDoc = await db.collection("farmers").doc(deliveryData.farmerId).get();
            if (farmerDoc.exists) {
                farmerName = (farmerDoc.data() as Farmer).name;
            }
        } else if (!farmerId) { // Fallback if not filtering and map somehow wasn't created (should not happen)
             const farmerDoc = await db.collection("farmers").doc(deliveryData.farmerId).get();
            if (farmerDoc.exists) {
                farmerName = (farmerDoc.data() as Farmer).name;
            }
        }
      }
      deliveries.push({ 
        id: doc.id, 
        ...deliveryData,
        farmerName 
      });
    }
    return deliveries;
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    // return []; // Keep throwing error to surface issues like missing indexes
    throw error; 
  }
}

export async function recordDeliveryAction(data: Omit<Delivery, 'id' | 'amount' | 'farmerName'>) {
  const validatedData = deliverySchemaBase.safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const amount = await calculateAmount(validatedData.data.quantity, validatedData.data.quality);
  
  try {
    const deliveryDataToSave = {
      ...validatedData.data,
      amount: amount,
    };
    const docRef = await db.collection("deliveries").add(deliveryDataToSave);
    const newDelivery: Delivery = { 
        id: docRef.id, 
        ...deliveryDataToSave, 
    };

    let farmer: Farmer | null = null;
    const farmerDoc = await db.collection("farmers").doc(newDelivery.farmerId).get();
    if (farmerDoc.exists) {
        farmer = {id: farmerDoc.id, ...farmerDoc.data()} as Farmer;
    }
    
    const currentSystemSettings = await getSystemSettings();

    if (farmer && farmer.name && farmer.phone && currentSystemSettings.smsProvider !== 'none') {
      try {
        const smsResult = await sendDeliveryNotification({
          farmerName: farmer.name, // Pass farmer's name
          phoneNumber: farmer.phone,
          quantity: newDelivery.quantity,
          quality: newDelivery.quality,
          amount: newDelivery.amount,
        });
        console.log("Delivery SMS Notification Result:", smsResult);
      } catch (error) {
        console.error("Failed to call sendDeliveryNotification flow:", error);
      }
    } else if (farmer && farmer.name && farmer.phone && currentSystemSettings.smsProvider === 'none') {
      console.log(`Simulated SMS (provider 'none'): Delivery to ${farmer.name} (${farmer.phone}) for ${newDelivery.quantity}L, Grade ${newDelivery.quality}, Amount ${newDelivery.amount}.`);
    } else if (farmer && (!farmer.phone || !farmer.name)) {
      console.log(`SMS not sent for delivery: Farmer ${farmer.name || farmer.id} has missing name or E.164 phone number.`);
    } else if (!farmer) {
      console.log(`SMS not sent for delivery: Farmer with ID ${newDelivery.farmerId} not found.`);
    }

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");
    return { success: true, delivery: { ...newDelivery, farmerName: farmer?.name } };
  } catch (error) {
    console.error("Error recording delivery:", error);
    return { success: false, errors: { _form: ["Failed to record delivery to database."] } };
  }
}

export async function updateDeliveryAction(id: string, data: Partial<Omit<Delivery, 'id' | 'amount' | 'farmerName'>>) {
  const deliveryRef = db.collection("deliveries").doc(id);
  try {
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) {
      return { success: false, errors: { _form: ["Delivery not found"] } };
    }
    const originalDeliveryData = { id: deliveryDoc.id, ...deliveryDoc.data() } as Delivery;

    const partialSchema = deliverySchemaBase.partial();
    const validatedData = partialSchema.safeParse(data);
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    const updatedFields = validatedData.data;
    const newQuantity = updatedFields.quantity ?? originalDeliveryData.quantity;
    const newQuality = updatedFields.quality ?? originalDeliveryData.quality;
    const newAmount = await calculateAmount(newQuantity, newQuality);
    
    const dataToUpdate: Partial<Omit<Delivery, 'id' | 'farmerName'>> = {
        ...updatedFields,
        farmerId: updatedFields.farmerId ?? originalDeliveryData.farmerId,
        quantity: newQuantity,
        quality: newQuality,
        amount: newAmount
    };
    await deliveryRef.update(dataToUpdate);

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");

    const updatedDeliveryDoc = await deliveryRef.get();
    const finalDeliveryData = updatedDeliveryDoc.data() as Omit<Delivery, 'id' | 'farmerName'>;
    let farmerName = originalDeliveryData.farmerName; 
     if (finalDeliveryData?.farmerId) {
        const farmerDoc = await db.collection("farmers").doc(finalDeliveryData.farmerId).get();
        if (farmerDoc.exists) {
          farmerName = (farmerDoc.data() as Farmer).name;
        }
      }

    return { success: true, delivery: { id: updatedDeliveryDoc.id, ...finalDeliveryData, farmerName } as Delivery };
  } catch (error) {
     console.error("Error updating delivery:", error);
    return { success: false, errors: { _form: ["Failed to update delivery in database."] } };
  }
}

export async function deleteDeliveryAction(id: string) {
  const deliveryRef = db.collection("deliveries").doc(id);
  try {
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) {
      return { success: false, errors: { _form: ["Delivery not found"] } };
    }

    await deliveryRef.delete();

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting delivery:", error);
    return { success: false, errors: { _form: ["Failed to delete delivery from database."] } };
  }
}

export async function getDeliveryFarmers(): Promise<Pick<Farmer, 'id' | 'name'>[]> {
  try {
    const farmersSnapshot = await db.collection("farmers").orderBy("name").get();
    const farmers: Pick<Farmer, 'id' | 'name'>[] = [];
    farmersSnapshot.forEach((doc) => {
      const farmerData = doc.data();
      farmers.push({ id: doc.id, name: farmerData.name });
    });
    return farmers;
  } catch (error) {
    console.error("Error fetching farmers for delivery form:", error);
    return [];
  }
}

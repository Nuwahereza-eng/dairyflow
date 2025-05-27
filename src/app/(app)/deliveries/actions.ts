
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Delivery, Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin"; // Import Firestore instance
import { sendDeliveryNotification } from '@/ai/flows/sms-notifications';
import { getSystemSettings } from '@/app/(app)/settings/actions';
// import { initialPayments } from "@/lib/mockData"; // Payments still in-memory for now

// let paymentsStore = [...initialPayments]; // TODO: MIGRATE PAYMENTS TO FIRESTORE

const deliverySchemaBase = z.object({
  farmerId: z.string().min(1, "Farmer selection is required"),
  quantity: z.number().min(0.1, "Quantity must be at least 0.1L"),
  quality: z.enum(["A", "B", "C"], { required_error: "Quality grade is required" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  notes: z.string().optional(),
});

// const deliverySchema = deliverySchemaBase.extend({
//   id: z.string().optional(), // Firestore generates IDs
// });


async function calculateAmount(quantity: number, quality: 'A' | 'B' | 'C'): Promise<number> {
  const systemSettings = await getSystemSettings(); // This still reads from in-memory settings
  const basePrice = systemSettings.milkPricePerLiter;
  let priceMultiplier = 1;
  if (quality === 'B') priceMultiplier = 0.9;
  else if (quality === 'C') priceMultiplier = 0.8;
  return parseFloat((quantity * basePrice * priceMultiplier).toFixed(2));
}

export async function getDeliveries(): Promise<Delivery[]> {
  try {
    const deliveriesSnapshot = await db.collection("deliveries").orderBy("date", "desc").orderBy("time", "desc").get();
    const deliveries: Delivery[] = [];
    for (const doc of deliveriesSnapshot.docs) {
      const deliveryData = doc.data() as Omit<Delivery, 'id' | 'farmerName'>;
      let farmerName = "Unknown Farmer";
      if (deliveryData.farmerId) {
        const farmerDoc = await db.collection("farmers").doc(deliveryData.farmerId).get();
        if (farmerDoc.exists) {
          farmerName = (farmerDoc.data() as Farmer).name;
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
    return [];
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
        // farmerName will be populated by getDeliveries, or we can fetch it here if needed immediately
    };

    // TODO: MIGRATE PAYMENTS TO FIRESTORE and update payment logic here
    // const paymentIndex = paymentsStore.findIndex(p => p.farmerId === newDelivery.farmerId);
    // if (paymentIndex !== -1) {
    //   paymentsStore[paymentIndex].totalLiters += newDelivery.quantity;
    //   paymentsStore[paymentIndex].amountDue += newDelivery.amount;
    //   if (!paymentsStore[paymentIndex].farmerName) {
    //     const farmerDoc = await db.collection("farmers").doc(newDelivery.farmerId).get();
    //     if (farmerDoc.exists) paymentsStore[paymentIndex].farmerName = (farmerDoc.data() as Farmer).name;
    //   }
    // } else {
    //   const farmerDoc = await db.collection("farmers").doc(newDelivery.farmerId).get();
    //   const currentPeriod = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    //   paymentsStore.push({
    //     id: (paymentsStore.length + 1).toString(), // This ID generation needs to change for Firestore
    //     farmerId: newDelivery.farmerId,
    //     farmerName: farmerDoc.exists ? (farmerDoc.data() as Farmer).name : "Unknown",
    //     period: currentPeriod,
    //     totalLiters: newDelivery.quantity,
    //     amountDue: newDelivery.amount,
    //     status: 'pending',
    //   });
    // }

    let farmer: Farmer | null = null;
    const farmerDoc = await db.collection("farmers").doc(newDelivery.farmerId).get();
    if (farmerDoc.exists) {
        farmer = farmerDoc.data() as Farmer;
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
      console.log(`Simulated SMS (provider 'none'): Delivery to ${farmer.name} (${farmer.phone}) for ${newDelivery.quantity}L, Grade ${newDelivery.quality}, Amount ${newDelivery.amount}. Settings:`, currentSystemSettings);
    } else if (farmer && (!farmer.phone || !farmer.name)) {
      console.log(`SMS not sent for delivery: Farmer ${farmer.name || farmer.id} has missing name or phone number.`);
    } else if (!farmer) {
      console.log(`SMS not sent for delivery: Farmer with ID ${newDelivery.farmerId} not found.`);
    }

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");
    // revalidatePath("/payments"); // Re-enable when payments are on Firestore
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
    const originalDeliveryData = deliveryDoc.data() as Delivery;

    const partialSchema = deliverySchemaBase.partial();
    const validatedData = partialSchema.safeParse(data);
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    const updatedFields = validatedData.data;
    const newQuantity = updatedFields.quantity ?? originalDeliveryData.quantity;
    const newQuality = updatedFields.quality ?? originalDeliveryData.quality;
    const newAmount = await calculateAmount(newQuantity, newQuality);

    // TODO: MIGRATE PAYMENTS TO FIRESTORE and update payment logic here
    // const oldPaymentContribution = originalDeliveryData.amount;
    // const newPaymentContribution = newAmount;
    // const paymentDiff = newPaymentContribution - oldPaymentContribution;
    // const quantityDiff = newQuantity - originalDeliveryData.quantity;

    const dataToUpdate: Partial<Delivery> = {
        ...updatedFields,
        quantity: newQuantity,
        quality: newQuality,
        amount: newAmount
    }
    await deliveryRef.update(dataToUpdate);

    // const paymentIndex = paymentsStore.findIndex(p => p.farmerId === originalDeliveryData.farmerId);
    // if (paymentIndex !== -1) {
    //   paymentsStore[paymentIndex].totalLiters += quantityDiff;
    //   paymentsStore[paymentIndex].amountDue += paymentDiff;
    // }

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");
    // revalidatePath("/payments"); // Re-enable when payments are on Firestore

    const updatedDeliveryDoc = await deliveryRef.get();
    const finalDeliveryData = updatedDeliveryDoc.data();
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
    // const deletedDelivery = deliveryDoc.data() as Delivery; // Needed if adjusting payments

    await deliveryRef.delete();

    // TODO: MIGRATE PAYMENTS TO FIRESTORE and update payment logic here
    // const paymentIndex = paymentsStore.findIndex(p => p.farmerId === deletedDelivery.farmerId);
    // if (paymentIndex !== -1) {
    //   paymentsStore[paymentIndex].totalLiters -= deletedDelivery.quantity;
    //   paymentsStore[paymentIndex].amountDue -= deletedDelivery.amount;
    // }

    revalidatePath("/deliveries");
    revalidatePath("/dashboard");
    // revalidatePath("/payments"); // Re-enable when payments are on Firestore
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

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Delivery, Farmer } from "@/types";
import { initialDeliveries, initialFarmers, initialPayments, initialSystemSettings } from "@/lib/mockData";
import { sendDeliveryNotification } from '@/ai/flows/sms-notifications';

let deliveriesStore: Delivery[] = [...initialDeliveries];
const farmersStore: Farmer[] = [...initialFarmers]; // Needed to get farmer phone for SMS
let paymentsStore = [...initialPayments]; // Keep payments in sync
let systemSettingsStore = {...initialSystemSettings}; // For milk price

const deliverySchemaBase = z.object({
  farmerId: z.string().min(1, "Farmer selection is required"),
  quantity: z.number().min(0.1, "Quantity must be at least 0.1L"),
  quality: z.enum(["A", "B", "C"], { required_error: "Quality grade is required" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  notes: z.string().optional(),
});

const deliverySchema = deliverySchemaBase.extend({
  id: z.string().optional(), // Optional for creation
});


function calculateAmount(quantity: number, quality: 'A' | 'B' | 'C'): number {
  const basePrice = systemSettingsStore.milkPricePerLiter;
  let priceMultiplier = 1;
  if (quality === 'B') priceMultiplier = 0.9; // Example: Grade B is 90% of base
  else if (quality === 'C') priceMultiplier = 0.8; // Example: Grade C is 80% of base
  return parseFloat((quantity * basePrice * priceMultiplier).toFixed(2));
}

export async function getDeliveries(): Promise<Delivery[]> {
  // Enrich with farmer names
  return JSON.parse(JSON.stringify(deliveriesStore.map(d => {
    const farmer = farmersStore.find(f => f.id === d.farmerId);
    return { ...d, farmerName: farmer?.name || "Unknown Farmer" };
  })));
}

export async function recordDeliveryAction(data: Omit<Delivery, 'id' | 'amount' | 'farmerName'>) {
  const validatedData = deliverySchemaBase.safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const amount = calculateAmount(validatedData.data.quantity, validatedData.data.quality);
  const newDelivery: Delivery = {
    ...validatedData.data,
    id: (deliveriesStore.length + 1).toString(),
    amount: amount,
  };
  deliveriesStore.push(newDelivery);

  // Update farmer's payment record
  const paymentIndex = paymentsStore.findIndex(p => p.farmerId === newDelivery.farmerId);
  if (paymentIndex !== -1) {
    paymentsStore[paymentIndex].totalLiters += newDelivery.quantity;
    paymentsStore[paymentIndex].amountDue += newDelivery.amount;
    // Ensure farmerName is consistent if already there
    if (!paymentsStore[paymentIndex].farmerName) {
      const farmer = farmersStore.find(f => f.id === newDelivery.farmerId);
      paymentsStore[paymentIndex].farmerName = farmer?.name;
    }
  } else { // If no payment record for current period, create one (simplified for demo)
    const farmer = farmersStore.find(f => f.id === newDelivery.farmerId);
    const currentPeriod = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    paymentsStore.push({
      id: (paymentsStore.length + 1).toString(),
      farmerId: newDelivery.farmerId,
      farmerName: farmer?.name,
      period: currentPeriod,
      totalLiters: newDelivery.quantity,
      amountDue: newDelivery.amount,
      status: 'pending',
    });
  }


  const farmer = farmersStore.find(f => f.id === newDelivery.farmerId);
  if (farmer && farmer.phone && systemSettingsStore.smsProvider !== 'none') {
    try {
      await sendDeliveryNotification({
        phoneNumber: farmer.phone,
        quantity: newDelivery.quantity,
        quality: newDelivery.quality,
        amount: newDelivery.amount,
      });
    } catch (error) {
      console.error("Failed to send delivery SMS:", error);
      // Log error but don't fail the delivery recording
    }
  } else if (farmer && farmer.phone && systemSettingsStore.smsProvider === 'none') {
    console.log(`Simulated SMS (provider 'none'): Delivery to ${farmer.phone} for ${newDelivery.quantity}L, Grade ${newDelivery.quality}, Amount ${newDelivery.amount}.`);
  }


  revalidatePath("/deliveries");
  revalidatePath("/dashboard"); // For stats
  revalidatePath("/payments"); // For updated payment dues
  return { success: true, delivery: newDelivery };
}

export async function updateDeliveryAction(id: string, data: Partial<Omit<Delivery, 'id' | 'amount' | 'farmerName'>>) {
  const deliveryIndex = deliveriesStore.findIndex(d => d.id === id);
  if (deliveryIndex === -1) {
    return { success: false, errors: { _form: ["Delivery not found"] } };
  }

  const originalDelivery = deliveriesStore[deliveryIndex];
  
  const partialSchema = deliverySchemaBase.partial();
  const validatedData = partialSchema.safeParse(data);
  if (!validatedData.success) {
    return { success: false, errors: validatedData.error.flatten().fieldErrors };
  }

  const updatedFields = validatedData.data;
  const newQuantity = updatedFields.quantity ?? originalDelivery.quantity;
  const newQuality = updatedFields.quality ?? originalDelivery.quality;
  const newAmount = calculateAmount(newQuantity, newQuality);

  // Recalculate payment diff
  const oldPaymentContribution = originalDelivery.amount;
  const newPaymentContribution = newAmount;
  const paymentDiff = newPaymentContribution - oldPaymentContribution;
  const quantityDiff = newQuantity - originalDelivery.quantity;

  deliveriesStore[deliveryIndex] = { 
    ...originalDelivery, 
    ...updatedFields,
    quantity: newQuantity, // ensure these are explicitly set
    quality: newQuality,
    amount: newAmount 
  };

  // Update payment record
  const paymentIndex = paymentsStore.findIndex(p => p.farmerId === originalDelivery.farmerId);
  if (paymentIndex !== -1) {
    paymentsStore[paymentIndex].totalLiters += quantityDiff;
    paymentsStore[paymentIndex].amountDue += paymentDiff;
  }
  
  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { success: true, delivery: deliveriesStore[deliveryIndex] };
}

export async function deleteDeliveryAction(id: string) {
  const deliveryIndex = deliveriesStore.findIndex(d => d.id === id);
  if (deliveryIndex === -1) {
    return { success: false, errors: { _form: ["Delivery not found"] } };
  }

  const deletedDelivery = deliveriesStore[deliveryIndex];
  deliveriesStore.splice(deliveryIndex, 1);

  // Revert payment record
  const paymentIndex = paymentsStore.findIndex(p => p.farmerId === deletedDelivery.farmerId);
  if (paymentIndex !== -1) {
    paymentsStore[paymentIndex].totalLiters -= deletedDelivery.quantity;
    paymentsStore[paymentIndex].amountDue -= deletedDelivery.amount;
  }

  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  return { success: true };
}

export async function getDeliveryFarmers(): Promise<Pick<Farmer, 'id' | 'name'>[]> {
    return farmersStore.map(f => ({id: f.id, name: f.name}));
}

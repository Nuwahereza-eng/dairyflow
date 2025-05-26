
"use server";

import { revalidatePath } from "next/cache";
import type { Payment, Farmer } from "@/types";
import { initialPayments, initialFarmers } from "@/lib/mockData";
import { sendPaymentNotification } from '@/ai/flows/payment-notification';
import { getSystemSettings } from '@/app/(app)/settings/actions'; // Import the getter for system settings

let paymentsStore: Payment[] = [...initialPayments];
const farmersStore: Farmer[] = [...initialFarmers]; // Needed for farmer details

export async function getPayments(): Promise<Payment[]> {
  // Enrich with farmer names
  return JSON.parse(JSON.stringify(paymentsStore.map(p => {
    const farmer = farmersStore.find(f => f.id === p.farmerId);
    return { ...p, farmerName: farmer?.name || "Unknown Farmer" };
  })));
}

export async function processSinglePaymentAction(paymentId: string): Promise<{ success: boolean; message?: string }> {
  const paymentIndex = paymentsStore.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) {
    return { success: false, message: "Payment record not found." };
  }
  if (paymentsStore[paymentIndex].status === 'paid') {
    return { success: false, message: "Payment already processed." };
  }

  paymentsStore[paymentIndex].status = 'paid';
  paymentsStore[paymentIndex].lastPaymentDate = new Date().toISOString().split("T")[0];

  const payment = paymentsStore[paymentIndex];
  const farmer = farmersStore.find(f => f.id === payment.farmerId);
  const currentSystemSettings = await getSystemSettings(); // Fetch current settings

  if (farmer && farmer.phone && currentSystemSettings.smsProvider !== 'none') {
    try {
      const smsResult = await sendPaymentNotification({
        phoneNumber: farmer.phone,
        amount: payment.amountDue,
        period: payment.period,
      });
      console.log("Payment SMS Notification Result for single payment:", smsResult);
    } catch (error) {
      console.error("Failed to call sendPaymentNotification flow for single payment:", error);
    }
  } else if (farmer && farmer.phone && currentSystemSettings.smsProvider === 'none') {
    console.log(`Simulated SMS (provider 'none'): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}. Settings:`, currentSystemSettings);
  } else if (farmer && !farmer.phone) {
    console.log(`SMS not sent for payment: Farmer ${farmer.name} has no phone number.`);
  } else if (!farmer) {
    console.log(`SMS not sent for payment: Farmer with ID ${payment.farmerId} not found.`);
  }


  revalidatePath("/payments");
  revalidatePath("/dashboard"); 
  return { success: true, message: `Payment for ${farmer?.name || 'farmer'} processed.` };
}

export async function processAllPendingPaymentsAction(): Promise<{ success: boolean; count: number; message?: string }> {
  const pendingPayments = paymentsStore.filter(p => p.status === 'pending');
  if (pendingPayments.length === 0) {
    return { success: false, count: 0, message: "No pending payments to process." };
  }

  const currentSystemSettings = await getSystemSettings(); // Fetch current settings once
  let processedCount = 0;

  for (const payment of pendingPayments) {
    const paymentIndex = paymentsStore.findIndex(p => p.id === payment.id);
    if (paymentIndex !== -1) {
      paymentsStore[paymentIndex].status = 'paid';
      paymentsStore[paymentIndex].lastPaymentDate = new Date().toISOString().split("T")[0];
      processedCount++;

      const farmer = farmersStore.find(f => f.id === payment.farmerId);
      if (farmer && farmer.phone && currentSystemSettings.smsProvider !== 'none') {
        try {
          const smsResult = await sendPaymentNotification({
            phoneNumber: farmer.phone,
            amount: payment.amountDue,
            period: payment.period,
          });
           console.log(`Payment SMS Notification Result for ${farmer.name || 'farmer ' + farmer.id}:`, smsResult); 
        } catch (error) {
          console.error(`Failed to call sendPaymentNotification flow for ${farmer.name || 'farmer ' + farmer.id}:`, error);
        }
      } else if (farmer && farmer.phone && currentSystemSettings.smsProvider === 'none') {
         console.log(`Simulated SMS (provider 'none'): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}. Settings:`, currentSystemSettings);
      } else if (farmer && !farmer.phone) {
        console.log(`SMS not sent for payment (batch): Farmer ${farmer.name} has no phone number.`);
      } else if (!farmer) {
        console.log(`SMS not sent for payment (batch): Farmer with ID ${payment.farmerId} not found.`);
      }
    }
  }

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { success: true, count: processedCount, message: `${processedCount} payments processed.` };
}

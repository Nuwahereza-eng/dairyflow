
"use server";

import { revalidatePath } from "next/cache";
import type { Payment, Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin";
import { sendPaymentNotification } from '@/ai/flows/payment-notification';
import { getSystemSettings } from '@/app/(app)/settings/actions';

export async function getPayments(farmerId?: string): Promise<Payment[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("payments");
    if (farmerId) {
      query = query.where("farmerId", "==", farmerId);
    }
    // Consider adding orderBy clauses if needed, e.g., query.orderBy("period", "desc");
    // This might require a new Firestore index if combined with the farmerId filter.

    const paymentsSnapshot = await query.get();
    const payments: Payment[] = [];

    // Optimized farmer name fetching
    let farmersMap: Map<string, string> | null = null;
    if (!farmerId) { // Only fetch all farmers if not filtering for a specific one
        const allFarmersSnapshot = await db.collection("farmers").get();
        farmersMap = new Map();
        allFarmersSnapshot.forEach(doc => {
            farmersMap!.set(doc.id, (doc.data() as Farmer).name);
        });
    }

    for (const doc of paymentsSnapshot.docs) {
      const paymentData = doc.data() as Omit<Payment, 'id' | 'farmerName'>;
      let farmerName = "Unknown Farmer";
      if (paymentData.farmerId) {
         if (farmersMap) {
            farmerName = farmersMap.get(paymentData.farmerId) || "Unknown Farmer (map)";
        } else if (farmerId && farmerId === paymentData.farmerId) { // If fetching for a specific farmer
            const farmerDoc = await db.collection("farmers").doc(paymentData.farmerId).get();
            if (farmerDoc.exists) {
                farmerName = (farmerDoc.data() as Farmer).name;
            }
        } else if (!farmerId) { // Fallback if not filtering by farmer (should ideally use map)
            const farmerDoc = await db.collection("farmers").doc(paymentData.farmerId).get();
            if (farmerDoc.exists) {
                farmerName = (farmerDoc.data() as Farmer).name;
            }
        }
      }
      payments.push({ 
        id: doc.id, 
        ...paymentData,
        farmerName 
      });
    }
    // Example sort if needed, adjust as per requirements
    // payments.sort((a, b) => (a.period > b.period ? -1 : 1) || (a.farmerName?.localeCompare(b.farmerName || '') || 0) );
    return payments;
  } catch (error) {
    console.error("Error fetching payments:", error);
    throw error; 
  }
}

export async function processSinglePaymentAction(paymentId: string): Promise<{ success: boolean; message?: string }> {
  const paymentRef = db.collection("payments").doc(paymentId);
  try {
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      return { success: false, message: "Payment record not found in Firestore." };
    }

    const payment = { id: paymentDoc.id, ...paymentDoc.data() } as Payment;
    if (payment.status === 'paid') {
      return { success: false, message: "Payment already processed." };
    }

    await paymentRef.update({
      status: 'paid',
      lastPaymentDate: new Date().toISOString().split("T")[0],
    });

    let farmer: Farmer | null = null;
    if (payment.farmerId) {
        const farmerDoc = await db.collection("farmers").doc(payment.farmerId).get();
        if (farmerDoc.exists) {
            farmer = {id: farmerDoc.id, ...farmerDoc.data()} as Farmer;
        }
    }
    
    const currentSystemSettings = await getSystemSettings();

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
      console.log(`Simulated SMS (provider 'none'): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}.`);
    } else if (farmer && !farmer.phone) {
      console.log(`SMS not sent for payment: Farmer ${farmer.name || farmer.id} has no E.164 phone number.`);
    } else if (!farmer) {
      console.log(`SMS not sent for payment: Farmer with ID ${payment.farmerId} not found.`);
    }

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { success: true, message: `Payment for ${farmer?.name || 'farmer ' + payment.farmerId} processed.` };
  } catch (error) {
    console.error("Error processing single payment:", error);
    return { success: false, message: "Failed to process payment due to a server error." };
  }
}

export async function processAllPendingPaymentsAction(): Promise<{ success: boolean; count: number; message?: string }> {
  try {
    const pendingPaymentsSnapshot = await db.collection("payments").where("status", "==", "pending").get();
    
    if (pendingPaymentsSnapshot.empty) {
      return { success: false, count: 0, message: "No pending payments to process." };
    }

    const currentSystemSettings = await getSystemSettings();
    let processedCount = 0;

    // Batch farmer lookups for efficiency
    const farmerIdsToFetch = Array.from(new Set(pendingPaymentsSnapshot.docs.map(doc => (doc.data() as Payment).farmerId).filter(id => id)));
    const farmersData = new Map<string, Farmer>();
    if(farmerIdsToFetch.length > 0) {
        const farmerDocs = await db.collection('farmers').where(db.FieldPath.documentId(), 'in', farmerIdsToFetch).get();
        farmerDocs.forEach(doc => farmersData.set(doc.id, {id: doc.id, ...doc.data()} as Farmer));
    }


    for (const doc of pendingPaymentsSnapshot.docs) {
      const payment = { id: doc.id, ...doc.data() } as Payment;
      const paymentRef = db.collection("payments").doc(doc.id);

      await paymentRef.update({
        status: 'paid',
        lastPaymentDate: new Date().toISOString().split("T")[0],
      });
      processedCount++;

      const farmer = payment.farmerId ? farmersData.get(payment.farmerId) : null;

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
        console.log(`Simulated SMS (provider 'none'): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}.`);
      } else if (farmer && !farmer.phone) {
        console.log(`SMS not sent for payment (batch): Farmer ${farmer.name || farmer.id} has no E.164 phone number.`);
      } else if (!farmer) {
        console.log(`SMS not sent for payment (batch): Farmer with ID ${payment.farmerId} not found.`);
      }
    }

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { success: true, count: processedCount, message: `${processedCount} payments processed.` };
  } catch (error: any) {
    console.error("Error processing all pending payments:", error);
    if (error.code === 9 /* FAILED_PRECONDITION for missing index */ || error.code === 5 /* FAILED_PRECONDITION also used for missing index */) {
         return { success: false, count: 0, message: `Query requires an index. Please create it in Firestore. Details: ${error.details || error.message}` };
    }
    return { success: false, count: 0, message: "Failed to process payments due to a server error." };
  }
}

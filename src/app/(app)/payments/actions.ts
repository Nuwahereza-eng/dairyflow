
"use server";

import { revalidatePath } from "next/cache";
import type { Payment, Farmer, Delivery } from "@/types";
import { db, admin } from "@/lib/firebaseAdmin"; // Ensure admin is imported for FieldPath if needed later
import { sendPaymentNotification } from '@/ai/flows/payment-notification';
import { getSystemSettings } from '@/app/(app)/settings/actions';
import { format, parse, startOfMonth, endOfMonth, isValid } from 'date-fns';

export async function getPayments(farmerId?: string): Promise<Payment[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("payments");
    if (farmerId) {
      query = query.where("farmerId", "==", farmerId);
    }
    // Order by period descending, then generatedDate descending for consistent listing
    query = query.orderBy("period", "desc").orderBy("generatedDate", "desc");
    
    const paymentsSnapshot = await query.get();
    const payments: Payment[] = [];

    let farmersMap: Map<string, string> | null = null;
    if (!farmerId) { 
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
            farmerName = farmersMap.get(paymentData.farmerId) || `Farmer ID: ${paymentData.farmerId.substring(0,5)}`;
        } else if (farmerId && farmerId === paymentData.farmerId) { 
            const farmerDoc = await db.collection("farmers").doc(paymentData.farmerId).get();
            if (farmerDoc.exists) {
                farmerName = (farmerDoc.data() as Farmer).name;
            }
        } else if (!farmerId) { 
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
    return payments;
  } catch (error) {
    console.error("Error fetching payments:", error);
    throw error; 
  }
}

export async function generatePendingPaymentsAction(
  period: string // Expected format "YYYY-MM"
): Promise<{ success: boolean; message: string; generatedCount?: number }> {
  const parsedPeriod = parse(period + '-01', 'yyyy-MM-dd', new Date());
  if (!isValid(parsedPeriod)) {
    return { success: false, message: "Invalid period format. Please use YYYY-MM." };
  }

  const startDate = format(startOfMonth(parsedPeriod), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(parsedPeriod), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  try {
    // 1. Get all deliveries within the specified period.
    const deliveriesSnapshot = await db.collection("deliveries")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    if (deliveriesSnapshot.empty) {
      return { success: false, message: `No deliveries found for period ${period}.` };
    }
    
    const allDeliveriesInPeriod = deliveriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery));

    // 2. Get all existing payments for the specified period to find already processed delivery IDs.
    const existingPaymentsSnapshot = await db.collection("payments")
      .where("period", "==", period)
      .get();
    
    const processedDeliveryIds = new Set<string>();
    existingPaymentsSnapshot.forEach(doc => {
      const payment = doc.data() as Payment;
      if (payment.deliveryIds) {
        payment.deliveryIds.forEach(id => processedDeliveryIds.add(id));
      }
    });

    // 3. Filter out deliveries that are already part of an existing payment for this period.
    const unpaidDeliveries = allDeliveriesInPeriod.filter(delivery => !processedDeliveryIds.has(delivery.id));

    if (unpaidDeliveries.length === 0) {
      return { success: false, message: `All deliveries for period ${period} have already been included in payments.` };
    }

    // 4. Group unpaid deliveries by farmerId.
    const deliveriesByFarmer = unpaidDeliveries.reduce((acc, delivery) => {
      if (!acc[delivery.farmerId]) {
        acc[delivery.farmerId] = [];
      }
      acc[delivery.farmerId].push(delivery);
      return acc;
    }, {} as Record<string, Delivery[]>);

    // 5. Create payment records for each farmer.
    const farmersMap = new Map<string, Farmer>();
    const farmerIds = Object.keys(deliveriesByFarmer);
    if (farmerIds.length > 0) {
        const farmersSnapshot = await db.collection('farmers').where(admin.firestore.FieldPath.documentId(), 'in', farmerIds).get();
        farmersSnapshot.forEach(doc => farmersMap.set(doc.id, {id: doc.id, ...doc.data()} as Farmer));
    }
    
    const batch = db.batch();
    let generatedCount = 0;

    for (const farmerId of farmerIds) {
      const farmerDeliveries = deliveriesByFarmer[farmerId];
      if (farmerDeliveries.length === 0) continue;

      const totalLiters = farmerDeliveries.reduce((sum, d) => sum + d.quantity, 0);
      const amountDue = farmerDeliveries.reduce((sum, d) => sum + d.amount, 0);
      const deliveryIdsForThisPayment = farmerDeliveries.map(d => d.id);
      const farmerName = farmersMap.get(farmerId)?.name || `Farmer ${farmerId.substring(0,5)}`;

      const paymentData: Omit<Payment, 'id'> = {
        farmerId,
        farmerName,
        period,
        totalLiters,
        amountDue,
        status: 'pending',
        deliveryIds: deliveryIdsForThisPayment,
        generatedDate: today,
        // paymentMethod and transactionId will be set when paid
      };
      const paymentRef = db.collection("payments").doc(); // Auto-generate ID
      batch.set(paymentRef, paymentData);
      generatedCount++;
    }

    if (generatedCount > 0) {
      await batch.commit();
      revalidatePath("/payments");
      revalidatePath("/dashboard"); // Pending payments count might change
      return { success: true, message: `Successfully generated ${generatedCount} pending payment(s) for period ${period}.`, generatedCount };
    } else {
      return { success: false, message: "No new pending payments were generated. Deliveries might already be covered or none found." };
    }

  } catch (error: any) {
    console.error("Error generating pending payments:", error);
    if (error.code === 5 || error.code === 9) { // Firestore permission/index errors
        return { success: false, message: `Firestore error: ${error.message}. Ensure necessary indexes are created for querying deliveries by date range.` };
    }
    return { success: false, message: `Failed to generate payments: ${error.message}` };
  }
}


export async function processSinglePaymentAction(
  paymentId: string,
  paymentMethod: 'cash' | 'bank' | 'mobile_money',
  transactionId?: string
): Promise<{ success: boolean; message?: string }> {
  const paymentRef = db.collection("payments").doc(paymentId);
  try {
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      return { success: false, message: "Payment record not found." };
    }

    const payment = { id: paymentDoc.id, ...paymentDoc.data() } as Payment;
    if (payment.status === 'paid') {
      return { success: false, message: "Payment already processed." };
    }

    const updateData: Partial<Payment> = {
      status: 'paid',
      lastPaymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: paymentMethod,
    };
    if (transactionId && (paymentMethod === 'bank' || paymentMethod === 'mobile_money')) {
      updateData.transactionId = transactionId;
    }
    await paymentRef.update(updateData);

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
        // Consider enhancing SMS to include payment method if desired
        const smsResult = await sendPaymentNotification({
          phoneNumber: farmer.phone,
          amount: payment.amountDue,
          period: payment.period,
        });
        console.log(`Payment SMS Notification (Method: ${paymentMethod}):`, smsResult);
      } catch (error) {
        console.error("Failed to call sendPaymentNotification flow for single payment:", error);
      }
    } else if (farmer && farmer.phone && currentSystemSettings.smsProvider === 'none') {
      console.log(`Simulated SMS (provider 'none', Method: ${paymentMethod}): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}.`);
    } else if (farmer && !farmer.phone) {
      console.log(`SMS not sent for payment: Farmer ${farmer.name || farmer.id} has no E.164 phone number.`);
    } else if (!farmer) {
      console.log(`SMS not sent for payment: Farmer with ID ${payment.farmerId} not found.`);
    }

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { success: true, message: `Payment for ${payment.farmerName || 'farmer ' + payment.farmerId} (Method: ${paymentMethod}) processed.` };
  } catch (error: any) {
    console.error("Error processing single payment:", error);
    return { success: false, message: `Failed to process payment: ${error.message}` };
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

    const farmerIdsToFetch = Array.from(new Set(pendingPaymentsSnapshot.docs.map(doc => (doc.data() as Payment).farmerId).filter(id => id)));
    const farmersData = new Map<string, Farmer>();
    if(farmerIdsToFetch.length > 0) {
        const farmerDocs = await db.collection('farmers').where(admin.firestore.FieldPath.documentId(), 'in', farmerIdsToFetch).get();
        farmerDocs.forEach(doc => farmersData.set(doc.id, {id: doc.id, ...doc.data()} as Farmer));
    }

    for (const doc of pendingPaymentsSnapshot.docs) {
      const payment = { id: doc.id, ...doc.data() } as Payment;
      const paymentRef = db.collection("payments").doc(doc.id);

      // Batch processing will not set a specific paymentMethod here.
      await paymentRef.update({
        status: 'paid',
        lastPaymentDate: new Date().toISOString().split("T")[0],
        // paymentMethod is intentionally not set here for batch action
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
          console.log(`Payment SMS Notification Result (Batch) for ${farmer.name || 'farmer ' + farmer.id}:`, smsResult);
        } catch (error) {
          console.error(`Failed to call sendPaymentNotification flow (Batch) for ${farmer.name || 'farmer ' + farmer.id}:`, error);
        }
      } else if (farmer && farmer.phone && currentSystemSettings.smsProvider === 'none') {
        console.log(`Simulated SMS (provider 'none', Batch): Payment to ${farmer.phone} of UGX ${payment.amountDue} for ${payment.period}.`);
      } else if (farmer && !farmer.phone) {
        console.log(`SMS not sent for payment (batch): Farmer ${farmer.name || farmer.id} has no E.164 phone number.`);
      } else if (!farmer) {
        console.log(`SMS not sent for payment (batch): Farmer with ID ${payment.farmerId} not found.`);
      }
    }

    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return { success: true, count: processedCount, message: `${processedCount} payments processed (batch). Payment methods not set.` };
  } catch (error: any) {
    console.error("Error processing all pending payments:", error);
    if (error.code === 9 || error.code === 5 ) {
         return { success: false, count: 0, message: `Query requires an index. Please create it in Firestore. Details: ${error.details || error.message}` };
    }
    return { success: false, count: 0, message: `Failed to process payments: ${error.message}` };
  }
}

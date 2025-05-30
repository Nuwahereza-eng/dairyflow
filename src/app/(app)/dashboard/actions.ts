
'use server';

import { db } from '@/lib/firebaseAdmin';
import type { Delivery, Farmer } from '@/types';
import { format } from 'date-fns';

export interface DashboardStats {
  totalFarmers?: number; // Only for admin/operator
  farmerName?: string; // Only for farmer view
  farmerIdSnippet?: string; // Only for farmer view
  todaysDeliveriesCount: number;
  todaysLiters: number;
  pendingPaymentsCount: number;
}

export async function getDashboardStats(currentUserId?: string, currentUserRole?: string): Promise<DashboardStats> {
  const today = format(new Date(), 'yyyy-MM-dd');
  let totalFarmers: number | undefined = undefined;
  let farmerName: string | undefined = undefined;
  let farmerIdSnippet: string | undefined = undefined;

  let todaysDeliveriesQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('deliveries').where('date', '==', today);
  let pendingPaymentsQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('payments').where('status', '==', 'pending');

  if (currentUserRole === 'farmer' && currentUserId) {
    todaysDeliveriesQuery = todaysDeliveriesQuery.where('farmerId', '==', currentUserId);
    pendingPaymentsQuery = pendingPaymentsQuery.where('farmerId', '==', currentUserId);
    const farmerDoc = await db.collection('farmers').doc(currentUserId).get();
    if (farmerDoc.exists) {
      const farmerData = farmerDoc.data() as Farmer;
      farmerName = farmerData.name;
      farmerIdSnippet = currentUserId.substring(0,8) + '...';
    }
  } else { // Admin or Operator
    const farmersCountSnapshot = await db.collection('farmers').count().get();
    totalFarmers = farmersCountSnapshot.data().count;
  }

  // Perform snapshots and counts
  const [todaysDeliveriesSnapshot, pendingPaymentsCountSnapshot] = await Promise.all([
    todaysDeliveriesQuery.get(),
    pendingPaymentsQuery.count().get(),
  ]);

  let todaysLiters = 0;
  todaysDeliveriesSnapshot.forEach(doc => {
    todaysLiters += (doc.data() as Delivery).quantity;
  });

  return {
    totalFarmers,
    farmerName,
    farmerIdSnippet,
    todaysDeliveriesCount: todaysDeliveriesSnapshot.size,
    todaysLiters,
    pendingPaymentsCount: pendingPaymentsCountSnapshot.data().count,
  };
}

export async function getRecentDeliveriesForDashboard(limit: number, currentUserId?: string, currentUserRole?: string): Promise<Delivery[]> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('deliveries')
                .orderBy('date', 'desc')
                .orderBy('time', 'desc');


  if (currentUserRole === 'farmer' && currentUserId) {
    // For a farmer, filter by their ID. The orderBy clauses will then apply to their deliveries.
    // This specific combination might require a composite index: farmerId ASC, date DESC, time DESC
    query = query.where('farmerId', '==', currentUserId);
  }
  
  query = query.limit(limit); // Apply limit after all filters and orders

  const snapshot = await query.get();
  const deliveries: Delivery[] = [];

  const farmerIds = Array.from(new Set(snapshot.docs.map(doc => (doc.data() as Delivery).farmerId).filter(id => !!id)));
  const farmersMap = new Map<string, string>();

  if (farmerIds.length > 0) {
    // Fetch names only for the farmers involved in these recent deliveries
    const farmersSnapshot = await db.collection('farmers').where(db.FieldPath.documentId(), 'in', farmerIds).get();
    farmersSnapshot.forEach(doc => {
      farmersMap.set(doc.id, (doc.data() as Farmer).name);
    });
  }

  for (const doc of snapshot.docs) {
    const data = doc.data() as Omit<Delivery, 'id' | 'farmerName'>;
    let farmerNameDisplay = "Unknown Farmer";
    if (data.farmerId) {
        if (currentUserRole === 'farmer' && currentUserId === data.farmerId && farmersMap.has(data.farmerId)) {
            // If it's the farmer's own view and we've already fetched their name
             farmerNameDisplay = farmersMap.get(data.farmerId) || "Your Delivery";
        } else {
             farmerNameDisplay = farmersMap.get(data.farmerId) || "Unknown Farmer";
        }
    }
    deliveries.push({
      id: doc.id,
      ...data,
      farmerName: farmerNameDisplay,
    });
  }
  return deliveries;
}


"use server";

import type { Delivery, Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin";
// import { getSystemSettings } from '@/app/(app)/settings/actions'; // For milk price if needed

interface DailyReportData {
  totalDeliveries: number;
  totalLiters: number;
  totalValue: number;
  averagePerDelivery: number;
  deliveries: Delivery[];
}

interface FarmerReportDataItem {
  farmerName: string;
  deliveriesCount: number;
  totalLiters: number;
  amountDue: number;
}
interface FarmerReportData {
  farmersData: FarmerReportDataItem[];
}

interface MonthlySummaryData { // This is a period summary
  totalDeliveries: number;
  gradeACount: number;
  gradeBCount: number;
  gradeCCount: number;
  gradeALiters: number;
  gradeBLiters: number;
  gradeCLiters: number;
}

interface QualityReportData {
  gradeALiters: number;
  gradeBLiters: number;
  gradeCLiters: number;
  totalLiters: number;
  gradeAPercentage: number;
  gradeBPercentage: number;
  gradeCPercentage: number;
  qualityScore: number;
}

interface FarmerStatementData {
  farmerDetails: Pick<Farmer, 'id' | 'name' | 'phone' | 'location'>;
  deliveries: Delivery[];
  totalLitersDelivered: number;
  totalAmountForDeliveries: number;
  periodStartDate?: string;
  periodEndDate?: string;
}

async function getAllFarmersMap(): Promise<Map<string, Pick<Farmer, 'id' | 'name' | 'phone' | 'location'>>> {
  const farmersSnapshot = await db.collection("farmers").get();
  const farmersMap = new Map<string, Pick<Farmer, 'id' | 'name' | 'phone' | 'location'>>();
  farmersSnapshot.forEach(doc => {
    const farmerData = doc.data() as Farmer;
    farmersMap.set(doc.id, { id: doc.id, name: farmerData.name, phone: farmerData.phone, location: farmerData.location });
  });
  return farmersMap;
}

async function getFilteredDeliveries(startDate?: string, endDate?: string, farmerId?: string): Promise<Delivery[]> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("deliveries");

  if (farmerId) {
    query = query.where("farmerId", "==", farmerId);
  }
  if (startDate) {
    query = query.where("date", ">=", startDate);
  }
  if (endDate) {
    query = query.where("date", "<=", endDate);
  }
  // Default ordering, might need an index if not already present for 'date' and 'farmerId'
  // Firestore requires the first orderBy field to be the same as the inequality filter field if multiple exist.
  if (farmerId && startDate) {
     // If filtering by farmerId and date, ensure correct indexing for this composite query.
     // Example: farmerId (asc), date (asc), time (asc)
     query = query.orderBy("date", "asc").orderBy("time", "asc");
  } else if (startDate || endDate) {
    query = query.orderBy("date", "asc").orderBy("time", "asc");
  } else if (farmerId) {
    // if only farmerId, order by date and time for consistency
    query = query.orderBy("date", "asc").orderBy("time", "asc");
  } else {
    // Default for general reports without specific farmer
    query = query.orderBy("date", "asc").orderBy("time", "asc");
  }


  const deliveriesSnapshot = await query.get();
  const deliveries: Delivery[] = [];
  const farmersMap = await getAllFarmersMap(); // Fetch all farmers once for name mapping

  deliveriesSnapshot.forEach(doc => {
    const data = doc.data() as Omit<Delivery, 'id' | 'farmerName'>;
    deliveries.push({
      id: doc.id,
      ...data,
      farmerName: farmersMap.get(data.farmerId)?.name || "Unknown Farmer",
    });
  });
  return deliveries;
}


export async function generateReportData(
  reportType: 'daily' | 'farmer' | 'monthly' | 'quality' | 'farmer_statement',
  startDate?: string,
  endDate?: string,
  farmerIdForStatement?: string
): Promise<DailyReportData | FarmerReportData | MonthlySummaryData | QualityReportData | FarmerStatementData | { error: string }> {
  
  try {
    const allFarmersMap = await getAllFarmersMap();

    if (reportType === 'farmer_statement') {
      if (!farmerIdForStatement) {
        return { error: "Farmer ID is required for Farmer Statement." };
      }
      const farmerDetails = allFarmersMap.get(farmerIdForStatement);
      if (!farmerDetails) {
        return { error: `Farmer with ID ${farmerIdForStatement} not found.` };
      }

      const farmerDeliveries = await getFilteredDeliveries(startDate, endDate, farmerIdForStatement);
      const totalLitersDelivered = farmerDeliveries.reduce((sum, d) => sum + d.quantity, 0);
      const totalAmountForDeliveries = farmerDeliveries.reduce((sum, d) => sum + d.amount, 0);

      return {
        farmerDetails,
        deliveries: farmerDeliveries,
        totalLitersDelivered,
        totalAmountForDeliveries,
        periodStartDate: startDate,
        periodEndDate: endDate,
      };
    }

    // For other reports, filteredDeliveries doesn't use farmerIdForStatement
    const filteredDeliveries = await getFilteredDeliveries(startDate, endDate);
    const allFarmersList: Pick<Farmer, 'id' | 'name' | 'phone' | 'location'>[] = Array.from(allFarmersMap.values());


    switch (reportType) {
      case 'daily': {
        const totalLiters = filteredDeliveries.reduce((sum, d) => sum + d.quantity, 0);
        const totalValue = filteredDeliveries.reduce((sum, d) => sum + d.amount, 0);
        return {
          totalDeliveries: filteredDeliveries.length,
          totalLiters,
          totalValue,
          averagePerDelivery: filteredDeliveries.length > 0 ? totalLiters / filteredDeliveries.length : 0,
          deliveries: filteredDeliveries.slice(0, 100), 
        };
      }
      case 'farmer': {
        const farmersData: FarmerReportDataItem[] = allFarmersList.map(farmer => {
          const farmerDeliveries = filteredDeliveries.filter(d => d.farmerId === farmer.id);
          const totalLiters = farmerDeliveries.reduce((sum, d) => sum + d.quantity, 0);
          const amountDue = farmerDeliveries.reduce((sum, d) => sum + d.amount, 0); 
          return {
            farmerName: farmer.name,
            deliveriesCount: farmerDeliveries.length,
            totalLiters,
            amountDue,
          };
        }).filter(f => f.deliveriesCount > 0); 
        return { farmersData };
      }
      case 'monthly': { 
        const gradeACount = filteredDeliveries.filter(d => d.quality === 'A').length;
        const gradeBCount = filteredDeliveries.filter(d => d.quality === 'B').length;
        const gradeCCount = filteredDeliveries.filter(d => d.quality === 'C').length;
        const gradeALiters = filteredDeliveries.filter(d => d.quality === 'A').reduce((sum, d) => sum + d.quantity, 0);
        const gradeBLiters = filteredDeliveries.filter(d => d.quality === 'B').reduce((sum, d) => sum + d.quantity, 0);
        const gradeCLiters = filteredDeliveries.filter(d => d.quality === 'C').reduce((sum, d) => sum + d.quantity, 0);
        return {
          totalDeliveries: filteredDeliveries.length,
          gradeACount,
          gradeBCount,
          gradeCCount,
          gradeALiters,
          gradeBLiters,
          gradeCLiters,
        };
      }
      case 'quality': {
        const gradeALiters = filteredDeliveries.filter(d => d.quality === 'A').reduce((sum, d) => sum + d.quantity, 0);
        const gradeBLiters = filteredDeliveries.filter(d => d.quality === 'B').reduce((sum, d) => sum + d.quantity, 0);
        const gradeCLiters = filteredDeliveries.filter(d => d.quality === 'C').reduce((sum, d) => sum + d.quantity, 0);
        const totalLiters = gradeALiters + gradeBLiters + gradeCLiters;

        if (totalLiters === 0) {
          return { 
            gradeALiters: 0, gradeBLiters: 0, gradeCLiters: 0, totalLiters: 0,
            gradeAPercentage: 0, gradeBPercentage: 0, gradeCPercentage: 0, qualityScore: 0
          };
        }
        
        const qualityScore = ((gradeALiters * 100) + (gradeBLiters * 90) + (gradeCLiters * 80)) / totalLiters;

        return {
          gradeALiters,
          gradeBLiters,
          gradeCLiters,
          totalLiters,
          gradeAPercentage: (gradeALiters / totalLiters) * 100,
          gradeBPercentage: (gradeBLiters / totalLiters) * 100,
          gradeCPercentage: (gradeCLiters / totalLiters) * 100,
          qualityScore,
        };
      }
      default:
        const exhaustiveCheck: never = reportType; 
        return { error: `Invalid report type: ${exhaustiveCheck}` };
    }
  } catch (error: any) {
    console.error("Error generating report data:", error);
    if (error.code === 5 || error.code === 9 ) {
         return { error: `Firestore error: ${error.message}. Ensure collections exist and any required indexes (e.g., for date filtering on deliveries, or farmerId + date) are built.` };
    }
    return { error: "Failed to generate report data due to a server error." };
  }
}

export async function getReportFarmers(): Promise<Pick<Farmer, 'id' | 'name'>[]> {
  try {
    const farmersSnapshot = await db.collection("farmers").orderBy("name").get();
    const farmers: Pick<Farmer, 'id' | 'name'>[] = [];
    farmersSnapshot.forEach((doc) => {
      const farmerData = doc.data();
      farmers.push({ id: doc.id, name: farmerData.name });
    });
    return farmers;
  } catch (error) {
    console.error("Error fetching farmers for report selection:", error);
    return [];
  }
}

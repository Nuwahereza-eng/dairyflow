
"use server";

import type { Delivery, Farmer } from "@/types";
import { db } from "@/lib/firebaseAdmin";
import { getSystemSettings } from '@/app/(app)/settings/actions'; // For milk price if needed

interface DailyReportData {
  totalDeliveries: number;
  totalLiters: number;
  totalValue: number;
  averagePerDelivery: number;
  deliveries: Delivery[]; // Deliveries will include farmerName
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

interface MonthlySummaryData {
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
  qualityScore: number; // Example: weighted average
}

async function getAllFarmersMap(): Promise<Map<string, string>> {
  const farmersSnapshot = await db.collection("farmers").get();
  const farmersMap = new Map<string, string>();
  farmersSnapshot.forEach(doc => {
    const farmerData = doc.data() as Farmer;
    farmersMap.set(doc.id, farmerData.name);
  });
  return farmersMap;
}

async function getFilteredDeliveries(startDate?: string, endDate?: string): Promise<Delivery[]> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("deliveries");

  if (startDate) {
    query = query.where("date", ">=", startDate);
  }
  if (endDate) {
    query = query.where("date", "<=", endDate);
  }
  // Default ordering, might need an index if not already present for 'date'
  query = query.orderBy("date", "asc").orderBy("time", "asc");


  const deliveriesSnapshot = await query.get();
  const deliveries: Delivery[] = [];
  const farmersMap = await getAllFarmersMap();

  deliveriesSnapshot.forEach(doc => {
    const data = doc.data() as Omit<Delivery, 'id' | 'farmerName'>;
    deliveries.push({
      id: doc.id,
      ...data,
      farmerName: farmersMap.get(data.farmerId) || "Unknown Farmer",
    });
  });
  return deliveries;
}


export async function generateReportData(
  reportType: 'daily' | 'farmer' | 'monthly' | 'quality',
  startDate?: string,
  endDate?: string
): Promise<DailyReportData | FarmerReportData | MonthlySummaryData | QualityReportData | { error: string }> {
  
  try {
    const filteredDeliveries = await getFilteredDeliveries(startDate, endDate);
    const allFarmersSnapshot = await db.collection("farmers").get();
    const allFarmers: Farmer[] = [];
    allFarmersSnapshot.forEach(doc => allFarmers.push({ id: doc.id, ...doc.data() } as Farmer));


    switch (reportType) {
      case 'daily': {
        const totalLiters = filteredDeliveries.reduce((sum, d) => sum + d.quantity, 0);
        const totalValue = filteredDeliveries.reduce((sum, d) => sum + d.amount, 0);
        return {
          totalDeliveries: filteredDeliveries.length,
          totalLiters,
          totalValue,
          averagePerDelivery: filteredDeliveries.length > 0 ? totalLiters / filteredDeliveries.length : 0,
          deliveries: filteredDeliveries.slice(0, 100), // Limit for display to avoid overly large reports
        };
      }
      case 'farmer': {
        const farmersData: FarmerReportDataItem[] = allFarmers.map(farmer => {
          const farmerDeliveries = filteredDeliveries.filter(d => d.farmerId === farmer.id);
          const totalLiters = farmerDeliveries.reduce((sum, d) => sum + d.quantity, 0);
          const amountDue = farmerDeliveries.reduce((sum, d) => sum + d.amount, 0); // Assumes delivery.amount is correct
          return {
            farmerName: farmer.name,
            deliveriesCount: farmerDeliveries.length,
            totalLiters,
            amountDue,
          };
        }).filter(f => f.deliveriesCount > 0); // Only include farmers with deliveries in the period
        return { farmersData };
      }
      case 'monthly': { // This is more of a "period summary" now
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
        
        // Example quality score: Grade A = 100, B = 90, C = 80
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
        // This should be caught by TypeScript, but as a fallback
        const exhaustiveCheck: never = reportType; 
        return { error: `Invalid report type: ${exhaustiveCheck}` };
    }
  } catch (error: any) {
    console.error("Error generating report data:", error);
    if (error.code === 5 /* NOT_FOUND for missing collection perhaps */ || error.code === 9 /* FAILED_PRECONDITION for missing index */) {
         return { error: `Firestore error: ${error.message}. Ensure collections exist and any required indexes are built.` };
    }
    return { error: "Failed to generate report data due to a server error." };
  }
}

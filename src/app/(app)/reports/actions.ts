"use server";

import type { Delivery, Farmer, Payment } from "@/types";
import { initialDeliveries, initialFarmers, initialPayments } from "@/lib/mockData";

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

interface MonthlySummaryData {
  totalDeliveries: number;
  gradeA L: number;
  gradeB L: number;
  gradeC L: number;
  gradeALiters: number;
  gradeBLiters: number;
  gradeCLiters: number;
}

interface QualityReportData {
  gradeALiters: number;
  gradeBLiters: number;
  gradeCLiters:
  totalLiters: number;
  gradeAPercentage: number;
  gradeBPercentage: number;
  gradeCPercentage: number;
  qualityScore: number; // Example: weighted average
}


export async function generateReportData(
  reportType: 'daily' | 'farmer' | 'monthly' | 'quality',
  startDate?: string,
  endDate?: string
): Promise<DailyReportData | FarmerReportData | MonthlySummaryData | QualityReportData | { error: string }> {
  
  let filteredDeliveries = initialDeliveries.map(d => {
    const farmer = initialFarmers.find(f => f.id === d.farmerId);
    return { ...d, farmerName: farmer?.name || "Unknown Farmer" };
  });

  if (startDate) {
    filteredDeliveries = filteredDeliveries.filter(d => d.date >= startDate);
  }
  if (endDate) {
    filteredDeliveries = filteredDeliveries.filter(d => d.date <= endDate);
  }

  switch (reportType) {
    case 'daily': {
      const totalLiters = filteredDeliveries.reduce((sum, d) => sum + d.quantity, 0);
      const totalValue = filteredDeliveries.reduce((sum, d) => sum + d.amount, 0);
      return {
        totalDeliveries: filteredDeliveries.length,
        totalLiters,
        totalValue,
        averagePerDelivery: filteredDeliveries.length > 0 ? totalLiters / filteredDeliveries.length : 0,
        deliveries: filteredDeliveries.slice(0, 50), // Limit for display
      };
    }
    case 'farmer': {
      const farmersData: FarmerReportDataItem[] = initialFarmers.map(farmer => {
        const farmerDeliveries = filteredDeliveries.filter(d => d.farmerId === farmer.id);
        const totalLiters = farmerDeliveries.reduce((sum, d) => sum + d.quantity, 0);
        const amountDue = farmerDeliveries.reduce((sum, d) => sum + d.amount, 0);
        return {
          farmerName: farmer.name,
          deliveriesCount: farmerDeliveries.length,
          totalLiters,
          amountDue,
        };
      });
      return { farmersData };
    }
    case 'monthly': { // Simplified monthly - assumes filtered range is the "month"
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
      return { error: "Invalid report type" };
  }
}


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportDisplay } from "@/components/reports/ReportDisplay";
import { generateReportData } from "./actions";
import { Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Ensure this import is present for the autoTable plugin
import type { Delivery } from "@/types"; // For typing reportData if needed
import { format } from 'date-fns';

// Extend jsPDF with autoTable - this is usually done by importing 'jspdf-autotable'
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'daily' | 'farmer' | 'monthly' | 'quality' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    if (!reportType) {
      toast({ variant: "destructive", title: "Error", description: "Please select a report type." });
      return;
    }
    setIsLoading(true);
    setReportData(null);
    try {
      const data = await generateReportData(reportType, startDate, endDate);
      if (data && 'error' in data && data.error) {
        toast({ variant: "destructive", title: "Report Generation Failed", description: data.error });
        setReportData(null);
      } else {
        setReportData(data);
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not generate report data." });
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!reportData || !reportType || (reportData && 'error' in reportData && reportData.error)) {
      toast({ title: "No Data", description: "Generate a report first to export.", variant: "default" });
      return;
    }

    const doc = new jsPDF();
    const periodString = `Period: ${startDate ? format(new Date(startDate+"T00:00:00"),'PP') : 'Start'} to ${endDate ? format(new Date(endDate+"T00:00:00"),'PP') : 'End'}`;
    const fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
    let yPos = 20; // Initial Y position for text

    doc.setFontSize(16);
    doc.text(reportType.charAt(0).toUpperCase() + reportType.slice(1) + " Report", 14, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.text(periodString, 14, yPos);
    yPos += 10;


    if (reportType === 'daily' && reportData.deliveries) {
      const head = [["Date", "Time", "Farmer", "Qty (L)", "Quality", "Amount (UGX)"]];
      const body = reportData.deliveries.map((d: Delivery) => [
        format(new Date(d.date + 'T00:00:00'), 'PP'),
        d.time,
        d.farmerName || "N/A",
        (d.quantity || 0).toFixed(1),
        d.quality,
        (d.amount || 0).toLocaleString()
      ]);
      doc.autoTable({ head, body, startY: yPos });
    } else if (reportType === 'farmer' && reportData.farmersData) {
      const head = [["Farmer Name", "Deliveries", "Total Liters (L)", "Amount Due (UGX)"]];
      const body = reportData.farmersData.map((f: any) => [
        f.farmerName,
        f.deliveriesCount || 0,
        (f.totalLiters || 0).toFixed(1),
        (f.amountDue || 0).toLocaleString()
      ]);
      doc.autoTable({ head, body, startY: yPos });
    } else if (reportType === 'monthly' && reportData) {
       doc.setFontSize(12);
       doc.text("Summary:", 14, yPos); yPos += 7;
       doc.setFontSize(10);
       doc.text(`Total Deliveries: ${(reportData.totalDeliveries || 0).toLocaleString()}`, 14, yPos); yPos += 7;
       doc.text(`Grade A Deliveries: ${(reportData.gradeACount || 0).toLocaleString()} (${(reportData.gradeALiters || 0).toFixed(1)} L)`, 14, yPos); yPos += 7;
       doc.text(`Grade B Deliveries: ${(reportData.gradeBCount || 0).toLocaleString()} (${(reportData.gradeBLiters || 0).toFixed(1)} L)`, 14, yPos); yPos += 7;
       doc.text(`Grade C Deliveries: ${(reportData.gradeCCount || 0).toLocaleString()} (${(reportData.gradeCLiters || 0).toFixed(1)} L)`, 14, yPos);
    } else if (reportType === 'quality' && reportData) {
       doc.setFontSize(12);
       doc.text("Quality Analysis:", 14, yPos); yPos += 7;
       doc.setFontSize(10);
       doc.text(`Total Liters Analyzed: ${(reportData.totalLiters || 0).toFixed(1)} L`, 14, yPos); yPos += 7;
       doc.text(`Grade A: ${(reportData.gradeALiters || 0).toFixed(1)} L (${(reportData.gradeAPercentage || 0).toFixed(1)}%)`, 14, yPos); yPos += 7;
       doc.text(`Grade B: ${(reportData.gradeBLiters || 0).toFixed(1)} L (${(reportData.gradeBPercentage || 0).toFixed(1)}%)`, 14, yPos); yPos += 7;
       doc.text(`Grade C: ${(reportData.gradeCLiters || 0).toFixed(1)} L (${(reportData.gradeCPercentage || 0).toFixed(1)}%)`, 14, yPos); yPos += 7;
       doc.text(`Overall Quality Score: ${(reportData.qualityScore || 0).toFixed(1)}%`, 14, yPos);
    } else {
       doc.text("No data available for this report type or export not fully supported.", 14, yPos);
    }
    
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and view system reports." />

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-6 w-6 text-primary" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as any)}>
                <SelectTrigger id="reportType" className="mt-1">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Collection</SelectItem>
                  <SelectItem value="farmer">Farmer Payments</SelectItem>
                  <SelectItem value="monthly">Monthly Summary</SelectItem>
                  <SelectItem value="quality">Quality Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerateReport} disabled={isLoading || !reportType} className="w-full shadow-md">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
              <Button onClick={exportToPDF} variant="outline" disabled={!reportData || (reportData && 'error' in reportData && reportData.error)} className="w-full shadow-md">
                 <Download className="mr-2 h-4 w-4" /> Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Generating report...</p>
        </div>
      ) : (
        <ReportDisplay reportType={reportType || null} data={reportData} startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
}

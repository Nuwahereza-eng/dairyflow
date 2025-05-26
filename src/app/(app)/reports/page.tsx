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
import { initialDeliveries, initialFarmers } from "@/lib/mockData"; // For CSV export

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
      setReportData(data);
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not generate report data." });
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData || !reportType || reportData.error) {
      toast({ title: "No Data", description: "Generate a report first to export.", variant: "default" });
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    let fileName = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'daily' && reportData.deliveries) {
      csvContent += "Date,Time,Farmer,Quantity (L),Quality,Amount (UGX)\n";
      reportData.deliveries.forEach((d: any) => {
        csvContent += `${d.date},${d.time},"${d.farmerName}",${d.quantity},${d.quality},${d.amount}\n`;
      });
    } else if (reportType === 'farmer' && reportData.farmersData) {
      csvContent += "Farmer Name,Deliveries Count,Total Liters (L),Amount Due (UGX)\n";
      reportData.farmersData.forEach((f: any) => {
        csvContent += `"${f.farmerName}",${f.deliveriesCount},${f.totalLiters},${f.amountDue}\n`;
      });
    } else {
       toast({ title: "Export Not Supported", description: `CSV export for '${reportType}' report is not fully implemented for this data structure.`, variant: "default" });
       return;
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              <Button onClick={exportToCSV} variant="outline" disabled={!reportData || reportData.error} className="w-full shadow-md">
                 <Download className="mr-2 h-4 w-4" /> Export CSV
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

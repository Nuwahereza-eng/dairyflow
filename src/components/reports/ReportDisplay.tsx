"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Delivery } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';

interface ReportDisplayProps {
  reportType: 'daily' | 'farmer' | 'monthly' | 'quality' | null;
  data: any; // This will be typed based on reportType
  startDate?: string;
  endDate?: string;
}

export function ReportDisplay({ reportType, data, startDate, endDate }: ReportDisplayProps) {
  if (!reportType || !data || data.error) {
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Report Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{data?.error || "Select report type and date range, then click 'Generate Report'."}</p>
        </CardContent>
      </Card>
    );
  }

  const periodString = `Period: ${startDate ? format(new Date(startDate+"T00:00:00"),'PP') : 'Start'} to ${endDate ? format(new Date(endDate+"T00:00:00"),'PP') : 'End'}`;

  if (reportType === 'daily' && data) {
    const reportData = data as { totalDeliveries: number, totalLiters: number, totalValue: number, averagePerDelivery: number, deliveries: Delivery[] };
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Daily Collection Report</CardTitle>
          <p className="text-sm text-muted-foreground">{periodString}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Total Deliveries</p><p className="text-xl font-bold">{reportData.totalDeliveries}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Liters</p><p className="text-xl font-bold">{reportData.totalLiters.toFixed(1)} L</p></div>
            <div><p className="text-xs text-muted-foreground">Total Value</p><p className="text-xl font-bold">UGX {reportData.totalValue.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Avg. per Delivery</p><p className="text-xl font-bold">{reportData.averagePerDelivery.toFixed(1)} L</p></div>
          </div>
          <h4 className="font-semibold mt-4">Sample Deliveries (Max 50):</h4>
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Farmer</TableHead><TableHead>Qty (L)</TableHead><TableHead>Quality</TableHead><TableHead>Amount (UGX)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.deliveries.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{format(new Date(d.date+"T00:00:00"),'PP')}</TableCell><TableCell>{d.farmerName}</TableCell><TableCell>{d.quantity.toFixed(1)}</TableCell><TableCell>{d.quality}</TableCell><TableCell>{d.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  if (reportType === 'farmer' && data) {
    const reportData = data as { farmersData: { farmerName: string, deliveriesCount: number, totalLiters: number, amountDue: number }[] };
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Farmer Payment Report</CardTitle>
           <p className="text-sm text-muted-foreground">{periodString}</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer</TableHead><TableHead>Deliveries</TableHead><TableHead>Total Liters (L)</TableHead><TableHead>Amount Due (UGX)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.farmersData.map(f => (
                  <TableRow key={f.farmerName}>
                    <TableCell>{f.farmerName}</TableCell><TableCell>{f.deliveriesCount}</TableCell><TableCell>{f.totalLiters.toFixed(1)}</TableCell><TableCell>{f.amountDue.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }
  
  if (reportType === 'monthly' && data) {
     const reportData = data as { totalDeliveries: number, gradeACount: number, gradeBCount: number, gradeCCount: number, gradeALiters: number, gradeBLiters: number, gradeCLiters: number };
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Summary Report</CardTitle>
          <p className="text-sm text-muted-foreground">{periodString}</p>
        </CardHeader>
        <CardContent className="space-y-2">
            <p><strong>Total Deliveries:</strong> {reportData.totalDeliveries.toLocaleString()}</p>
            <p><strong>Grade A Deliveries:</strong> {reportData.gradeACount.toLocaleString()} ({reportData.gradeALiters.toFixed(1)} L)</p>
            <p><strong>Grade B Deliveries:</strong> {reportData.gradeBCount.toLocaleString()} ({reportData.gradeBLiters.toFixed(1)} L)</p>
            <p><strong>Grade C Deliveries:</strong> {reportData.gradeCCount.toLocaleString()} ({reportData.gradeCLiters.toFixed(1)} L)</p>
        </CardContent>
      </Card>
    );
  }

  if (reportType === 'quality' && data) {
    const reportData = data as { gradeALiters: number, gradeBLiters: number, gradeCLiters: number, totalLiters: number, gradeAPercentage: number, gradeBPercentage: number, gradeCPercentage: number, qualityScore: number };
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Quality Analysis Report</CardTitle>
           <p className="text-sm text-muted-foreground">{periodString}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Total Liters Analyzed:</strong> {reportData.totalLiters.toFixed(1)} L</p>
          <p><strong>Grade A:</strong> {reportData.gradeALiters.toFixed(1)} L ({reportData.gradeAPercentage.toFixed(1)}%)</p>
          <p><strong>Grade B:</strong> {reportData.gradeBLiters.toFixed(1)} L ({reportData.gradeBPercentage.toFixed(1)}%)</p>
          <p><strong>Grade C:</strong> {reportData.gradeCLiters.toFixed(1)} L ({reportData.gradeCPercentage.toFixed(1)}%)</p>
          <p><strong>Overall Quality Score:</strong> {reportData.qualityScore.toFixed(1)}%</p>
        </CardContent>
      </Card>
    );
  }

  return <p className="mt-6 text-muted-foreground">Report type not recognized or data is invalid.</p>;
}


"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added for period input
import { Label } from "@/components/ui/label"; // Added for period input label
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Payment } from "@/types";
import { getPayments, processAllPendingPaymentsAction, generatePendingPaymentsAction } from "./actions";
import { CheckCircle, CircleDollarSign, ReceiptText, CalendarPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PaymentMethodDialog } from "@/components/payments/PaymentMethodDialog"; // New dialog
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPayments, setIsGeneratingPayments] = useState(false);
  const [periodToGenerate, setPeriodToGenerate] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();

  const [isPaymentMethodDialogOpen, setIsPaymentMethodDialogOpen] = useState(false);
  const [selectedPaymentForMethod, setSelectedPaymentForMethod] = useState<Payment | null>(null);
  
  const [isConfirmAllPaymentsOpen, setIsConfirmAllPaymentsOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPayments();
      setPayments(data);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load payment records." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleProcessPayment = (payment: Payment) => {
    setSelectedPaymentForMethod(payment);
    setIsPaymentMethodDialogOpen(true);
  };

  const handleGeneratePayments = async () => {
    if (!periodToGenerate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please enter a period (YYYY-MM)." });
      return;
    }
    setIsGeneratingPayments(true);
    try {
      const result = await generatePendingPaymentsAction(periodToGenerate);
      if (result.success) {
        toast({ title: "Payments Generation", description: result.message });
        fetchPayments(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Generation Failed", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: `Could not generate payments: ${error.message}` });
    } finally {
      setIsGeneratingPayments(false);
    }
  };

  const handleProcessAllPending = () => {
    const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;
    if (pendingPaymentsCount === 0) {
      toast({ title: "No Pending Payments", description: "There are no pending payments to process.", variant: "default" });
      return;
    }
    setIsConfirmAllPaymentsOpen(true);
  };

  const confirmProcessAllPayments = async () => {
    try {
      const result = await processAllPendingPaymentsAction();
      if (result.success) {
        toast({ title: "Payments Processed", description: result.message || `${result.count} payments successfully processed.` });
        fetchPayments(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Processing Failed", description: result.message || "Could not process all pending payments." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process all pending payments." });
    }
  };

  // Placeholder for viewing payment details, could open a dialog/modal
  const handleViewPaymentDetails = (payment: Payment) => {
    toast({ title: "View Details", description: `Details for payment to ${payment.farmerName} for period ${payment.period}. (Not implemented)` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Management" description="Generate, view, and process farmer payments.">
        {/* "Process All Pending" button kept for now, but its utility might change with individual payment methods. */}
        <Button onClick={handleProcessAllPending} className="shadow-md bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle className="mr-2 h-5 w-5" /> Process All Pending
        </Button>
      </PageHeader>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarPlus className="mr-2 h-5 w-5 text-primary" />
            Generate Pending Payments
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-grow">
            <Label htmlFor="periodToGenerate" className="text-sm font-medium">Payment Period (YYYY-MM)</Label>
            <Input
              id="periodToGenerate"
              type="month" // Using type="month" for better UX if browser supports it
              value={periodToGenerate}
              onChange={(e) => setPeriodToGenerate(e.target.value)}
              className="mt-1 shadow-inner"
              placeholder="YYYY-MM"
            />
          </div>
          <Button onClick={handleGeneratePayments} disabled={isGeneratingPayments} className="w-full sm:w-auto shadow-md">
            {isGeneratingPayments ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4"/>}
            Generate for Period
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
          <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold text-foreground">No Payment Records</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no payment records available. Try generating payments for a period.
          </p>
        </div>
      ) : (
        <PaymentsTable
          payments={payments}
          onProcessPayment={handleProcessPayment} // Changed to pass full payment object
          onViewDetails={handleViewPaymentDetails}
        />
      )}

      {selectedPaymentForMethod && (
        <PaymentMethodDialog
          open={isPaymentMethodDialogOpen}
          onOpenChange={setIsPaymentMethodDialogOpen}
          payment={selectedPaymentForMethod}
          onFormSubmit={() => {
            fetchPayments();
            setSelectedPaymentForMethod(null); // Clear selected payment after dialog closes
          }}
        />
      )}

      <ConfirmDialog
        open={isConfirmAllPaymentsOpen}
        onOpenChange={setIsConfirmAllPaymentsOpen}
        title="Confirm All Pending Payments"
        description={`Are you sure you want to process all ${payments.filter(p=>p.status === 'pending').length} pending payments? This will mark them as paid and notify respective farmers (payment methods will not be set for batch processed payments).`}
        onConfirm={confirmProcessAllPayments}
        confirmText="Yes, Process All"
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Payment } from "@/types";
import { getPayments, processSinglePaymentAction, processAllPendingPaymentsAction } from "./actions";
import { CheckCircle, CircleDollarSign, ReceiptText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isConfirmSinglePaymentOpen, setIsConfirmSinglePaymentOpen] = useState(false);
  const [paymentToProcessId, setPaymentToProcessId] = useState<string | null>(null);
  
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

  const handleProcessPayment = (paymentId: string) => {
    setPaymentToProcessId(paymentId);
    setIsConfirmSinglePaymentOpen(true);
  };

  const confirmProcessSinglePayment = async () => {
    if (!paymentToProcessId) return;
    try {
      const result = await processSinglePaymentAction(paymentToProcessId);
      if (result.success) {
        toast({ title: "Payment Processed", description: result.message });
        fetchPayments(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Processing Failed", description: result.message || "Could not process payment." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process payment." });
    }
    setPaymentToProcessId(null);
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
        toast({ title: "Payments Processed", description: `${result.count} payments successfully processed.` });
        fetchPayments(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Processing Failed", description: result.message || "Could not process all pending payments." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not process all pending payments." });
    }
  };

  const handleViewPaymentDetails = (payment: Payment) => {
    // Placeholder for viewing payment details, could open a dialog/modal
    toast({ title: "View Details", description: `Details for payment to ${payment.farmerName} for period ${payment.period}. (Not implemented)` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Management" description="View and process farmer payments.">
        <Button onClick={handleProcessAllPending} className="shadow-md bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle className="mr-2 h-5 w-5" /> Process All Pending
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
          <ReceiptText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold text-foreground">No Payment Records</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no payment records available at this time.
          </p>
        </div>
      ) : (
        <PaymentsTable
          payments={payments}
          onProcessPayment={handleProcessPayment}
          onViewDetails={handleViewPaymentDetails}
        />
      )}

      <ConfirmDialog
        open={isConfirmSinglePaymentOpen}
        onOpenChange={setIsConfirmSinglePaymentOpen}
        title="Confirm Payment"
        description="Are you sure you want to process this payment? This action will mark the payment as paid and notify the farmer."
        onConfirm={confirmProcessSinglePayment}
        confirmText="Yes, Process Payment"
      />

      <ConfirmDialog
        open={isConfirmAllPaymentsOpen}
        onOpenChange={setIsConfirmAllPaymentsOpen}
        title="Confirm All Pending Payments"
        description={`Are you sure you want to process all ${payments.filter(p=>p.status === 'pending').length} pending payments? This will mark them as paid and notify respective farmers.`}
        onConfirm={confirmProcessAllPayments}
        confirmText="Yes, Process All"
      />
    </div>
  );
}

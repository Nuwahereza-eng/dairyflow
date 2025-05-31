
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { processSinglePaymentAction } from "@/app/(app)/payments/actions";
import type { Payment } from "@/types";

const paymentMethodFormSchema = z.object({
  paymentMethod: z.enum(["cash", "bank", "mobile_money"], {
    required_error: "Payment method is required.",
  }),
  transactionId: z.string().optional(),
});

type PaymentMethodFormData = z.infer<typeof paymentMethodFormSchema>;

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null; // Pass the full payment object
  onFormSubmit: () => void; // To refresh payments list
}

export function PaymentMethodDialog({ open, onOpenChange, payment, onFormSubmit }: PaymentMethodDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: {
      paymentMethod: "cash",
      transactionId: "",
    },
  });

  const selectedMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (payment) {
      form.reset({
        paymentMethod: payment.paymentMethod || "cash",
        transactionId: payment.transactionId || "",
      });
    } else {
      form.reset({
        paymentMethod: "cash",
        transactionId: "",
      });
    }
  }, [payment, form, open]);

  async function onSubmit(data: PaymentMethodFormData) {
    if (!payment) return;
    setIsSubmitting(true);
    try {
      const result = await processSinglePaymentAction(
        payment.id,
        data.paymentMethod,
        data.transactionId
      );

      if (result.success) {
        toast({
          title: "Payment Processed",
          description: result.message || `Payment for ${payment.farmerName} processed.`,
        });
        onFormSubmit();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: "Processing Failed",
          description: result.message || "Could not process payment.",
        });
      }
    } catch (error) {
      console.error("Failed to submit payment method form:", error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not process payment. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Process Payment</DialogTitle>
          <DialogDescription>
            Farmer: {payment.farmerName} <br />
            Period: {payment.period} <br />
            Amount: UGX {payment.amountDue.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(selectedMethod === "bank" || selectedMethod === "mobile_money") && (
              <FormField
                control={form.control}
                name="transactionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter Transaction ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

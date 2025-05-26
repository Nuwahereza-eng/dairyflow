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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Delivery, Farmer } from "@/types";
import { recordDeliveryAction, updateDeliveryAction } from "@/app/(app)/deliveries/actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const deliveryFormSchema = z.object({
  farmerId: z.string().min(1, "Farmer selection is required"),
  quantity: z.coerce.number().min(0.1, "Quantity must be at least 0.1L"),
  quality: z.enum(["A", "B", "C"], { required_error: "Quality grade is required" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  notes: z.string().optional(),
});

type DeliveryFormData = z.infer<typeof deliveryFormSchema>;

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery?: Delivery | null;
  farmers: Pick<Farmer, 'id' | 'name'>[];
  onFormSubmit: () => void;
}

export function DeliveryDialog({ open, onOpenChange, delivery, farmers, onFormSubmit }: DeliveryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DeliveryFormData>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: {
      farmerId: "",
      quantity: 0,
      quality: "A",
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      notes: "",
    },
  });

  useEffect(() => {
    if (delivery) {
      form.reset({
        farmerId: delivery.farmerId,
        quantity: delivery.quantity,
        quality: delivery.quality,
        date: delivery.date,
        time: delivery.time,
        notes: delivery.notes || "",
      });
    } else {
      form.reset({
        farmerId: "",
        quantity: 0,
        quality: "A",
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        notes: "",
      });
    }
  }, [delivery, form, open]);

  async function onSubmit(data: DeliveryFormData) {
    setIsSubmitting(true);
    try {
      let response;
      if (delivery) {
        response = await updateDeliveryAction(delivery.id, data);
      } else {
        response = await recordDeliveryAction(data);
      }

      if (response.success) {
        toast({
          title: delivery ? "Delivery Updated" : "Delivery Recorded",
          description: `Delivery details have been successfully ${delivery ? 'updated' : 'recorded'}.`,
        });
        onFormSubmit();
        onOpenChange(false);
      } else {
        if (response.errors) {
          Object.entries(response.errors).forEach(([field, messages]) => {
            form.setError(field as keyof DeliveryFormData, { type: "server", message: (messages as string[]).join(", ") });
          });
        }
        toast({
          variant: "destructive",
          title: "Operation Failed",
          description: "Please check the form for errors.",
        });
      }
    } catch (error) {
      console.error("Failed to submit delivery form:", error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not save delivery details. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-card shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {delivery ? "Edit Milk Delivery" : "Record New Milk Delivery"}
          </DialogTitle>
          <DialogDescription>
            {delivery ? "Update the details for this milk delivery." : "Enter the details for the new milk delivery."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="farmerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Farmer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose farmer..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {farmers.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (Liters)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" placeholder="e.g. 25.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quality Grade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A">Grade A (Premium)</SelectItem>
                        <SelectItem value="B">Grade B (Standard)</SelectItem>
                        <SelectItem value="C">Grade C (Below Standard)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any relevant notes about the delivery" {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {delivery ? "Save Changes" : "Record Delivery"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


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
import type { Farmer } from "@/types";
import { addFarmerAction, updateFarmerAction } from "@/app/(app)/farmers/actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const farmerFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, { message: "Phone number must be in E.164 format (e.g., +256701234567)." }),
  location: z.string().min(2, { message: "Location must be at least 2 characters." }),
  idNumber: z.string().optional(),
  notes: z.string().optional(),
});

type FarmerFormData = z.infer<typeof farmerFormSchema>;

interface FarmerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmer?: Farmer | null; // For editing
  onFormSubmit: () => void; // Callback to refresh data
}

export function FarmerDialog({ open, onOpenChange, farmer, onFormSubmit }: FarmerDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FarmerFormData>({
    resolver: zodResolver(farmerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      location: "",
      idNumber: undefined, // Default to undefined for optional fields
      notes: undefined,    // Default to undefined for optional fields
    },
  });

  useEffect(() => {
    if (farmer) {
      form.reset({
        name: farmer.name,
        phone: farmer.phone,
        location: farmer.location,
        idNumber: farmer.idNumber, // Will be undefined if not present in Firestore data
        notes: farmer.notes,       // Will be undefined if not present in Firestore data
      });
    } else {
      form.reset({ // Explicitly reset to defaults for new farmer form
        name: "",
        phone: "",
        location: "",
        idNumber: undefined,
        notes: undefined,
      });
    }
  }, [farmer, form, open]);

  async function onSubmit(data: FarmerFormData) {
    setIsSubmitting(true);
    try {
      let response;
      if (farmer) {
        response = await updateFarmerAction(farmer.id, data);
      } else {
        response = await addFarmerAction(data as Omit<Farmer, 'id' | 'joinDate'> & { joinDate?: string });
      }

      if (response.success) {
        toast({
          title: farmer ? "Farmer Updated" : "Farmer Added",
          description: `${data.name} has been successfully ${farmer ? 'updated' : 'added'}.`,
        });
        onFormSubmit(); 
        onOpenChange(false); 
      } else {
        if (response.errors) {
          Object.entries(response.errors).forEach(([field, messages]) => {
            const fieldName = field as keyof FarmerFormData;
            if (Array.isArray(messages)) {
              form.setError(fieldName, { type: "server", message: messages.join(", ") });
            }
          });
        }
        toast({
          variant: "destructive",
          title: "Operation Failed",
          description: response.errors?._form?.join(", ") || "Please check the form for errors.",
        });
      }
    } catch (error) {
      console.error("Failed to submit farmer form:", error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not save farmer details. Please try again.",
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
            {farmer ? "Edit Farmer" : "Add New Farmer"}
          </DialogTitle>
          <DialogDescription>
            {farmer ? "Update the details for this farmer." : "Enter the details for the new farmer. Ensure phone number includes the country code (e.g., +256...)"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Mukasa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (E.164 format)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. +256701234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location / Village</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Kampala" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="idNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CF123456" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any relevant notes about the farmer" {...field} value={field.value ?? ''} rows={3} />
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
                {farmer ? "Save Changes" : "Add Farmer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

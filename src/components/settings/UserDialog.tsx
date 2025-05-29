
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
import type { User, UserRole } from "@/types"; // Import UserRole
import { addUserAction, updateUserAction, updateUserPasswordAction } from "@/app/(app)/settings/actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Schema for the form data (password is for new users or changing password)
const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  role: z.enum(["operator", "admin"], { required_error: "Role is required." }),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')), // Optional, allow empty for edit
  status: z.enum(["active", "inactive"], { required_error: "Status is required." }),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: Omit<User, 'password'> | null; 
  onFormSubmit: () => void; 
}

export function UserDialog({ open, onOpenChange, user, onFormSubmit }: UserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      role: "operator" as UserRole, // Cast to ensure it matches enum
      password: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (open) { // Reset form only when dialog opens
      if (user) {
        form.reset({
          username: user.username,
          role: user.role as "operator" | "admin", // Ensure type compatibility
          password: "", // Always clear password for editing for security
          status: user.status,
        });
      } else {
        form.reset({
          username: "",
          role: "operator" as UserRole,
          password: "", // Expect password for new user
          status: "active",
        });
      }
    }
  }, [user, form, open]);

  async function onSubmit(data: UserFormData) {
    setIsSubmitting(true);
    try {
      let response;
      if (user && user.id) { // Editing existing user
        const { password, ...updateData } = data;
        response = await updateUserAction(user.id, updateData);
        if (response.success && password) { // If password was entered, try to update it
          const passResponse = await updateUserPasswordAction(user.id, password);
          if (!passResponse.success) {
            toast({ variant: "destructive", title: "Password Update Failed", description: passResponse.message });
            // Continue even if password update fails, main update might have succeeded
          } else {
            toast({ title: "Password Updated", description: "User's password changed successfully." });
          }
        }
      } else { // Adding new user
        if (!data.password) { // Password is required for new user
          form.setError("password", { type: "manual", message: "Password is required for new users." });
          setIsSubmitting(false);
          return;
        }
        response = await addUserAction(data as Omit<User, 'id'>); // Cast because new user data includes password
      }

      if (response.success) {
        toast({
          title: user ? "User Updated" : "User Added",
          description: `${data.username} has been successfully ${user ? 'updated' : 'added'}.`,
        });
        onFormSubmit();
        onOpenChange(false);
      } else {
        if (response.errors) {
           Object.entries(response.errors).forEach(([field, messages]) => {
            if (field === "_form") {
                 toast({ variant: "destructive", title: "Operation Failed", description: (messages as string[]).join(", ") });
            } else {
                form.setError(field as keyof UserFormData, { type: "server", message: (messages as string[]).join(", ") });
            }
          });
        } else {
            toast({ variant: "destructive", title: "Operation Failed", description: "Could not save user details."});
        }
      }
    } catch (error) {
      console.error("Failed to submit user form:", error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not save user details. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{user ? "Edit System User" : "Add New System User"}</DialogTitle>
          <DialogDescription>
            {user ? "Update the details for this system user." : "Enter the details for the new Admin or Operator user."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. operator_jane or admin_user" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password {user ? "(Leave blank to keep current)" : ""}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={user ? "Enter new password" : "Enter password"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
             <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="operator">MCC Operator</SelectItem>
                        <SelectItem value="admin">System Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {user ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

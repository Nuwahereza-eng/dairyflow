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
import type { User } from "@/types";
import { addUserAction, updateUserAction } from "@/app/(app)/settings/actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const userFormSchemaBase = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  role: z.enum(["operator", "admin"], { required_error: "Role is required." }),
  status: z.enum(["active", "inactive"], { required_error: "Status is required." }),
});

// For new users, password is required
const newUserFormSchema = userFormSchemaBase.extend({
  password: z.string().min(6, "Password must be at least 6 characters."),
});

// For editing users, password is optional
const editUserFormSchema = userFormSchemaBase.extend({
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')), // Allow empty string for optional
});


interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: Omit<User, 'password'> | null; // For editing
  onFormSubmit: () => void; // Callback to refresh data
}

export function UserDialog({ open, onOpenChange, user, onFormSubmit }: UserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formSchema = user ? editUserFormSchema : newUserFormSchema;
  type UserFormData = z.infer<typeof formSchema>;

  const form = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      role: "operator",
      password: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        role: user.role,
        password: "", // Password field cleared for editing for security
        status: user.status,
      });
    } else {
      form.reset({
        username: "",
        role: "operator",
        password: "",
        status: "active",
      });
    }
  }, [user, form, open]);

  async function onSubmit(data: UserFormData) {
    setIsSubmitting(true);
    try {
      let response;
      if (user && user.id) {
        // For update, password is not part of the main data sent unless changed
        const { password, ...updateData } = data; 
        response = await updateUserAction(user.id, updateData);
        // If password was entered, call a separate action (example)
        // if (password) await updateUserPasswordAction(user.id, password);
      } else {
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
            form.setError(field as keyof UserFormData, { type: "server", message: (messages as string[]).join(", ") });
          });
        }
        toast({
          variant: "destructive",
          title: "Operation Failed",
          description: "Please check the form for errors.",
        });
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
          <DialogTitle className="text-2xl font-semibold">{user ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {user ? "Update the details for this system user." : "Enter the details for the new system user."}
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
                    <Input placeholder="e.g. operator_jane" {...field} />
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
                    <Input type="password" placeholder="Enter password" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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

"use client";

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole, AuthenticatedUser } from '@/types';
import { initialUsers } from '@/lib/mockData'; // For demo auth
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  role: z.enum(['farmer', 'operator', 'admin'], {
    required_error: "Please select a role.",
  }),
  username: z.string().min(1, { message: "Username/Phone is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: 'operator',
      username: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate API call for authentication
    setTimeout(() => {
      const foundUser = initialUsers.find(
        (u) => u.username === values.username && u.role === values.role
      );

      // In a real app, password would be hashed and checked on the server
      // For this demo, we'll just check if the user exists with the role
      // A very basic password check for 'admin' and 'operator1' for demo purposes
      let passwordMatch = true;
      if (values.username === 'admin' && values.password !== 'adminpass') passwordMatch = false;
      if (values.username === 'operator1' && values.password !== 'op1pass') passwordMatch = false;
      if (values.username === 'farmer_john' && values.password !== 'farmerpass') passwordMatch = false;


      if (foundUser && passwordMatch) {
        const authUser: AuthenticatedUser = {
          username: foundUser.username,
          role: foundUser.role as UserRole,
        };
        login(authUser);
        toast({
          title: "Login Successful",
          description: `Welcome, ${foundUser.username}!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid credentials or role selection. Please try again.",
        });
      }
      setIsLoading(false);
    }, 1000);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="farmer">Farmer</SelectItem>
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
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username / Phone</FormLabel>
              <FormControl>
                <Input placeholder="Enter username or phone" {...field} />
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
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Login
        </Button>
        {/* Registration button can be added here if needed, for now handled via Farmer Management by Admin/Operator */}
        {/* <Button variant="outline" className="w-full mt-2" onClick={() => alert("Registration not implemented in this form.")}>
          Register New Farmer
        </Button> */}
      </form>
    </Form>
  );
}


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
import type { UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Droplets, Eye, EyeOff } from 'lucide-react'; // Added Eye, EyeOff
import { useRouter } from 'next/navigation';

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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: 'farmer',
      username: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setLoginError(null);
    try {
      const loginResult = await login({
        role: values.role as UserRole,
        username: values.username,
        password: values.password
      });

      if (loginResult.success) {
        toast({
          title: "Login Successful",
          description: `Welcome! Redirecting to dashboard...`,
        });
        router.push('/dashboard');
      } else {
        const error = loginResult.error;
        console.error("LoginForm onSubmit: Login failed. Error from AuthContext:", error);
        let errorMessage = "Login failed. Please check your credentials and role.";
        
        if (error && error.code) {
            switch (error.code) {
                case 'auth/invalid-credential':
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage = "Login failed: Invalid username or password. Please double-check your phone number (e.g. +256701234567 for farmers), ensure you've selected the correct role, and verify your password. For new farmers, the default password is 'Dairy!2345'.";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "This user account has been disabled.";
                    break;
                case 'auth/invalid-email':
                     errorMessage = "The username format is invalid for the selected role. Ensure farmers use their phone number (e.g., +256...) and admins/operators use their assigned username.";
                     break;
                default:
                    errorMessage = error.message || "An unknown authentication error occurred.";
                    break;
            }
        } else if (error && error.message) {
            errorMessage = error.message;
        }
        
        setLoginError(errorMessage);
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorMessage,
          duration: 7000,
        });
      }
    } catch (unexpectedError: any) {
      console.error("LoginForm onSubmit: Unexpected error during login process:", unexpectedError);
      setLoginError("An unexpected error occurred. Please try again or contact support.");
      toast({
        variant: "destructive",
        title: "Login Error",
        description: "An unexpected error occurred. Please try again or contact support.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleForgotPassword = () => {
    toast({
      title: "Password Reset",
      description: (
        <div className="space-y-2">
          <p><strong>Farmers:</strong> Please contact your MCC operator or DairyFlow administrator to help reset your password.</p>
          <p><strong>MCC Operators & System Admins:</strong> Please contact another System Administrator to reset your password through the User Management settings.</p>
        </div>
      ),
      duration: 10000, 
    });
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="mb-8 flex flex-col items-center pt-4">
          <Droplets className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-3xl font-bold text-center text-foreground">DairyFlow</h1>
          <p className="text-muted-foreground text-center mt-1">MCC & Dairy Farmer Management</p>
        </div>
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
              <FormLabel>Username / Phone (+256... for Farmer)</FormLabel>
              <FormControl>
                <Input placeholder="Enter username or phone (+256...)" {...field} />
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
              <div className="relative">
                <FormControl>
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter password" 
                    {...field} 
                    className="pr-10" // Add padding for the icon
                  />
                </FormControl>
                <Button 
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={togglePasswordVisibility}
                  tabIndex={-1} // Keep it out of tab order
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {loginError && (
          <p className="text-sm font-medium text-destructive">{loginError}</p>
        )}
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Login
        </Button>
        <div className="text-center text-sm">
          <Button variant="link" type="button" onClick={handleForgotPassword} className="p-0 h-auto font-normal">
            Forgot Password?
          </Button>
        </div>
      </form>
    </Form>
  );
}

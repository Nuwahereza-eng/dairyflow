"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SystemSettings } from "@/types";
import { saveSystemSettingsAction } from "@/app/(app)/settings/actions";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const settingsFormSchema = z.object({
  milkPricePerLiter: z.coerce.number().min(0, "Milk price must be non-negative"),
  smsProvider: z.enum(["africas_talking", "twilio", "none"]),
  smsApiKey: z.string().optional(),
  smsUsername: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

interface SystemSettingsFormProps {
  initialSettings: SystemSettings;
  onSettingsSaved: (updatedSettings: SystemSettings) => void;
}

export function SystemSettingsForm({ initialSettings, onSettingsSaved }: SystemSettingsFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: initialSettings,
  });

  useEffect(() => {
    form.reset(initialSettings);
  }, [initialSettings, form]);

  async function onSubmit(data: SettingsFormData) {
    setIsSubmitting(true);
    try {
      const response = await saveSystemSettingsAction(data);
      if (response.success && response.settings) {
        toast({
          title: "Settings Saved",
          description: "System settings have been updated successfully.",
        });
        onSettingsSaved(response.settings);
      } else {
        if (response.errors) {
           Object.entries(response.errors).forEach(([field, messages]) => {
            form.setError(field as keyof SettingsFormData, { type: "server", message: (messages as string[]).join(", ") });
          });
        }
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save settings. Please check errors.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not save system settings. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>Manage general system configurations and SMS provider details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="milkPricePerLiter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Milk Price per Liter (UGX)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 1200" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="smsProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS Provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select SMS provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (Simulate SMS)</SelectItem>
                        <SelectItem value="africas_talking">Africa's Talking</SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="smsApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS API Key</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter API key (leave blank to keep current)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="smsUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS Username / Sender ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username or sender ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="shadow-md">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

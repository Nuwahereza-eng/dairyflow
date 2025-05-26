"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { SystemSettingsForm } from "@/components/settings/SystemSettingsForm";
import { UsersTable } from "@/components/settings/UsersTable";
import { UserDialog } from "@/components/settings/UserDialog";
import type { SystemSettings, User } from "@/types";
import { getSystemSettings, getUsers, deleteUserAction } from "./actions";
import { PlusCircle, Settings as SettingsIcon, Users as UsersIcon, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Omit<User, 'password'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const router = useRouter();
  
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to view this page." });
      router.replace('/dashboard');
    }
  }, [currentUser, router, toast]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsData, usersData] = await Promise.all([
        getSystemSettings(),
        getUsers(),
      ]);
      setSettings(settingsData);
      setUsers(usersData);
    } catch (error) {
      console.error("Failed to fetch settings data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load settings data." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchData();
    }
  }, [fetchData, currentUser]);

  const handleSettingsSaved = (updatedSettings: SystemSettings) => {
    setSettings(updatedSettings);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsUserDialogOpen(true);
  };

  const handleEditUser = (user: Omit<User, 'password'>) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    setUserToDeleteId(userId);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDeleteId) return;
    try {
      const result = await deleteUserAction(userToDeleteId);
       if (result.success) {
        toast({ title: "User Deleted", description: "The user has been successfully deleted." });
        fetchData(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Deletion Failed", description: result.errors?._form?.join(", ") || "Could not delete user." });
      }
    } catch (error) {
       toast({ variant: "destructive", title: "Error", description: "Could not delete user." });
    }
    setUserToDeleteId(null);
  };


  if (isLoading || !settings) {
    return <div className="flex justify-center items-center h-64"><p className="text-muted-foreground">Loading settings...</p></div>;
  }
  
  if (currentUser?.role !== 'admin') {
    return <div className="flex justify-center items-center h-64"><p className="text-destructive">Access Denied.</p></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Configure system parameters and manage users." />
      
      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-6 shadow-sm">
          <TabsTrigger value="system"><SettingsIcon className="mr-2 h-4 w-4"/> System Config</TabsTrigger>
          <TabsTrigger value="users"><UsersIcon className="mr-2 h-4 w-4"/> User Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="system">
          <SystemSettingsForm initialSettings={settings} onSettingsSaved={handleSettingsSaved} />
        </TabsContent>
        
        <TabsContent value="users">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Add, edit, or remove system users (Operators, Admins).</CardDescription>
              </div>
              <Button onClick={handleAddUser} className="shadow-md">
                <PlusCircle className="mr-2 h-5 w-5" /> Add New User
              </Button>
            </CardHeader>
            <CardContent>
              {users.length > 0 ? (
                 <UsersTable users={users} onEdit={handleEditUser} onDelete={handleDeleteUser} />
              ) : (
                <div className="text-center py-12 border rounded-lg">
                    <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-xl font-semibold text-foreground">No System Users</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        There are no operators or administrators configured yet.
                    </p>
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserDialog
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        user={selectedUser}
        onFormSubmit={fetchData}
      />
      
      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        title="Delete User?"
        description="This will permanently delete the user account. This action cannot be undone."
        onConfirm={confirmDeleteUser}
        confirmText="Yes, delete user"
      />
    </div>
  );
}

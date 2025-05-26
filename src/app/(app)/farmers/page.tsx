"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FarmersTable } from "@/components/farmers/FarmersTable";
import { FarmerDialog } from "@/components/farmers/FarmerDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Farmer } from "@/types";
import { getFarmers, deleteFarmerAction } from "./actions";
import { PlusCircle, Search, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';

export default function FarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [farmerToDeleteId, setFarmerToDeleteId] = useState<string | null>(null);
  
  const [isViewDetailsDialogOpen, setIsViewDetailsDialogOpen] = useState(false);
  const [viewingFarmer, setViewingFarmer] = useState<Farmer | null>(null);


  const fetchFarmers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFarmers();
      setFarmers(data);
    } catch (error) {
      console.error("Failed to fetch farmers:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load farmers." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFarmers();
  }, [fetchFarmers]);

  const handleAddFarmer = () => {
    setSelectedFarmer(null);
    setIsDialogOpen(true);
  };

  const handleEditFarmer = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setIsDialogOpen(true);
  };

  const handleDeleteFarmer = (farmerId: string) => {
    setFarmerToDeleteId(farmerId);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!farmerToDeleteId) return;
    try {
      const result = await deleteFarmerAction(farmerToDeleteId);
      if (result.success) {
        toast({ title: "Farmer Deleted", description: "The farmer has been successfully deleted." });
        fetchFarmers(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Deletion Failed", description: result.errors?._form?.join(", ") || "Could not delete farmer." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete farmer." });
    }
    setFarmerToDeleteId(null);
  };
  
  const handleViewDetails = (farmer: Farmer) => {
    setViewingFarmer(farmer);
    setIsViewDetailsDialogOpen(true);
  };

  const filteredFarmers = farmers.filter(farmer =>
    farmer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    farmer.phone.includes(searchTerm) ||
    farmer.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Farmer Management" description="Add, edit, and manage farmer details.">
        <Button onClick={handleAddFarmer} className="shadow-md">
          <PlusCircle className="mr-2 h-5 w-5" /> Add New Farmer
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 p-4 bg-card rounded-lg shadow-sm border">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search farmers by name, phone, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full shadow-inner"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading farmers...</p>
        </div>
      ) : filteredFarmers.length === 0 && searchTerm ? (
        <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
          <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold text-foreground">No Farmers Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your search for "{searchTerm}" did not match any farmers.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setSearchTerm('')}>
            Clear Search
          </Button>
        </div>
      ) : (
        <FarmersTable
          farmers={filteredFarmers}
          onEdit={handleEditFarmer}
          onDelete={handleDeleteFarmer}
          onViewDetails={handleViewDetails}
        />
      )}

      <FarmerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        farmer={selectedFarmer}
        onFormSubmit={fetchFarmers}
      />
      
      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        title="Are you sure?"
        description="This action cannot be undone. This will permanently delete the farmer and all related data."
        onConfirm={confirmDelete}
        confirmText="Yes, delete farmer"
      />

      {viewingFarmer && (
        <Dialog open={isViewDetailsDialogOpen} onOpenChange={setIsViewDetailsDialogOpen}>
          <DialogContent className="sm:max-w-md bg-card shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">{viewingFarmer.name}</DialogTitle>
              <DialogDescription>Farmer ID: CF{viewingFarmer.id.padStart(3, '0')}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-3 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-foreground">{viewingFarmer.phone}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium text-foreground">{viewingFarmer.location}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join Date:</span>
                  <span className="font-medium text-foreground">{format(new Date(viewingFarmer.joinDate), 'PPP')}</span>
                </div>
                {viewingFarmer.idNumber && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID Number:</span>
                      <span className="font-medium text-foreground">{viewingFarmer.idNumber}</span>
                    </div>
                  </>
                )}
                {viewingFarmer.notes && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="font-medium text-foreground mt-1 bg-muted/50 p-2 rounded-md">{viewingFarmer.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDetailsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

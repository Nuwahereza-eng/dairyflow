"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeliveriesTable } from "@/components/deliveries/DeliveriesTable";
import { DeliveryDialog } from "@/components/deliveries/DeliveryDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Delivery, Farmer } from "@/types";
import { getDeliveries, deleteDeliveryAction, getDeliveryFarmers } from "./actions";
import { PlusCircle, Filter, ListX, Truck } from "lucide-react"; // Added Truck icon
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [farmers, setFarmers] = useState<Pick<Farmer, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [farmerFilter, setFarmerFilter] = useState("");
  const { toast } = useToast();
  
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [deliveryToDeleteId, setDeliveryToDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [deliveriesData, farmersData] = await Promise.all([
        getDeliveries(),
        getDeliveryFarmers(),
      ]);
      setDeliveries(deliveriesData);
      setFarmers(farmersData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load deliveries or farmers." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddDelivery = () => {
    setSelectedDelivery(null);
    setIsDialogOpen(true);
  };

  const handleEditDelivery = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setIsDialogOpen(true);
  };

  const handleDeleteDelivery = (deliveryId: string) => {
    setDeliveryToDeleteId(deliveryId);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deliveryToDeleteId) return;
    try {
      const result = await deleteDeliveryAction(deliveryToDeleteId);
      if (result.success) {
        toast({ title: "Delivery Deleted", description: "The delivery record has been successfully deleted." });
        fetchData(); // Refresh list
      } else {
        toast({ variant: "destructive", title: "Deletion Failed", description: result.errors?._form?.join(", ") || "Could not delete delivery." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete delivery record." });
    }
    setDeliveryToDeleteId(null);
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const dateMatch = !dateFilter || delivery.date === dateFilter;
    const farmerMatch = !farmerFilter || delivery.farmerId === farmerFilter;
    return dateMatch && farmerMatch;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Milk Deliveries" description="Record and manage milk deliveries.">
        <Button onClick={handleAddDelivery} className="shadow-md">
          <PlusCircle className="mr-2 h-5 w-5" /> Record New Delivery
        </Button>
      </PageHeader>

      <Card className="p-6 bg-card shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="dateFilter" className="text-sm font-medium">Filter by Date</Label>
            <Input
              id="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="mt-1 shadow-inner"
            />
          </div>
          <div>
            <Label htmlFor="farmerFilter" className="text-sm font-medium">Filter by Farmer</Label>
            <Select value={farmerFilter} onValueChange={setFarmerFilter}>
              <SelectTrigger className="w-full mt-1 shadow-inner">
                <SelectValue placeholder="All Farmers" />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="">All Farmers</SelectItem> <- Removed this line */}
                {farmers.map(farmer => (
                  <SelectItem key={farmer.id} value={farmer.id}>
                    {farmer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {setDateFilter(''); setFarmerFilter('');}}
            className="md:self-end shadow-sm"
          >
            <ListX className="mr-2 h-4 w-4" /> Clear Filters
          </Button>
        </div>
      </Card>


      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading deliveries...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
         <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold text-foreground">No Deliveries Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no deliveries matching your current filters, or no deliveries have been recorded yet.
          </p>
        </div>
      ) : (
        <DeliveriesTable
          deliveries={filteredDeliveries}
          onEdit={handleEditDelivery}
          onDelete={handleDeleteDelivery}
        />
      )}

      <DeliveryDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        delivery={selectedDelivery}
        farmers={farmers}
        onFormSubmit={fetchData}
      />
      
      <ConfirmDialog
        open={isConfirmDeleteDialogOpen}
        onOpenChange={setIsConfirmDeleteDialogOpen}
        title="Are you sure?"
        description="This action cannot be undone. This will permanently delete the delivery record."
        onConfirm={confirmDelete}
        confirmText="Yes, delete delivery"
      />
    </div>
  );
}

// Minimal Card and Label for context if not globally available
// These are typically imported from '@/components/ui/...'
const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props} />
);
const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={className} {...props} />
);


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
import { PlusCircle, Filter, ListX, Truck, PackageIcon, TrendingUp, DollarSign, Sigma } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added for StatCard
import { format } from 'date-fns'; // Ensure format is imported

// StatCard component (similar to dashboard)
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground pt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}


export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [allMccFarmers, setAllMccFarmers] = useState<Pick<Farmer, 'id' | 'name'>[]>([]); // Renamed for clarity
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [farmerFilter, setFarmerFilter] = useState(""); // Only used by admin/operator
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [deliveryToDeleteId, setDeliveryToDeleteId] = useState<string | null>(null);

  const isFarmerView = currentUser?.role === 'farmer';

  const fetchData = useCallback(async () => {
    if (!currentUser) {
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      if (isFarmerView && currentUser.uid) {
        const deliveriesData = await getDeliveries(currentUser.uid);
        setDeliveries(deliveriesData);
        setAllMccFarmers([]); // Not needed for farmer view
      } else {
        const [deliveriesData, farmersData] = await Promise.all([
          getDeliveries(),
          getDeliveryFarmers(),
        ]);
        setDeliveries(deliveriesData);
        setAllMccFarmers(farmersData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load deliveries." });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUser, isFarmerView]); // Added currentUser and isFarmerView to dependencies

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddDelivery = () => {
    if (isFarmerView) return; // Should not be callable by farmer
    setSelectedDelivery(null);
    setIsDialogOpen(true);
  };

  const handleEditDelivery = (delivery: Delivery) => {
    if (isFarmerView) return; // Should not be callable by farmer
    setSelectedDelivery(delivery);
    setIsDialogOpen(true);
  };

  const handleDeleteDelivery = (deliveryId: string) => {
    if (isFarmerView) return; // Should not be callable by farmer
    setDeliveryToDeleteId(deliveryId);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deliveryToDeleteId || isFarmerView) return;
    try {
      const result = await deleteDeliveryAction(deliveryToDeleteId);
      if (result.success) {
        toast({ title: "Delivery Deleted", description: "The delivery record has been successfully deleted." });
        fetchData(); 
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
    // For admin/operator, farmerFilter applies. For farmer, deliveries are already pre-filtered.
    const farmerMatch = isFarmerView || !farmerFilter || delivery.farmerId === farmerFilter;
    return dateMatch && farmerMatch;
  });
  
  // Calculate farmer-specific stats if isFarmerView
  const farmerTotalDeliveriesCount = isFarmerView ? filteredDeliveries.length : 0;
  const farmerTotalLiters = isFarmerView ? filteredDeliveries.reduce((sum, d) => sum + d.quantity, 0) : 0;
  const farmerTotalSales = isFarmerView ? filteredDeliveries.reduce((sum, d) => sum + d.amount, 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={isFarmerView ? "My Milk Deliveries" : "Milk Deliveries"}
        description={isFarmerView ? "View your past milk deliveries and summaries." : "Record and manage milk deliveries."}
      >
        {!isFarmerView && (
          <Button onClick={handleAddDelivery} className="shadow-md">
            <PlusCircle className="mr-2 h-5 w-5" /> Record New Delivery
          </Button>
        )}
      </PageHeader>

      {!isFarmerView && (
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
                  {allMccFarmers.map(farmer => (
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
      )}

      {isFarmerView && (
        <>
        <div className="grid gap-6 md:grid-cols-3">
            <StatCard title="Your Total Deliveries" value={farmerTotalDeliveriesCount} icon={Truck} description="Count of all your deliveries" />
            <StatCard title="Your Total Liters" value={`${farmerTotalLiters.toFixed(1)} L`} icon={PackageIcon} description="Total milk supplied by you" />
            <StatCard title="Your Total Sales" value={`UGX ${farmerTotalSales.toLocaleString()}`} icon={DollarSign} description="Total earnings from your deliveries" />
        </div>
        <Card className="p-6 bg-card shadow-sm border">
            <div>
              <Label htmlFor="dateFilterFarmer" className="text-sm font-medium">Filter by Date</Label>
              <Input
                id="dateFilterFarmer"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="mt-1 shadow-inner"
              />
            </div>
         </Card>
        </>
      )}


      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Loading deliveries...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
         <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold text-foreground">No Deliveries Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFarmerView ? "You have no milk deliveries recorded" : "There are no deliveries matching your current filters, or no deliveries have been recorded yet."}
            {dateFilter && " for the selected date."}
          </p>
        </div>
      ) : (
        <DeliveriesTable
          deliveries={filteredDeliveries}
          onEdit={handleEditDelivery}
          onDelete={handleDeleteDelivery}
          canManage={!isFarmerView}
        />
      )}

      {!isFarmerView && (
        <DeliveryDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          delivery={selectedDelivery}
          farmers={allMccFarmers}
          onFormSubmit={fetchData}
        />
      )}
      
      {!isFarmerView && (
        <ConfirmDialog
          open={isConfirmDeleteDialogOpen}
          onOpenChange={setIsConfirmDeleteDialogOpen}
          title="Are you sure?"
          description="This action cannot be undone. This will permanently delete the delivery record."
          onConfirm={confirmDelete}
          confirmText="Yes, delete delivery"
        />
      )}
    </div>
  );
}

// Minimal Card and Label for context if not globally available
// These are typically imported from '@/components/ui/...'
// const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
//   <div className={className} {...props} />
// );
const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={className} {...props} />
);


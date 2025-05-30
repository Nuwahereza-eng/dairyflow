
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Delivery, AuthenticatedUser } from '@/types'; // Removed Farmer, Payment as they are not directly stored in state
import { Users, Truck, Package, CreditCard, Activity, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { getDashboardStats, getRecentDeliveriesForDashboard, type DashboardStats } from './actions'; // Import new actions
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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

export default function DashboardPage() {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser } = useAuth(); 

  useEffect(() => {
    async function fetchData() {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [stats, activities] = await Promise.all([
          getDashboardStats(currentUser.uid, currentUser.role),
          getRecentDeliveriesForDashboard(5, currentUser.uid, currentUser.role),
        ]);
        
        setDashboardStats(stats);
        setRecentDeliveries(activities);

      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        let errorMessage = "Could not load dashboard data from the server.";
        // Error codes for Firestore: 9 is FAILED_PRECONDITION (often missing index), 5 is also used for this.
        if (error.code === 9 || error.code === 5 || (error.message && error.message.toLowerCase().includes("index"))) { 
            errorMessage = `Data query failed: ${error.message}. A Firestore index might be required. Check server logs or Firestore console for a creation link.`;
        }
        toast({
          variant: "destructive",
          title: "Error Fetching Dashboard Data",
          description: errorMessage,
          duration: 10000, // Increased duration for index error messages
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast, currentUser]);

  if (isLoading || !currentUser) { // Added !currentUser check for robustness
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
         <PageHeader title="Dashboard" description="Overview of your dairy operations." />
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }
  
  const isFarmerView = currentUser?.role === 'farmer';

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Overview of ${isFarmerView ? 'your' : 'dairy'} operations.`} />
      
      {dashboardStats ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {!isFarmerView && dashboardStats.totalFarmers !== undefined && (
            <StatCard title="Total Farmers" value={dashboardStats.totalFarmers} icon={Users} description="Registered in the system" />
          )}
          {isFarmerView && dashboardStats.farmerName && (
               <StatCard title="Your Profile" value={dashboardStats.farmerName} icon={Users} description={`ID: ${dashboardStats.farmerIdSnippet || currentUser.uid.substring(0,8) + '...'}`} />
          )}
          <StatCard title="Today's Deliveries" value={dashboardStats.todaysDeliveriesCount} icon={Truck} description={`On ${format(new Date(), 'PPP')}`} />
          <StatCard title="Today's Collection" value={`${(dashboardStats.todaysLiters || 0).toFixed(1)} L`} icon={Package} description="Total milk quantity today" />
          <StatCard title="Pending Payments" value={dashboardStats.pendingPaymentsCount} icon={CreditCard} description="Awaiting processing" />
        </div>
      ) : (
        <p className="text-muted-foreground">Loading statistics...</p>
      )}

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-6 w-6 text-primary" />
            Recent Milk Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentDeliveries.length > 0 ? (
            <ScrollArea className="h-72">
              <ul className="space-y-4">
                {recentDeliveries.map(activity => (
                  <li key={activity.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isFarmerView ? `You delivered ${activity.quantity}L (Grade ${activity.quality})` : `${activity.farmerName || 'Unknown Farmer'} delivered ${activity.quantity}L (Grade ${activity.quality})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(`${activity.date}T${activity.time || '00:00:00'}`), 'PPpp')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">
                {isFarmerView ? "You have no recent milk deliveries." : "No recent milk deliveries recorded."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Farmer, Delivery, Payment } from '@/types';
import { Users, Truck, Package, CreditCard, Activity, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { getFarmers } from '@/app/(app)/farmers/actions';
import { getDeliveries } from '@/app/(app)/deliveries/actions';
import { getPayments } from '@/app/(app)/payments/actions';
import { useToast } from '@/hooks/use-toast';

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
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [farmersData, deliveriesData, paymentsData] = await Promise.all([
          getFarmers(),
          getDeliveries(),
          getPayments(),
        ]);
        setFarmers(farmersData);
        setDeliveries(deliveriesData);
        setPayments(paymentsData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast({
          variant: "destructive",
          title: "Error Fetching Data",
          description: "Could not load dashboard data from the server.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
         <PageHeader title="Dashboard" description="Overview of your dairy operations." />
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysDeliveries = deliveries.filter(d => d.date === today);
  const todaysLiters = todaysDeliveries.reduce((sum, d) => sum + d.quantity, 0);
  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;

  const recentActivities = deliveries
    .sort((a, b) => {
      // Combine date and time for accurate sorting, handling potential nulls
      const dateTimeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
      return dateTimeB - dateTimeA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your dairy operations." />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Farmers" value={farmers.length} icon={Users} description="Registered in the system" />
        <StatCard title="Today's Deliveries" value={todaysDeliveries.length} icon={Truck} description={`On ${format(new Date(), 'PPP')}`} />
        <StatCard title="Today's Collection" value={`${todaysLiters.toFixed(1)} L`} icon={Package} description="Total milk quantity today" />
        <StatCard title="Pending Payments" value={pendingPaymentsCount} icon={CreditCard} description="Awaiting processing" />
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-6 w-6 text-primary" />
            Recent Milk Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length > 0 ? (
            <ScrollArea className="h-72">
              <ul className="space-y-4">
                {recentActivities.map(activity => (
                  <li key={activity.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {activity.farmerName || 'Unknown Farmer'} delivered {activity.quantity}L (Grade {activity.quality})
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
            <p className="text-muted-foreground text-center py-4">No recent milk deliveries recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

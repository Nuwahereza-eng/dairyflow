"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { initialFarmers, initialDeliveries, initialPayments, getFarmerName } from '@/lib/mockData';
import type { Farmer, Delivery, Payment } from '@/types';
import { Users, Truck, Package, CreditCard, Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

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

  // Simulate data fetching
  useEffect(() => {
    setFarmers(initialFarmers);
    // Enrich deliveries with farmer names for display
    const enrichedDeliveries = initialDeliveries.map(d => ({
      ...d,
      farmerName: getFarmerName(d.farmerId, initialFarmers)
    }));
    setDeliveries(enrichedDeliveries);
    setPayments(initialPayments);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysDeliveries = deliveries.filter(d => d.date === today);
  const todaysLiters = todaysDeliveries.reduce((sum, d) => sum + d.quantity, 0);
  const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;

  const recentActivities = deliveries
    .sort((a, b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your dairy operations." />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Farmers" value={farmers.length} icon={Users} />
        <StatCard title="Today's Deliveries" value={todaysDeliveries.length} icon={Truck} />
        <StatCard title="Today's Collection" value={`${todaysLiters.toFixed(1)} L`} icon={Package} />
        <StatCard title="Pending Payments" value={pendingPaymentsCount} icon={CreditCard} />
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-6 w-6 text-primary" />
            Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length > 0 ? (
            <ScrollArea className="h-72">
              <ul className="space-y-4">
                {recentActivities.map(activity => (
                  <li key={activity.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <Truck className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {activity.farmerName || 'Unknown Farmer'} delivered {activity.quantity}L (Grade {activity.quality})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.date + 'T' + activity.time), 'PPpp')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground">No recent activities.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

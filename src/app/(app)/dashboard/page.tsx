'use client';

import { AppHeader } from '@/components/layout/app-header';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RestaurantSetupCard } from '@/components/dashboard/restaurant-setup-card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useRestaurant } from '@/hooks/use-restaurant';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { hasRestaurant, isLoading, role } = useRestaurant();
  const router = useRouter();

  // Ajudantes têm acesso apenas a Cardápio, Mesas e Pedidos
  useEffect(() => {
    if (!isLoading && role && role !== 'admin') {
      router.replace('/orders');
    }
  }, [isLoading, role, router]);

  if (isLoading || !role || role !== 'admin') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </AppHeader>
        <main className="flex-1 p-4 md:p-8 pt-6 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl overflow-hidden shadow-xs ring-1 ring-primary/20 shrink-0 bg-primary/10 flex items-center justify-center">
            <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-xl font-bold">Dashboard</h1>
        </div>
      </AppHeader>
      <main className="flex-1 overflow-y-auto space-y-6 p-4 md:p-8 pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !hasRestaurant ? (
          <RestaurantSetupCard />
        ) : (
          <>
            <StatsCards />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <RevenueChart />
              <RecentOrders />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

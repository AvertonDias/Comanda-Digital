import { AppHeader } from '@/components/layout/app-header';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </AppHeader>
      <main className="flex-1 overflow-y-auto space-y-4 p-4 md:p-8 pt-6">
        <StatsCards />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevenueChart />
            <RecentOrders />
        </div>
      </main>
    </div>
  );
}

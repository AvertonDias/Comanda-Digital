import { RecentOrders } from '@/components/dashboard/recent-orders';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function DashboardPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </header>
      <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <StatsCards />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevenueChart />
            <RecentOrders />
        </div>
      </main>
    </>
  );
}

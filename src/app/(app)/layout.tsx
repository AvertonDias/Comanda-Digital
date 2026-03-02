import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
        <Sidebar>
            <AppSidebar />
        </Sidebar>
        <SidebarInset>
            <div className="min-h-screen flex flex-col">
                {children}
            </div>
        </SidebarInset>
    </SidebarProvider>
  );
}

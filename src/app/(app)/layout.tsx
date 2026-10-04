import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { InstallPWA } from '@/components/pwa/install-prompt';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
          <Sidebar>
              <AppSidebar />
          </Sidebar>
          <SidebarInset className="pb-20 md:pb-0 min-h-screen">
              {children}
          </SidebarInset>
          <MobileBottomNav />
          <InstallPWA />
      </SidebarProvider>
    </AuthGuard>
  );
}

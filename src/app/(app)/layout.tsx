import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { InstallPWA } from '@/components/pwa/install-prompt';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
          <Sidebar>
              <AppSidebar />
          </Sidebar>
          <SidebarInset>
              {children}
          </SidebarInset>
          <InstallPWA />
      </SidebarProvider>
    </AuthGuard>
  );
}
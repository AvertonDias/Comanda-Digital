import { SidebarTrigger } from "@/components/ui/sidebar";

export default function CustomersPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Clientes</h1>
      </header>
      <main className="flex-1 p-4 md:p-8">
        <p>Página de gerenciamento de clientes em construção.</p>
      </main>
    </>
  );
}

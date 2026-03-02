import { AppHeader } from "@/components/layout/app-header";
import { DUMMY_TABLES } from "@/lib/placeholder-data";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle } from "lucide-react";

export default function TablesPage() {
    return (
        <div className="flex flex-col h-screen bg-background">
             <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Gestão de Mesas</h1>
                <div className="ml-auto">
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Mesa
                    </Button>
                </div>
            </AppHeader>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {DUMMY_TABLES.map(table => (
                        <TableCard key={table.id} table={table} />
                    ))}
                </div>
            </main>
        </div>
    );
}

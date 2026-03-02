import { DUMMY_TABLES } from "@/lib/placeholder-data";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle } from "lucide-react";

export default function TablesPage() {
    return (
        <div className="flex flex-col h-screen">
             <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Gestão de Mesas</h1>
                <div className="ml-auto">
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Mesa
                    </Button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {DUMMY_TABLES.map(table => (
                        <TableCard key={table.id} table={table} />
                    ))}
                </div>
            </main>
        </div>
    );
}

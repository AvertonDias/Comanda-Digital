
'use client';

import { AppHeader } from "@/components/layout/app-header";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle, CheckCircle2, Users, LayoutGrid } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import type { Table } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function TablesPage() {
    const { restaurantId, isLoading, role } = useRestaurant();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [statusFilter, setStatusFilter] = useState<'all' | 'livre' | 'ocupada'>('all');

    const isAdmin = role === 'admin';

    const tablesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${restaurantId}/tables`),
            orderBy('name', 'asc')
        );
    }, [restaurantId, firestore]);

    const { data: tables, isLoading: isTablesLoading } = useCollection<Table>(
        tablesQuery ?? undefined
    );

    const handleAddTable = async () => {
        if (!restaurantId || !firestore) return;
        try {
            const nextNumber = (tables?.length || 0) + 1;
            const name = `Mesa ${nextNumber.toString().padStart(2, '0')}`;
            await addDoc(collection(firestore, `restaurants/${restaurantId}/tables`), {
                name,
                status: 'livre',
                restaurantId,
                qrCodeUrl: '',
                createdAt: serverTimestamp()
            });
            toast({ title: "Mesa adicionada!" });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao criar mesa" });
        }
    };

    if (isLoading || isTablesLoading) return <Skeleton className="h-screen w-full" />;

    const totalCount = tables?.length || 0;
    const freeCount = tables?.filter(t => t.status === 'livre').length || 0;
    const occupiedCount = tables?.filter(t => t.status === 'ocupada' || t.status === 'fechando').length || 0;

    const filteredTables = tables?.filter(t => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'livre') return t.status === 'livre';
        if (statusFilter === 'ocupada') return t.status === 'ocupada' || t.status === 'fechando';
        return true;
    });

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-black">Mesas do Salão</h1>
                {isAdmin && (
                    <div className="ml-auto">
                        <Button onClick={handleAddTable} className="font-bold gap-1.5 h-10 px-4">
                            <PlusCircle className="h-4 w-4" /> 
                            <span className="hidden sm:inline">Nova Mesa</span>
                        </Button>
                    </div>
                )}
            </AppHeader>

            {/* Barra de filtros rápidos para encontrar mesas sem complicação */}
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 overflow-x-auto">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'all'
                            ? "bg-foreground text-background border-foreground shadow-xs"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                >
                    <LayoutGrid className="h-4 w-4" />
                    Todas ({totalCount})
                </button>

                <button
                    onClick={() => setStatusFilter('livre')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'livre'
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-background text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    )}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Livres ({freeCount})
                </button>

                <button
                    onClick={() => setStatusFilter('ocupada')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'ocupada'
                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                            : "bg-background text-red-700 border-red-200 hover:bg-red-50"
                    )}
                >
                    <Users className="h-4 w-4" />
                    Ocupadas ({occupiedCount})
                </button>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredTables?.map((table) => (
                        <TableCard key={table.id} table={table} />
                    ))}
                    {filteredTables?.length === 0 && (
                        <div className="col-span-full text-center py-16 text-muted-foreground">
                            <p className="text-base font-semibold">Nenhuma mesa encontrada neste filtro.</p>
                            <Button 
                                variant="outline" 
                                className="mt-3 font-bold" 
                                onClick={() => setStatusFilter('all')}
                            >
                                Mostrar Todas as Mesas
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}


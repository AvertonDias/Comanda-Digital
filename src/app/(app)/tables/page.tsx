'use client';

import { AppHeader } from "@/components/layout/app-header";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import type { Table } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function TablesPage() {
    const { restaurantId, isLoading } = useRestaurant();
    const firestore = useFirestore();
    const { toast } = useToast();

    const tablesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        // Blindagem: Ordem alfabética rigorosa
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

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Mesas</h1>
                <div className="ml-auto">
                    <Button onClick={handleAddTable}><PlusCircle className="mr-2 h-4 w-4" /> Nova Mesa</Button>
                </div>
            </AppHeader>
            <main className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {tables?.map((table) => (
                        <TableCard key={table.id} table={table} />
                    ))}
                    {tables?.length === 0 && (
                        <p className="col-span-full text-center text-muted-foreground py-12">Nenhuma mesa cadastrada.</p>
                    )}
                </div>
            </main>
        </div>
    );
}

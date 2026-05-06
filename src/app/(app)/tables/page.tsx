'use client';

import { AppHeader } from "@/components/layout/app-header";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
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
        return query(
            collection(firestore, `restaurants/${restaurantId}/tables`), 
            orderBy('name', 'asc') // Ordenação alfabética obrigatória
        );
    }, [restaurantId, firestore]);

    const { data: tables, isLoading: isTablesLoading } = useCollection<Table>(tablesQuery);

    const handleAddTable = () => {
        if (!restaurantId) return;
        const nextNumber = (tables?.length || 0) + 1;
        const name = `Mesa ${nextNumber.toString().padStart(2, '0')}`;
        const colRef = collection(firestore, `restaurants/${restaurantId}/tables`);
        const data = {
            name,
            status: 'livre',
            restaurantId,
            qrCodeUrl: '',
            createdAt: serverTimestamp()
        };

        addDoc(colRef, data).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: data
            }));
        });
        toast({ title: "Mesa adicionada!", description: `${name} foi criada.` });
    };

    if (isLoading || isTablesLoading) return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;

    return (
        <div className="flex flex-col h-screen bg-background">
             <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Gestão de Mesas</h1>
                <div className="ml-auto">
                    <Button onClick={handleAddTable}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Mesa
                    </Button>
                </div>
            </AppHeader>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {tables?.map(table => (
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

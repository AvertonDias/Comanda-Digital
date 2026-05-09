'use client';

import { AppHeader } from "@/components/layout/app-header";
import { OrderKanbanBoard } from "@/components/orders/order-kanban-board";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle, X, ChevronLeft } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useState, Suspense, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

function OrdersContent({ tableId }: { tableId?: string }) {
  const { restaurantId, isLoading } = useRestaurant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  
  const clearFilter = () => {
    router.push('/orders');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">Pedidos</h1>
        </AppHeader>
        <main className="flex-1 p-4 md:p-6">
          <Skeleton className="h-full w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Pedidos</h1>
            {tableId && (
                <Badge variant="secondary" className="gap-2 px-3 py-1">
                    Filtro: Mesa
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={clearFilter}>
                        <X className="h-3 w-3" />
                    </Button>
                </Badge>
            )}
        </div>
        <div className="ml-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-4xl p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
              <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsDialogOpen(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <DialogTitle>Criar Novo Pedido</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto sm:p-6">
                <CreateOrderForm 
                  restaurantId={restaurantId!} 
                  initialTableId={tableId}
                  onSuccess={() => setIsDialogOpen(false)} 
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        {restaurantId ? (
            <OrderKanbanBoard 
                restaurantId={restaurantId} 
                tableId={tableId} 
            />
        ) : (
            <p>Erro ao carregar restaurante.</p>
        )}
      </main>
    </div>
  );
}

export default function OrdersPage(props: { searchParams: Promise<{ tableId?: string }> }) {
  const searchParams = use(props.searchParams);
  const tableId = searchParams.tableId;

  return (
    <Suspense fallback={
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Pedidos</h1>
            </AppHeader>
            <main className="flex-1 p-4 md:p-6">
                <Skeleton className="h-full w-full" />
            </main>
        </div>
    }>
        <OrdersContent tableId={tableId} />
    </Suspense>
  );
}
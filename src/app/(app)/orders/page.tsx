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
import { PlusCircle } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <div className="ml-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Pedido</DialogTitle>
              </DialogHeader>
              <CreateOrderForm />
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>
      <main className="flex-1 overflow-x-auto p-4 md:p-6">
        <OrderKanbanBoard />
      </main>
    </div>
  );
}

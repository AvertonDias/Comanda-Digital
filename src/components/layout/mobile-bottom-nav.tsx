'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Utensils, ClipboardList, BookOpen, PlusCircle, LayoutDashboard, Menu } from 'lucide-react';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreateOrderForm } from '@/components/orders/create-order-form';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { restaurantId, role } = useRestaurant();
  const { toggleSidebar } = useSidebar();
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const isAdmin = role === 'admin';

  // Se não estiver dentro de uma tela de restaurante, não mostra
  if (!restaurantId) return null;

  return (
    <>
      <nav 
        aria-label="Navegação rápida inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/98 backdrop-blur-md border-t-2 border-border shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {/* 1. Mesas */}
          <Link
            href="/tables"
            className={cn(
              "flex flex-col items-center justify-center h-full py-1 text-center transition-colors",
              pathname === '/tables'
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1 rounded-xl transition-all", pathname === '/tables' && "bg-primary/10")}>
              <Utensils className="h-5 w-5" />
            </div>
            <span className="text-[11px] leading-tight mt-0.5 font-bold">Mesas</span>
          </Link>

          {/* 2. Pedidos */}
          <Link
            href="/orders"
            className={cn(
              "flex flex-col items-center justify-center h-full py-1 text-center transition-colors",
              pathname === '/orders'
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1 rounded-xl transition-all", pathname === '/orders' && "bg-primary/10")}>
              <ClipboardList className="h-5 w-5" />
            </div>
            <span className="text-[11px] leading-tight mt-0.5 font-bold">Pedidos</span>
          </Link>

          {/* 3. Botão Central: Novo Pedido (Grande e destacado) */}
          <div className="flex items-center justify-center -mt-5">
            <button
              onClick={() => setIsOrderModalOpen(true)}
              className="flex flex-col items-center justify-center bg-primary text-primary-foreground h-14 w-14 rounded-full shadow-lg border-4 border-background active:scale-95 transition-transform"
              title="Anotar Novo Pedido"
            >
              <PlusCircle className="h-7 w-7" />
            </button>
          </div>

          {/* 4. Cardápio */}
          <Link
            href="/menu"
            className={cn(
              "flex flex-col items-center justify-center h-full py-1 text-center transition-colors",
              pathname === '/menu'
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1 rounded-xl transition-all", pathname === '/menu' && "bg-primary/10")}>
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-[11px] leading-tight mt-0.5 font-bold">Cardápio</span>
          </Link>

          {/* 5. Menu / Mais */}
          <button
            onClick={() => toggleSidebar()}
            className="flex flex-col items-center justify-center h-full py-1 text-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="p-1 rounded-xl">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[11px] leading-tight mt-0.5 font-bold">Menu</span>
          </button>
        </div>
      </nav>

      {/* Modal para criar pedido rápido diretamente pelo botão central */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-4xl p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
          <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold">Novo Pedido</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto sm:p-6">
            <CreateOrderForm
              restaurantId={restaurantId}
              onSuccess={() => setIsOrderModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

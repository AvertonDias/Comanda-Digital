
'use client';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

export default function MenuPage() {
  const { restaurantId, isLoading: isRestLoading } = useRestaurant();
  const firestore = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const categoriesQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
  }, [restaurantId, firestore]);

  const itemsQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/menuItems`));
  }, [restaurantId, firestore]);

  const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
  const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);

  const isLoading = isRestLoading || isCatsLoading || isItemsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">Cardápio</h1>
        </AppHeader>
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">Cardápio</h1>
        </AppHeader>
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="text-muted-foreground mb-4">Você ainda não tem categorias cadastradas.</p>
          <Button asChild variant="outline">
            <a href="/settings">Ir para Configurações</a>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Cardápio</h1>
        <div className="ml-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Item
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Adicionar novo item ao cardápio</DialogTitle>
                </DialogHeader>
                <MenuItemForm 
                    restaurantId={restaurantId!} 
                    categories={categories} 
                    onSuccess={() => setIsDialogOpen(false)}
                />
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs defaultValue={categories[0].id} className="w-full">
          <ScrollArea className="w-full whitespace-nowrap rounded-md">
            <TabsList className="flex w-max">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items?.filter((item) => item.categoryId === category.id).map((item) => (
                  <MenuItemCard key={item.id} item={{...item, categoryName: category.name}} />
                ))}
                {items?.filter((item) => item.categoryId === category.id).length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-12">Nenhum item nesta categoria.</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

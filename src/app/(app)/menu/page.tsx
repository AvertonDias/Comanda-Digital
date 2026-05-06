
'use client';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { CategoryManager } from '@/components/menu/category-manager';
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
  const { restaurantId, isLoading: isRestLoading, role } = useRestaurant();
  const firestore = useFirestore();
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);

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
  const isAdmin = role === 'admin';

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

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Cardápio</h1>
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                      <Settings2 className="mr-2 h-4 w-4" />
                      Categorias
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                      <DialogTitle>Gerenciar Categorias</DialogTitle>
                  </DialogHeader>
                  <CategoryManager restaurantId={restaurantId!} />
              </DialogContent>
            </Dialog>

            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
              <DialogTrigger asChild>
                  <Button size="sm" disabled={!categories || categories.length === 0}>
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
                      categories={categories || []} 
                      onSuccess={() => setIsItemDialogOpen(false)}
                  />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </AppHeader>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {!categories || categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
             <div className="bg-primary/10 p-6 rounded-full">
                <Settings2 className="h-12 w-12 text-primary" />
             </div>
             <div className="space-y-2">
                <h2 className="text-2xl font-bold">Aguardando Cardápio</h2>
                <p className="text-muted-foreground max-w-sm">
                    {isAdmin 
                      ? "Para adicionar itens ao seu cardápio, você precisa primeiro criar pelo menos uma categoria."
                      : "O administrador ainda não configurou as categorias do cardápio."}
                </p>
             </div>
             {isAdmin && (
               <Button onClick={() => setIsCatDialogOpen(true)}>
                  Criar Minha Primeira Categoria
               </Button>
             )}
          </div>
        ) : (
          <Tabs defaultValue={categories[0].id} className="w-full">
            <ScrollArea className="w-full whitespace-nowrap rounded-md border-b pb-2">
              <TabsList className="flex w-max bg-transparent h-auto p-0 gap-2">
                {categories.map((category) => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items?.filter((item) => item.categoryId === category.id).map((item) => (
                    <MenuItemCard key={item.id} item={{...item, categoryName: category.name}} />
                  ))}
                  {items?.filter((item) => item.categoryId === category.id).length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl">
                      <p className="text-muted-foreground">Nenhum item nesta categoria.</p>
                      {isAdmin && (
                        <Button variant="link" onClick={() => setIsItemDialogOpen(true)}>
                          Adicionar item agora
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}

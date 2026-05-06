'use client';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings2, Search, Clock, MapPin, ChevronLeft } from 'lucide-react';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { CategoryManager } from '@/components/menu/category-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function MenuPage() {
  const { restaurantId, isLoading: isRestLoading, role } = useRestaurant();
  const firestore = useFirestore();
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');

  const restaurantRef = useMemoFirebase(() => 
    restaurantId ? doc(firestore, 'restaurants', restaurantId) : null, 
    [restaurantId, firestore]
  );
  const { data: restaurant } = useDoc(restaurantRef);

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

  useMemo(() => {
    if (categories && categories.length > 0 && !activeTab) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger />
          <h1 className="text-xl font-semibold">Cardápio</h1>
        </AppHeader>
        <main className="flex-1 p-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-tight truncate max-w-[150px]">{restaurant?.name || 'Cardápio'}</h1>
            <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-600 font-bold uppercase">Aberto</span>
            </div>
        </div>
        
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                      <Settings2 className="h-4 w-4" />
                  </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-[500px] p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
                  <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsCatDialogOpen(false)}>
                          <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <DialogTitle>Categorias</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="flex-1 p-4">
                    <CategoryManager restaurantId={restaurantId!} />
                  </ScrollArea>
              </DialogContent>
            </Dialog>

            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
              <DialogTrigger asChild>
                  <Button size="sm" className="h-8 gap-1 px-2 text-[10px] font-bold uppercase" disabled={!categories || categories.length === 0}>
                      <PlusCircle className="h-3 w-3" />
                      Novo
                  </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-[800px] p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
                  <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsItemDialogOpen(false)}>
                          <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <DialogTitle>Novo Item</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="flex-1 p-4 sm:p-6">
                      <MenuItemForm 
                          restaurantId={restaurantId!} 
                          categories={categories || []} 
                          onSuccess={() => setIsItemDialogOpen(false)}
                      />
                  </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </AppHeader>

      <main className="flex-1 pb-24">
        {/* Banner Responsivo */}
        <div className="relative py-8 md:py-16 bg-primary/5 overflow-hidden flex items-center justify-center border-b">
            <div className="text-center space-y-3 px-4 max-w-full">
                <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter break-words leading-none">
                    {restaurant?.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-[9px] md:text-xs font-black uppercase text-muted-foreground">
                    <span className="flex items-center gap-1.5 bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                        <Clock className="h-3 w-3 text-primary" /> 
                        30-45 min
                    </span>
                    <span className="hidden sm:inline opacity-30">•</span>
                    <span className="flex items-center gap-1.5 bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                        <MapPin className="h-3 w-3 text-primary" /> 
                        Consumo Local
                    </span>
                </div>
            </div>
            {/* Elemento Decorativo */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -top-6 -left-6 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
            <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Buscar pratos ou bebidas..." 
                        className="pl-9 h-10 bg-muted/50 border-none rounded-full focus-visible:ring-primary text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                {!searchQuery && categories && categories.length > 0 && (
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-1">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                                        activeTab === cat.id 
                                        ? 'bg-primary text-white shadow-md scale-105' 
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" className="hidden" />
                    </ScrollArea>
                )}
            </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 space-y-8">
            {categories?.filter(c => !activeTab || c.id === activeTab || searchQuery).map(category => {
                const categoryItems = filteredItems.filter(i => i.categoryId === category.id);
                if (categoryItems.length === 0) return null;

                return (
                    <div key={category.id} className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <span className="h-px w-4 bg-primary" />
                            {category.name}
                        </h3>
                        <div className="grid grid-cols-1 gap-1">
                            {categoryItems.map(item => (
                                <MenuItemCard 
                                    key={item.id} 
                                    item={{...item, categoryName: category.name}}
                                    categories={categories || []}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                    <Search className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm font-black uppercase tracking-tighter">Nenhum item encontrado</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
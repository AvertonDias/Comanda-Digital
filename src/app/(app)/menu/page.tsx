'use client';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings2, Search, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

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

  // Define initial tab when categories load
  useMemo(() => {
    if (categories && categories.length > 0 && !activeTab) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader>
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-xl font-semibold">Cardápio</h1>
        </AppHeader>
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">{restaurant?.name || 'Cardápio'}</h1>
            <span className="text-xs text-green-600 font-medium">Aberto agora</span>
        </div>
        
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

      <main className="flex-1 overflow-y-auto pb-20">
        {/* Banner Section */}
        <div className="bg-primary/5 p-6 border-b">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg">
                    {restaurant?.name?.charAt(0) || 'R'}
                </div>
                <div className="flex-1 space-y-2">
                    <h2 className="text-2xl font-bold">{restaurant?.name}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Ver informações</span>
                        <span>•</span>
                        <span>Min. R$ 20,00</span>
                        <span>•</span>
                        <span>30-50 min</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                        Entrega Grátis
                    </Badge>
                </div>
            </div>
        </div>

        {/* Search & Categories Bar */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
            <div className="max-w-4xl mx-auto px-4 py-3 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar no cardápio..." 
                        className="pl-9 bg-muted/50 border-none"
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
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        activeTab === cat.id 
                                        ? 'bg-primary text-primary-foreground shadow-sm' 
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                    }`}
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

        {/* Menu Items List */}
        <div className="max-w-4xl mx-auto p-4 space-y-8">
            {categories?.filter(c => !activeTab || c.id === activeTab || searchQuery).map(category => {
                const categoryItems = filteredItems.filter(i => i.categoryId === category.id);
                if (categoryItems.length === 0) return null;

                return (
                    <div key={category.id} className="space-y-4">
                        <h3 className="text-lg font-bold border-l-4 border-primary pl-3">
                            {category.name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {(!categories || categories.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <Settings2 className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground max-w-xs">
                        Nenhuma categoria cadastrada. Comece configurando as seções do seu cardápio.
                    </p>
                    {isAdmin && (
                        <Button onClick={() => setIsCatDialogOpen(true)}>
                            Gerenciar Categorias
                        </Button>
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
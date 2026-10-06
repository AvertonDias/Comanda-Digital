'use client';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { PlusCircle, Settings2, Search, Clock, MapPin, ChevronLeft, Bike, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { CategoryManager } from '@/components/menu/category-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory, Restaurant } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function MenuPage() {
  const { restaurantId, isLoading: isRestLoading, role } = useRestaurant();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');
  const [isCleaning, setIsCleaning] = useState(false);

  const restaurantRef = useMemoFirebase(() => 
    restaurantId ? doc(firestore, 'restaurants', restaurantId) : null, 
    [restaurantId, firestore]
  );
  const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
  }, [restaurantId, firestore]);

  const itemsQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/menuItems`));
  }, [restaurantId, firestore]);

  const { data: rawCategories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
  const { data: rawItems, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);

  const isLoading = isRestLoading || isCatsLoading || isItemsLoading;
  const isAdmin = role === 'admin';

  // Deduplicação inteligente de categorias no Frontend
  const { uniqueCategories, duplicateCategoryDocs, categoryIdMap } = useMemo(() => {
    if (!rawCategories) return { 
      uniqueCategories: [], 
      duplicateCategoryDocs: [] as MenuItemCategory[], 
      categoryIdMap: new Map<string, string[]>() 
    };

    const nameMap = new Map<string, MenuItemCategory>();
    const dupes: MenuItemCategory[] = [];
    const idAliases = new Map<string, string[]>(); // canonicalId -> [canonicalId, dupId1, dupId2...]

    rawCategories.forEach(cat => {
      const normalized = (cat.name || '').trim().toLowerCase();
      if (!nameMap.has(normalized)) {
        nameMap.set(normalized, cat);
        idAliases.set(cat.id, [cat.id]);
      } else {
        const canonical = nameMap.get(normalized)!;
        dupes.push(cat);
        const currentList = idAliases.get(canonical.id) || [canonical.id];
        currentList.push(cat.id);
        idAliases.set(canonical.id, currentList);
      }
    });

    const uniqueList = Array.from(nameMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
      uniqueCategories: uniqueList,
      duplicateCategoryDocs: dupes,
      categoryIdMap: idAliases
    };
  }, [rawCategories]);

  // Deduplicação de itens (se o mesmo item foi gravado repetidamente com o mesmo nome e categoria)
  const { uniqueItems, duplicateItemDocs } = useMemo(() => {
    if (!rawItems) return { uniqueItems: [], duplicateItemDocs: [] as MenuItem[] };

    const itemMap = new Map<string, MenuItem>();
    const dupes: MenuItem[] = [];

    rawItems.forEach(item => {
      const key = `${(item.name || '').trim().toLowerCase()}-${item.price}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, item);
      } else {
        dupes.push(item);
      }
    });

    return {
      uniqueItems: Array.from(itemMap.values()),
      duplicateItemDocs: dupes
    };
  }, [rawItems]);

  useEffect(() => {
    if (uniqueCategories.length > 0 && (!activeTab || !uniqueCategories.some(c => c.id === activeTab))) {
      setActiveTab(uniqueCategories[0].id);
    }
  }, [uniqueCategories, activeTab]);

  const filteredItems = useMemo(() => {
    if (!uniqueItems) return [];
    return uniqueItems.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [uniqueItems, searchQuery]);

  // Função para limpar categorias e itens duplicados diretamente no banco de dados Firestore
  const handleCleanDuplicates = async () => {
    if (!restaurantId || !firestore) return;
    setIsCleaning(true);

    try {
      let totalDeleted = 0;

      // 1. Reassociar itens vinculados a categorias duplicadas para a categoria canônica
      if (duplicateCategoryDocs.length > 0 && rawItems) {
        for (const [canonicalId, aliasIds] of categoryIdMap.entries()) {
          const duplicateIds = aliasIds.filter(id => id !== canonicalId);
          if (duplicateIds.length > 0) {
            const affectedItems = rawItems.filter(item => duplicateIds.includes(item.categoryId));
            for (const item of affectedItems) {
              const itemRef = doc(firestore, `restaurants/${restaurantId}/menuItems`, item.id);
              await updateDoc(itemRef, { categoryId: canonicalId }).catch(() => {});
            }
          }
        }

        // Deletar as categorias duplicadas do Firestore
        for (const dupe of duplicateCategoryDocs) {
          const catRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories`, dupe.id);
          await deleteDoc(catRef).catch(() => {});
          totalDeleted++;
        }
      }

      // 2. Deletar itens estritamente duplicados se houver
      if (duplicateItemDocs.length > 0) {
        for (const itemDupe of duplicateItemDocs) {
          const itemRef = doc(firestore, `restaurants/${restaurantId}/menuItems`, itemDupe.id);
          await deleteDoc(itemRef).catch(() => {});
          totalDeleted++;
        }
      }

      toast({
        title: "Cardápio limpo com sucesso!",
        description: `${totalDeleted} registros duplicados foram unificados e removidos do banco de dados.`
      });
    } catch (error: any) {
      console.error("Erro ao limpar duplicados do cardápio:", error);
      toast({
        variant: "destructive",
        title: "Erro ao limpar",
        description: "Ocorreu um erro ao limpar alguns itens duplicados."
      });
    } finally {
      setIsCleaning(false);
    }
  };

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

  const hasAnyDuplicates = duplicateCategoryDocs.length > 0 || duplicateItemDocs.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl overflow-hidden shadow-xs ring-1 ring-primary/20 shrink-0 bg-primary/10 flex items-center justify-center">
            <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col">
              <h1 className="text-sm font-black uppercase tracking-tight truncate max-w-[150px]">{restaurant?.name || 'Cardápio'}</h1>
              <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-600 font-bold uppercase">Aberto</span>
              </div>
          </div>
        </div>
        
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
              <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Gerenciar Categorias">
                      <Settings2 className="h-4 w-4" />
                  </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-[500px] p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
                  <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsCatDialogOpen(false)}>
                          <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <DialogTitle>Categorias do Cardápio</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="flex-1 p-4">
                    <CategoryManager restaurantId={restaurantId!} />
                  </ScrollArea>
              </DialogContent>
            </Dialog>

            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
              <DialogTrigger asChild>
                  <Button size="sm" className="h-8 gap-1 px-2.5 text-xs font-bold uppercase" disabled={uniqueCategories.length === 0}>
                      <PlusCircle className="h-3.5 w-3.5" />
                      Novo Item
                  </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[90vh] sm:max-w-[800px] p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
                  <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsItemDialogOpen(false)}>
                          <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <DialogTitle>Novo Item do Cardápio</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden">
                      <MenuItemForm 
                          restaurantId={restaurantId!} 
                          categories={uniqueCategories} 
                          onSuccess={() => setIsItemDialogOpen(false)}
                      />
                  </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </AppHeader>

      {/* Aviso de duplicados com botão de correção imediata */}
      {hasAnyDuplicates && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Foram detectados <strong>{duplicateCategoryDocs.length} categorias</strong> e <strong>{duplicateItemDocs.length} itens duplicados</strong>. As abas abaixo já foram unificadas.
            </span>
          </div>
          <Button 
            size="sm" 
            variant="link" 
            onClick={handleCleanDuplicates}
            disabled={isCleaning}
            className="text-xs font-bold text-amber-900 underline p-0 h-auto"
          >
            Remover do Banco
          </Button>
        </div>
      )}

      <main className="flex-1 pb-24">
        {/* Banner Responsivo */}
        <div className="relative py-8 md:py-16 bg-primary/5 overflow-hidden flex items-center justify-center border-b">
            <div className="text-center space-y-4 px-4 max-w-full z-10">
                <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter break-words leading-none">
                    {restaurant?.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                    {restaurant?.openingHours && (
                        <span className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm text-[9px] md:text-xs font-black uppercase text-muted-foreground">
                            <Clock className="h-3 w-3 text-primary" /> 
                            {restaurant.openingHours}
                        </span>
                    )}
                    {restaurant?.deliveryFee !== undefined && (
                        <span className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm text-[9px] md:text-xs font-black uppercase text-muted-foreground">
                            <Bike className="h-3 w-3 text-primary" /> 
                            Entrega: {restaurant.deliveryFee === 0 ? 'Grátis' : `R$ ${restaurant.deliveryFee.toFixed(2)}`}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm text-[9px] md:text-xs font-black uppercase text-muted-foreground">
                        <MapPin className="h-3 w-3 text-primary" /> 
                        {restaurant?.city || 'Local'}
                    </span>
                </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
        </div>

        {/* Busca e Abas de Categorias Deduplicadas */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
            <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        placeholder="Buscar pratos ou bebidas..." 
                        className="pl-9 h-11 bg-muted/50 border-none rounded-full focus-visible:ring-primary text-xs font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                {!searchQuery && uniqueCategories.length > 0 && (
                    <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar -mx-4 px-4 scroll-smooth">
                        {uniqueCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveTab(cat.id);
                                    if (window.navigator.vibrate) window.navigator.vibrate(5);
                                }}
                                className={cn(
                                    "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 border-2",
                                    activeTab === cat.id 
                                    ? 'bg-primary border-primary text-white shadow-lg scale-105 z-10' 
                                    : 'bg-muted border-transparent hover:bg-muted/80 text-muted-foreground'
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Listagem de Itens por Categoria Única */}
        <div className="max-w-3xl mx-auto p-4 space-y-10">
            {uniqueCategories
              .filter(c => !activeTab || c.id === activeTab || searchQuery)
              .map(category => {
                const aliasIds = categoryIdMap.get(category.id) || [category.id];
                const categoryItems = filteredItems.filter(i => aliasIds.includes(i.categoryId));
                if (categoryItems.length === 0) return null;

                return (
                    <div key={category.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                            <span className="h-1 w-1 rounded-full bg-primary" />
                            {category.name}
                            <span className="flex-1 h-px bg-primary/10" />
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {categoryItems.map(item => (
                                <MenuItemCard 
                                    key={item.id} 
                                    item={{...item, categoryName: category.name}}
                                    categories={uniqueCategories}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 opacity-40">
                    <Search className="h-16 w-16 text-muted-foreground mb-2" />
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-tighter">Nenhum item encontrado</p>
                        <p className="text-xs font-bold uppercase text-muted-foreground">Tente buscar por outro nome ou categoria</p>
                    </div>
                    {searchQuery && (
                      <Button variant="outline" size="sm" className="font-black uppercase text-[10px]" onClick={() => setSearchQuery('')}>Limpar Busca</Button>
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

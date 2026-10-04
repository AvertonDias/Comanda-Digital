
'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory, Restaurant, Table } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Search, Clock, MapPin, ChevronLeft, Plus, X, UtensilsCrossed } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemSelectionDialog } from '@/components/orders/menu-item-selection-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

type CartItem = {
    menuItemId: string;
    name: string;
    quantity: number;
    priceAtOrder: number;
    notes?: string;
    addons: { name: string; price: number }[];
    ingredientExtrasPrice: number;
    printSectorId: string;
    preparationTimeAtOrder: number;
};

export default function PublicMenuPage(props: { params: Promise<{ restaurantId: string, tableId: string }> }) {
    const { restaurantId, tableId } = use(props.params);
    const firestore = useFirestore();
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Data
    const restaurantRef = useMemoFirebase(() => doc(firestore, 'restaurants', restaurantId), [restaurantId, firestore]);
    const tableRef = useMemoFirebase(() => doc(firestore, `restaurants/${restaurantId}/tables`, tableId), [restaurantId, tableId, firestore]);
    const categoriesQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc')), [restaurantId, firestore]);
    const itemsQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItems`)), [restaurantId, firestore]);

    const { data: restaurant, isLoading: isRestLoading } = useDoc<Restaurant>(restaurantRef);
    const { data: table, isLoading: isTableLoading } = useDoc<Table>(tableRef);
    const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);

    const isLoading = isRestLoading || isTableLoading || isCatsLoading || isItemsLoading;

    useEffect(() => {
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

    const cartTotal = useMemo(() => {
        return cart.reduce((acc, item) => acc + (item.priceAtOrder + (item.ingredientExtrasPrice || 0) + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity, 0);
    }, [cart]);

    const handleAddToCart = (data: any) => {
        setCart(prev => [...prev, {
            menuItemId: data.item.id,
            name: data.item.name,
            quantity: data.quantity,
            priceAtOrder: data.item.price,
            notes: data.notes,
            addons: data.addons.map((a: any) => ({ name: a.name, price: a.price })),
            ingredientExtrasPrice: data.ingredientsExtraPrice,
            printSectorId: data.item.printSectorId,
            preparationTimeAtOrder: data.item.preparationTime || 0
        }]);
        setSelectedItem(null);
        toast({ title: "Adicionado ao carrinho!" });
    };

    const handleItemClick = (item: MenuItem) => {
        const hasIngredients = item.ingredients && item.ingredients.length > 0;
        const hasAddons = item.addonGroups && item.addonGroups.length > 0;

        if (!hasIngredients && !hasAddons) {
            handleAddToCart({
                item,
                quantity: 1,
                addons: [],
                notes: "",
                ingredientsExtraPrice: 0
            });
        } else {
            setSelectedItem(item);
        }
    };

    const handleRemoveFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const handlePlaceOrder = async () => {
        if (cart.length === 0 || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const ordersCol = collection(firestore, `restaurants/${restaurantId}/orders`);
            const snapshot = await getCountFromServer(ordersCol);
            const nextOrderNumber = (snapshot.data().count || 0) + 1;

            const orderData = {
                restaurantId,
                orderNumber: nextOrderNumber,
                origin: 'mesa',
                destination: 'local',
                tableId,
                tableName: table?.name || 'Mesa',
                status: 'aberto',
                total: cartTotal,
                createdAt: serverTimestamp(),
                items: cart.map(item => ({ ...item, status: 'pendente' }))
            };

            await addDoc(ordersCol, orderData);
            setCart([]);
            setIsCartOpen(false);
            toast({ title: "Pedido enviado para a cozinha!", description: "Aguarde enquanto preparamos seu prato." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao enviar pedido" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-screen bg-background p-4 space-y-4">
                <Skeleton className="h-12 w-3/4 mx-auto" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            </div>
        );
    }

    if (!restaurant) {
        return <div className="flex items-center justify-center h-screen">Restaurante não encontrado.</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background pb-32">
            {/* Header / Banner */}
            <div className="relative py-8 bg-primary/5 border-b overflow-hidden">
                <div className="text-center space-y-3 px-4 relative z-10">
                    <UtensilsCrossed className="h-8 w-8 text-primary mx-auto mb-2" />
                    <h1 className="text-2xl font-black uppercase tracking-tighter">{restaurant.name}</h1>
                    <div className="flex items-center justify-center gap-2">
                        <Badge variant="secondary" className="bg-primary text-white font-black uppercase text-[10px]">
                            {table?.name || 'Mesa'}
                        </Badge>
                        {restaurant.openingHours && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                                <Clock className="h-3 w-3" /> {restaurant.openingHours}
                            </span>
                        )}
                    </div>
                </div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl" />
            </div>

            {/* Sticky Search & Categories */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
                <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="O que deseja comer hoje?" 
                            className="pl-9 h-11 bg-muted/50 border-none rounded-full text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    {!searchQuery && (
                        <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar -mx-4 px-4">
                            {categories?.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
                                    className={cn(
                                        "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                                        activeTab === cat.id 
                                        ? 'bg-primary border-primary text-white shadow-lg' 
                                        : 'bg-muted border-transparent text-muted-foreground'
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Menu Items */}
            <main className="max-w-3xl mx-auto p-4 space-y-10 mt-4">
                {categories?.filter(c => !activeTab || c.id === activeTab || searchQuery).map(category => {
                    const categoryItems = filteredItems.filter(i => i.categoryId === category.id && i.isAvailable);
                    if (categoryItems.length === 0) return null;

                    return (
                        <div key={category.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <span className="h-1 w-1 rounded-full bg-primary" />
                                {category.name}
                                <span className="flex-1 h-px bg-primary/10" />
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {categoryItems.map(item => (
                                    <div key={item.id} onClick={() => handleItemClick(item)}>
                                        <MenuItemCard 
                                            item={{...item, categoryName: category.name}}
                                            categories={categories || []}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredItems.length === 0 && (
                    <div className="text-center py-20 opacity-40">
                        <Search className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-black uppercase text-sm">Nenhum item encontrado</p>
                    </div>
                )}
            </main>

            {/* Floating Cart Button */}
            {cart.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
                    <Button 
                        onClick={() => setIsCartOpen(true)}
                        className="w-full h-16 rounded-2xl bg-black hover:bg-zinc-900 text-white shadow-2xl flex justify-between px-6 font-black uppercase transition-all active:scale-95"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-primary text-white h-8 w-8 rounded-lg flex items-center justify-center text-xs">
                                {cart.length}
                            </div>
                            <span>Ver Pedido</span>
                        </div>
                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartTotal)}</span>
                    </Button>
                </div>
            )}

            {/* Customization Dialog */}
            <MenuItemSelectionDialog 
                item={selectedItem}
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                onConfirm={handleAddToCart}
            />

            {/* Cart Sidebar/Sheet */}
            {isCartOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 border-b flex items-center justify-between">
                        <Button variant="ghost" size="icon" onClick={() => setIsCartOpen(false)}><ChevronLeft /></Button>
                        <h2 className="font-black uppercase tracking-tight">Seu Pedido</h2>
                        <div className="w-10" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="bg-primary/5 p-4 rounded-xl border-2 border-primary/20 flex items-center gap-4">
                            <Badge variant="outline" className="h-10 w-10 p-0 flex items-center justify-center text-lg border-primary text-primary bg-background">
                                {table?.name.replace(/\D/g, '') || '??'}
                            </Badge>
                            <div>
                                <p className="text-xs font-black uppercase leading-none">{restaurant.name}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{table?.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {cart.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start bg-muted/20 p-4 rounded-xl border-2 group">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-sm font-black uppercase truncate">{item.quantity}x {item.name}</p>
                                        {item.addons.map((a, ai) => (
                                            <p key={ai} className="text-[10px] text-muted-foreground font-bold uppercase">+ {a.name}</p>
                                        ))}
                                        {item.notes && <p className="text-[10px] text-primary italic mt-1 font-bold">Obs: {item.notes}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <p className="text-sm font-black">R$ {((item.priceAtOrder + (item.ingredientExtrasPrice || 0) + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity).toFixed(2)}</p>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveFromCart(idx)}><X className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 bg-background border-t-2 shadow-2xl mt-auto">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-muted-foreground font-black uppercase text-xs">Total do Pedido</span>
                            <span className="text-2xl font-black text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartTotal)}
                            </span>
                        </div>
                        <Button 
                            className="w-full h-14 bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-black uppercase text-lg shadow-xl"
                            onClick={handlePlaceOrder}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Enviando..." : "Confirmar e Pedir"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

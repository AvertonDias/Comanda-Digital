
'use client';

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { MenuItem, MenuItemCategory, Table, Restaurant } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed, ShoppingCart, Plus, Minus, Send } from "lucide-react";
import Image from "next/image";

export default function PublicMenuPage({ params }: { params: { restaurantId: string; tableId: string } }) {
    const { restaurantId, tableId } = params;
    const firestore = useFirestore();
    const { toast } = useToast();
    const [restaurant, setRestaurant] = useState<any>(null);
    const [table, setTable] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const loadContext = async () => {
            const restSnap = await getDoc(doc(firestore, "restaurants", restaurantId));
            const tableSnap = await getDoc(doc(firestore, `restaurants/${restaurantId}/tables`, tableId));
            if (restSnap.exists()) setRestaurant(restSnap.data());
            if (tableSnap.exists()) setTable(tableSnap.data());
        };
        loadContext();
    }, [restaurantId, tableId, firestore]);

    const categoriesQ = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc')), [restaurantId, firestore]);
    const itemsQ = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItems`), where('isAvailable', '==', true)), [restaurantId, firestore]);

    const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQ);
    const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQ);

    const handleAddToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, quantity: 1 }];
        });
        toast({ title: "Adicionado!", description: `${item.name} está no seu carrinho.` });
    };

    const handleUpdateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
    };

    const handleSendOrder = async () => {
        if (cart.length === 0) return;
        setIsSending(true);
        try {
            const orderData = {
                restaurantId,
                tableId,
                tableName: table?.name || "Mesa QR",
                status: 'aberto',
                origin: 'mesa',
                destination: 'local',
                total: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
                createdAt: serverTimestamp(),
                items: cart.map(i => ({
                    menuItemId: i.id,
                    name: i.name,
                    quantity: i.quantity,
                    priceAtOrder: i.price,
                    status: 'pendente',
                    printSectorId: i.printSectorId
                }))
            };
            await addDoc(collection(firestore, `restaurants/${restaurantId}/orders`), orderData);
            setCart([]);
            toast({ title: "Pedido enviado!", description: "Aguarde enquanto preparamos seu prato." });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao enviar", description: "Por favor, peça ajuda ao garçom." });
        } finally {
            setIsSending(false);
        }
    };

    if (isCatsLoading || isItemsLoading || !restaurant) return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;

    const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <UtensilsCrossed className="text-primary h-6 w-6" />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">{restaurant.name}</h1>
                        <p className="text-xs text-muted-foreground">{table?.name || "Mesa Local"}</p>
                    </div>
                </div>
                {cart.length > 0 && (
                    <Badge className="animate-bounce bg-primary text-white">
                        <ShoppingCart className="h-3 w-3 mr-1" /> {cart.length}
                    </Badge>
                )}
            </header>

            <main className="flex-1 pb-32">
                <Tabs defaultValue={categories?.[0]?.id} className="w-full">
                    <ScrollArea className="w-full whitespace-nowrap bg-muted/50 py-2">
                        <TabsList className="flex w-max px-4 bg-transparent">
                            {categories?.map(cat => (
                                <TabsTrigger key={cat.id} value={cat.id} className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white">
                                    {cat.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    {categories?.map(cat => (
                        <TabsContent key={cat.id} value={cat.id} className="p-4 grid gap-4">
                            {items?.filter(i => i.categoryId === cat.id).map(item => (
                                <Card key={item.id} className="flex overflow-hidden">
                                    <div className="relative w-24 h-24 shrink-0">
                                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 p-3 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-sm">{item.name}</h3>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="font-bold text-primary">R$ {item.price.toFixed(2)}</span>
                                            <Button size="sm" onClick={() => handleAddToCart(item)} className="h-8 rounded-full">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>
                    ))}
                </Tabs>
            </main>

            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-2xl z-50 animate-in slide-in-from-bottom">
                    <ScrollArea className="max-h-40 mb-4">
                        {cart.map(i => (
                            <div key={i.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div className="text-sm">
                                    <span className="font-bold">{i.quantity}x</span> {i.name}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(i.id, -1)}><Minus /></Button>
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(i.id, 1)}><Plus /></Button>
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                    <Button className="w-full h-12 text-lg font-bold gap-2" disabled={isSending} onClick={handleSendOrder}>
                        <Send className="h-5 w-5" /> Enviar Pedido • R$ {total.toFixed(2)}
                    </Button>
                </div>
            )}
        </div>
    );
}

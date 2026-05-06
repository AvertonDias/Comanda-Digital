'use client';
import { useState } from 'react';
import type { MenuItem, OrderItem, Table, Order, MenuItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, Minus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type NewOrderItem = Omit<OrderItem, 'id' | 'priceAtOrder' | 'orderId'> & { price: number };

export function CreateOrderForm({ restaurantId, onSuccess }: { restaurantId: string, onSuccess: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [origin] = useState<Order['origin']>('mesa');
    const [tableId, setTableId] = useState<string | undefined>(undefined);
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categoriesQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
    }, [restaurantId, firestore]);

    const itemsQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/menuItems`));
    }, [restaurantId, firestore]);

    const tablesQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/tables`), orderBy('name', 'asc'));
    }, [restaurantId, firestore]);

    const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);
    const { data: tables, isLoading: isTablesLoading } = useCollection<Table>(tablesQuery);

    const handleAddItem = (item: MenuItem) => {
        setOrderItems(prev => {
            const existing = prev.find(i => i.menuItemId === item.id && !i.notes);
            if (existing) return prev.map(i => (i.menuItemId === item.id && !i.notes) ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, price: item.price, notes: '' }];
        });
    };

    const handleUpdateQuantity = (idx: number, delta: number) => {
        setOrderItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0));
    };

    const handleCreateOrder = async () => {
        if (orderItems.length === 0 || isSubmitting || !restaurantId) return;
        setIsSubmitting(true);
        const selectedTable = tables?.find(t => t.id === tableId);
        
        const orderData = {
            restaurantId,
            origin,
            destination: 'local',
            tableId: tableId || null,
            tableName: selectedTable?.name || null,
            status: 'aberto',
            total: orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0),
            createdAt: serverTimestamp(),
            items: orderItems.map(item => ({
                menuItemId: item.menuItemId,
                name: item.name,
                quantity: item.quantity,
                priceAtOrder: item.price,
                notes: item.notes || null
            }))
        };
        
        await addDoc(collection(firestore, `restaurants/${restaurantId}/orders`), orderData);
        if (tableId) {
            await updateDoc(doc(firestore, `restaurants/${restaurantId}/tables`, tableId), { status: 'ocupada' });
        }
        toast({ title: "Pedido enviado!" });
        onSuccess();
    };

    if (isCatsLoading || isItemsLoading || isTablesLoading) return <Skeleton className="h-[70vh]" />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:h-[75vh]">
            <div className="flex flex-col">
                <Tabs defaultValue={categories?.[0]?.id} className="flex-1 flex flex-col">
                    <ScrollArea className="w-full whitespace-nowrap">
                        <TabsList className="flex w-max">
                            {categories?.map(c => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                    <ScrollArea className="flex-1 mt-4">
                        {categories?.map(c => (
                            <TabsContent key={c.id} value={c.id} className="grid grid-cols-2 gap-3">
                                {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                    <Card key={item.id} className="p-3 cursor-pointer hover:border-primary" onClick={() => handleAddItem(item)}>
                                        <p className="text-sm font-semibold">{item.name}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">R$ {item.price.toFixed(2)}</p>
                                    </Card>
                                ))}
                            </TabsContent>
                        ))}
                    </ScrollArea>
                </Tabs>
            </div>
            <div className="flex flex-col gap-4">
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader className="py-4 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg">Comanda</CardTitle>
                            <Badge variant="outline">{orderItems.length} Itens</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-2">
                            <Select value={tableId} onValueChange={setTableId}>
                                <SelectTrigger><SelectValue placeholder="Selecione a Mesa" /></SelectTrigger>
                                <SelectContent>
                                    {tables?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({t.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-4">
                                {orderItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center border-b pb-2">
                                        <span className="text-sm">{item.name}</span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleUpdateQuantity(idx, -1)}><Minus /></Button>
                                            <span className="text-sm">{item.quantity}</span>
                                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleUpdateQuantity(idx, 1)}><Plus /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                <Button className="w-full" disabled={orderItems.length === 0 || isSubmitting} onClick={handleCreateOrder}>
                    {isSubmitting ? "Enviando..." : "Finalizar Pedido"}
                </Button>
            </div>
        </div>
    );
}

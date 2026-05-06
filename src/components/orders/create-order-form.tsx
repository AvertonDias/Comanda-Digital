
'use client';
import { useState } from 'react';
import type { MenuItem, OrderItem, Table, Order, MenuItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type NewOrderItem = Omit<OrderItem, 'id' | 'priceAtOrder' | 'orderId'> & { price: number };

export function CreateOrderForm({ restaurantId, onSuccess }: { restaurantId: string, onSuccess: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [origin, setOrigin] = useState<Order['origin']>('mesa');
    const [destination, setDestination] = useState<Order['destination']>('local');
    const [tableId, setTableId] = useState<string | undefined>(undefined);
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const categoriesQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc')), [restaurantId, firestore]);
    const itemsQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItems`)), [restaurantId, firestore]);
    const tablesQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/tables`), orderBy('name', 'asc')), [restaurantId, firestore]);

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

    const handleUpdateNotes = (idx: number, notes: string) => {
        setOrderItems(prev => prev.map((item, i) => i === idx ? { ...item, notes } : item));
    };

    const total = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const handleCreateOrder = () => {
        if (orderItems.length === 0 || isSubmitting) return;
        setIsSubmitting(true);
        const selectedTable = tables?.find(t => t.id === tableId);
        
        const orderData = {
            restaurantId,
            origin,
            destination,
            tableId: tableId || null,
            tableName: selectedTable?.name || null,
            status: 'aberto',
            total,
            createdAt: serverTimestamp(),
            items: orderItems.map(item => ({
                menuItemId: item.menuItemId,
                name: item.name,
                quantity: item.quantity,
                priceAtOrder: item.price,
                notes: item.notes || null
            }))
        };
        
        const colRef = collection(firestore, `restaurants/${restaurantId}/orders`);
        addDoc(colRef, orderData).then(() => {
            if (tableId) {
                const tableRef = doc(firestore, `restaurants/${restaurantId}/tables`, tableId);
                updateDoc(tableRef, { status: 'ocupada' });
            }
            toast({ title: "Pedido enviado para produção!" });
            onSuccess();
        }).catch(async (error) => {
            setIsSubmitting(false);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: orderData
            }));
        });
    };

    if (isCatsLoading || isItemsLoading || isTablesLoading) return <Skeleton className="h-[70vh] w-full" />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:h-[75vh]">
            <div className="flex flex-col">
                <Tabs defaultValue={categories?.[0]?.id} className="flex-1 flex flex-col">
                    <ScrollArea className="w-full whitespace-nowrap"><TabsList className="flex w-max">{categories?.map(c => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList><ScrollBar orientation="horizontal" /></ScrollArea>
                    <ScrollArea className="flex-1 mt-4">
                        {categories?.map(c => (
                            <TabsContent key={c.id} value={c.id} className="grid grid-cols-2 gap-3">
                                {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                    <Card key={item.id} className="flex flex-col p-3 gap-2 cursor-pointer hover:border-primary transition-colors" onClick={() => handleAddItem(item)}>
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="text-sm font-semibold leading-tight">{item.name}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                                        <div className="flex justify-between items-center mt-auto">
                                            <span className="text-sm font-bold text-primary">R$ {item.price.toFixed(2)}</span>
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Plus className="h-3 w-3 text-primary" />
                                            </div>
                                        </div>
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
                    <CardContent className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Origem</Label>
                                <Select value={origin} onValueChange={v => setOrigin(v as any)}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mesa">Mesa</SelectItem>
                                        <SelectItem value="balcao">Balcão</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">Mesa / Identificação</Label>
                                <Select value={tableId} onValueChange={setTableId} disabled={origin !== 'mesa'}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tables?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.status})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator />
                        <ScrollArea className="flex-1 -mx-4 px-4">
                            <div className="space-y-4">
                                {orderItems.map((item, idx) => (
                                    <div key={idx} className="space-y-2 pb-2 border-b last:border-0">
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm">
                                                <p className="font-semibold">{item.name}</p>
                                                <p className="text-primary text-xs font-bold">R$ {item.price.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(idx, -1); }}><Minus className="h-3 w-3" /></Button>
                                                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(idx, 1); }}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                            <Input 
                                                placeholder="Observação (ex: sem cebola)" 
                                                className="h-7 text-xs" 
                                                value={item.notes}
                                                onChange={(e) => handleUpdateNotes(idx, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {orderItems.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                                        <Plus className="h-8 w-8 mb-2" />
                                        <p className="text-sm">Toque nos itens para adicionar</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                        <div className="pt-4 border-t flex justify-between items-center font-bold">
                            <span className="text-muted-foreground">Valor Total</span>
                            <span className="text-xl text-primary">R$ {total.toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
                <Button className="w-full" size="lg" disabled={orderItems.length === 0 || isSubmitting} onClick={handleCreateOrder}>
                    {isSubmitting ? "Enviando para Cozinha..." : "Finalizar e Enviar"}
                </Button>
            </div>
        </div>
    );
}

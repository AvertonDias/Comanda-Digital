
'use client';
import { useState } from 'react';
import type { MenuItem, OrderItem, Table, Order, MenuItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuItemSelectionDialog } from './menu-item-selection-dialog';

type SelectionAddon = { name: string; price: number; groupId: string };

type NewOrderItem = {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    printSectorId: string;
    notes?: string;
    addons?: SelectionAddon[];
};

export function CreateOrderForm({ restaurantId, onSuccess }: { restaurantId: string, onSuccess: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tableId, setTableId] = useState<string | undefined>(undefined);
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // UI State for Selection
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

    const categoriesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
    }, [restaurantId, firestore]);

    const itemsQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/menuItems`));
    }, [restaurantId, firestore]);

    const tablesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/tables`), orderBy('name', 'asc'));
    }, [restaurantId, firestore]);

    const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);
    const { data: tables, isLoading: isTablesLoading } = useCollection<Table>(tablesQuery);

    const handleItemClick = (item: MenuItem) => {
        setSelectedItem(item);
    };

    const handleAddConfirmed = (data: {
        item: MenuItem;
        quantity: number;
        addons: SelectionAddon[];
        notes: string;
        totalPrice: number;
    }) => {
        setOrderItems(prev => [...prev, {
            menuItemId: data.item.id,
            name: data.item.name,
            quantity: data.quantity,
            price: data.item.price, // Basic price
            printSectorId: data.item.printSectorId,
            notes: data.notes,
            addons: data.addons
        }]);
        setSelectedItem(null);
    };

    const handleRemoveItem = (index: number) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreateOrder = async () => {
        if (orderItems.length === 0 || isSubmitting || !restaurantId) return;
        setIsSubmitting(true);
        const selectedTable = tables?.find(t => t.id === tableId);
        
        const orderData = {
            restaurantId,
            origin: 'mesa',
            destination: 'local',
            tableId: tableId || null,
            tableName: selectedTable?.name || null,
            status: 'aberto',
            total: orderItems.reduce((acc, item) => {
                const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
                return acc + (item.price + addonsPrice) * item.quantity;
            }, 0),
            createdAt: serverTimestamp(),
            items: orderItems.map(item => ({
                menuItemId: item.menuItemId,
                name: item.name,
                quantity: item.quantity,
                priceAtOrder: item.price,
                notes: item.notes || null,
                status: 'pendente',
                printSectorId: item.printSectorId,
                addons: item.addons?.map(a => ({ name: a.name, price: a.price })) || []
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
                    <ScrollArea className="w-full whitespace-nowrap bg-muted/30 rounded-md p-1">
                        <TabsList className="bg-transparent">
                            {categories?.map(c => <TabsTrigger key={c.id} value={c.id} className="data-[state=active]:bg-background">{c.name}</TabsTrigger>)}
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                    <ScrollArea className="flex-1 mt-4">
                        {categories?.map(c => (
                            <TabsContent key={c.id} value={c.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                                {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                    <Card 
                                        key={item.id} 
                                        className="p-3 cursor-pointer hover:border-primary flex items-center gap-3 transition-all" 
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0">
                                            <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold uppercase truncate">{item.name}</p>
                                            <p className="text-xs text-primary font-bold">R$ {item.price.toFixed(2)}</p>
                                        </div>
                                        <Plus className="h-4 w-4 text-muted-foreground" />
                                    </Card>
                                ))}
                            </TabsContent>
                        ))}
                    </ScrollArea>
                </Tabs>
            </div>

            <div className="flex flex-col gap-4">
                <Card className="flex-1 flex flex-col overflow-hidden border-2 border-muted/50">
                    <CardHeader className="py-4 border-b bg-muted/10">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase">Carrinho</CardTitle>
                            <Badge variant="secondary" className="bg-black text-white">{orderItems.length} Itens</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-2">
                            <Select value={tableId} onValueChange={setTableId}>
                                <SelectTrigger className="border-2"><SelectValue placeholder="Selecione a Mesa" /></SelectTrigger>
                                <SelectContent>
                                    {tables?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({t.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <ScrollArea className="flex-1 pr-2">
                            <div className="space-y-4">
                                {orderItems.map((item, idx) => {
                                    const addonsPrice = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                                    const itemTotal = (item.price + addonsPrice) * item.quantity;

                                    return (
                                        <div key={idx} className="space-y-1 bg-muted/20 p-3 rounded-lg relative group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold uppercase">{item.quantity}x {item.name}</p>
                                                    {item.addons?.map((a, ai) => (
                                                        <p key={ai} className="text-[10px] text-muted-foreground uppercase">+ {a.name} (R$ {a.price.toFixed(2)})</p>
                                                    ))}
                                                    {item.notes && <p className="text-[10px] italic text-primary mt-1">Nota: {item.notes}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold">R$ {itemTotal.toFixed(2)}</p>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleRemoveItem(idx)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {orderItems.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                                        <p className="text-xs font-bold uppercase">Sua comanda está vazia</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <div className="p-4 bg-muted/10 border-t">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Total do Pedido</span>
                            <span className="text-xl font-black">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    orderItems.reduce((acc, item) => {
                                        const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
                                        return acc + (item.price + addonsPrice) * item.quantity;
                                    }, 0)
                                )}
                            </span>
                        </div>
                    </div>
                </Card>
                <Button 
                    className="w-full h-12 bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-black uppercase text-lg" 
                    disabled={orderItems.length === 0 || isSubmitting || !tableId} 
                    onClick={handleCreateOrder}
                >
                    {isSubmitting ? "Enviando..." : "Confirmar Pedido"}
                </Button>
            </div>

            <MenuItemSelectionDialog 
                item={selectedItem} 
                isOpen={!!selectedItem} 
                onClose={() => setSelectedItem(null)}
                onConfirm={handleAddConfirmed}
            />
        </div>
    );
}

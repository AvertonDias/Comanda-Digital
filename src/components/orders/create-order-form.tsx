'use client';
import { useState, useEffect } from 'react';
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

export function CreateOrderForm({ 
    restaurantId, 
    onSuccess, 
    initialTableId 
}: { 
    restaurantId: string, 
    onSuccess: () => void,
    initialTableId?: string
}) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [tableId, setTableId] = useState<string | undefined>(initialTableId);
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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

    useEffect(() => {
        if (initialTableId) {
            setTableId(initialTableId);
        }
    }, [initialTableId]);

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
            price: data.item.price, 
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

    if (isCatsLoading || isItemsLoading || isTablesLoading) return <Skeleton className="h-[70vh] w-full" />;

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 p-4 sm:p-0">
            {/* Seção do Cardápio */}
            <div className="flex flex-col space-y-4">
                <Tabs defaultValue={categories?.[0]?.id} className="w-full">
                    <ScrollArea className="w-full whitespace-nowrap bg-muted/30 rounded-md p-1">
                        <TabsList className="bg-transparent h-auto">
                            {categories?.map(c => (
                                <TabsTrigger 
                                    key={c.id} 
                                    value={c.id} 
                                    className="data-[state=active]:bg-background px-4 py-2 text-xs font-bold uppercase"
                                >
                                    {c.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                    
                    {categories?.map(c => (
                        <TabsContent key={c.id} value={c.id} className="mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                    <Card 
                                        key={item.id} 
                                        className="p-3 cursor-pointer hover:border-primary flex items-center gap-3 transition-all active:scale-95" 
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                                            <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase truncate leading-tight">{item.name}</p>
                                            <p className="text-[10px] text-primary font-black">R$ {item.price.toFixed(2)}</p>
                                        </div>
                                        <Plus className="h-4 w-4 text-primary" />
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

            {/* Seção do Carrinho */}
            <div className="flex flex-col gap-4">
                <Card className="flex-1 flex flex-col border-2">
                    <CardHeader className="py-3 border-b bg-muted/10">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-black uppercase">Sua Comanda</CardTitle>
                            <Badge className="bg-primary">{orderItems.length} Itens</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground">Onde está o cliente?</label>
                            <Select value={tableId} onValueChange={setTableId}>
                                <SelectTrigger className="h-10 border-2">
                                    <SelectValue placeholder="Selecione a Mesa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tables?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({t.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            {orderItems.map((item, idx) => {
                                const addonsPrice = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                                const itemTotal = (item.price + addonsPrice) * item.quantity;

                                return (
                                    <div key={idx} className="bg-muted/30 p-3 rounded-lg flex justify-between items-start group">
                                        <div className="flex-1">
                                            <p className="text-xs font-black uppercase">{item.quantity}x {item.name}</p>
                                            {item.addons?.map((a, ai) => (
                                                <p key={ai} className="text-[9px] text-muted-foreground uppercase font-bold">+ {a.name}</p>
                                            ))}
                                            {item.notes && <p className="text-[9px] italic text-primary mt-1 font-bold">Nota: {item.notes}</p>}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-xs font-black">R$ {itemTotal.toFixed(2)}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-destructive"
                                                onClick={() => handleRemoveItem(idx)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {orderItems.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-30">
                                    <ShoppingBag className="h-12 w-12 mb-2" />
                                    <p className="text-[10px] font-black uppercase">Nenhum item selecionado</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    
                    <div className="mt-auto p-4 bg-muted/10 border-t space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Total</span>
                            <span className="text-xl font-black">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                    orderItems.reduce((acc, item) => {
                                        const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
                                        return acc + (item.price + addonsPrice) * item.quantity;
                                    }, 0)
                                )}
                            </span>
                        </div>
                        <Button 
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black uppercase text-sm shadow-lg active:scale-95 transition-all" 
                            disabled={orderItems.length === 0 || isSubmitting || !tableId} 
                            onClick={handleCreateOrder}
                        >
                            {isSubmitting ? "Enviando..." : "Confirmar Pedido"}
                        </Button>
                    </div>
                </Card>
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

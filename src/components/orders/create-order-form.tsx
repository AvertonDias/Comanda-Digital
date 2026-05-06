
'use client';
import { useState, useEffect } from 'react';
import type { MenuItem, Table, MenuItemCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, ShoppingBag, Trash2, User, Phone, MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
    const [orderType, setOrderType] = useState<string>(initialTableId ? 'mesa' : 'balcao');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
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
            setOrderType('mesa');
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
        
        // Validação básica de campos obrigatórios
        if ((orderType === 'retirada' || orderType === 'entrega') && (!customerName || !customerPhone)) {
            toast({ variant: "destructive", title: "Dados do cliente obrigatórios" });
            return;
        }
        if (orderType === 'entrega' && !deliveryAddress) {
            toast({ variant: "destructive", title: "Endereço de entrega obrigatório" });
            return;
        }

        setIsSubmitting(true);
        
        let origin: any = 'mesa';
        let destination: any = 'local';
        let tableName = '';

        const selectedTable = tables?.find(t => t.id === tableId);

        if (orderType === 'balcao') {
            origin = 'balcao';
            destination = 'local';
            tableName = 'Balcão';
        } else if (orderType === 'retirada') {
            origin = 'balcao';
            destination = 'retirada';
            tableName = 'Retirada';
        } else if (orderType === 'entrega') {
            origin = 'telefone';
            destination = 'entrega';
            tableName = 'Entrega';
        } else {
            origin = 'mesa';
            destination = 'local';
            tableName = selectedTable?.name || 'Mesa';
        }

        try {
            const orderData = {
                restaurantId,
                origin,
                destination,
                tableId: orderType === 'mesa' ? (tableId || null) : null,
                tableName,
                customerName: (orderType === 'retirada' || orderType === 'entrega') ? customerName : null,
                customerPhone: (orderType === 'retirada' || orderType === 'entrega') ? customerPhone : null,
                deliveryAddress: orderType === 'entrega' ? deliveryAddress : null,
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
            
            if (orderType === 'mesa' && tableId) {
                await updateDoc(doc(firestore, `restaurants/${restaurantId}/tables`, tableId), { status: 'ocupada' });
            }
            
            toast({ title: "Pedido enviado!" });
            onSuccess();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao criar pedido" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isCatsLoading || isItemsLoading || isTablesLoading) return <Skeleton className="h-[80vh] w-full" />;

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Passo 1: Identificação (Topo Fixo) */}
            <div className="p-4 bg-muted/20 border-b-2 space-y-4">
                <label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <span className="h-4 w-1 bg-primary rounded-full" />
                    1. Identificação do Pedido
                </label>
                
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select value={orderType} onValueChange={setOrderType}>
                            <SelectTrigger className="h-12 border-2 bg-background font-bold text-xs uppercase">
                                <SelectValue placeholder="Tipo de Atendimento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mesa">Mesa</SelectItem>
                                <SelectItem value="balcao">Balcão</SelectItem>
                                <SelectItem value="retirada">Retirada (Takeaway)</SelectItem>
                                <SelectItem value="entrega">Entrega (Delivery)</SelectItem>
                            </SelectContent>
                        </Select>

                        {orderType === 'mesa' && (
                            <Select value={tableId} onValueChange={setTableId}>
                                <SelectTrigger className="h-12 border-2 bg-background font-bold text-xs uppercase">
                                    <SelectValue placeholder="Qual a Mesa?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tables?.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.name} ({t.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {(orderType === 'retirada' || orderType === 'entrega') && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Nome do Cliente" 
                                        className="h-12 pl-10 border-2 font-bold text-xs uppercase"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Telefone / WhatsApp" 
                                        className="h-12 pl-10 border-2 font-bold text-xs uppercase"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                    />
                                </div>
                            </div>
                            {orderType === 'entrega' && (
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Endereço de Entrega Completo" 
                                        className="h-12 pl-10 border-2 font-bold text-xs uppercase"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:grid lg:grid-cols-2 gap-0">
                {/* Passo 2: Seleção de Itens */}
                <div className="flex-1 overflow-y-auto p-4 border-r-2 space-y-4">
                    <label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <span className="h-4 w-1 bg-primary rounded-full" />
                        2. Selecione os Itens
                    </label>
                    <Tabs defaultValue={categories?.[0]?.id} className="w-full">
                        <ScrollArea className="w-full whitespace-nowrap bg-muted/30 rounded-md p-1 mb-4">
                            <TabsList className="bg-transparent h-auto">
                                {categories?.map(c => (
                                    <TabsTrigger 
                                        key={c.id} 
                                        value={c.id} 
                                        className="data-[state=active]:bg-background px-4 py-2 text-[10px] font-black uppercase"
                                    >
                                        {c.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <ScrollBar orientation="horizontal" className="hidden" />
                        </ScrollArea>
                        
                        {categories?.map(c => (
                            <TabsContent key={c.id} value={c.id} className="mt-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                        <Card 
                                            key={item.id} 
                                            className="p-2.5 cursor-pointer hover:border-primary border-2 flex items-center gap-3 transition-all active:scale-95" 
                                            onClick={() => handleItemClick(item)}
                                        >
                                            <div className="relative h-10 w-10 rounded-md overflow-hidden shrink-0 bg-muted">
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

                {/* Passo 3: Carrinho / Conferência */}
                <div className="bg-muted/10 flex flex-col h-[40vh] lg:h-full">
                    <div className="p-4 border-b flex justify-between items-center bg-background">
                        <label className="text-[10px] font-black uppercase text-primary tracking-widest">Resumo do Pedido</label>
                        <Badge className="bg-primary">{orderItems.length} Itens</Badge>
                    </div>
                    
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-2">
                            {orderItems.map((item, idx) => {
                                const addonsPrice = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                                const itemTotal = (item.price + addonsPrice) * item.quantity;

                                return (
                                    <div key={idx} className="bg-background p-3 rounded-lg border-2 flex justify-between items-start">
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
                                    <ShoppingBag className="h-10 w-10 mb-2" />
                                    <p className="text-[10px] font-black uppercase">O carrinho está vazio</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 bg-background border-t space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Total do Pedido</span>
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
                            className="w-full h-12 bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-black uppercase text-xs shadow-lg active:scale-95 transition-all" 
                            disabled={orderItems.length === 0 || isSubmitting || (orderType === 'mesa' && !tableId)} 
                            onClick={handleCreateOrder}
                        >
                            {isSubmitting ? "Processando..." : "Confirmar Pedido"}
                        </Button>
                    </div>
                </div>
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

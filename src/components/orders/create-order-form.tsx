
'use client';
import { useState, useEffect, useMemo } from 'react';
import type { MenuItem, Table, MenuItemCategory, Restaurant, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, ShoppingBag, Trash2, User, Phone, MapPin, ChevronRight, ChevronLeft, CheckCircle2, Clock, Bike, Utensils, Store, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuItemSelectionDialog } from './menu-item-selection-dialog';
import { cn } from '@/lib/utils';

type SelectionAddon = { name: string; price: number; groupId: string };

type NewOrderItem = {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    printSectorId: string;
    notes?: string;
    addons?: SelectionAddon[];
    ingredientsExtraPrice?: number;
    preparationTime: number;
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
    const [step, setStep] = useState(1);
    const [tableId, setTableId] = useState<string | undefined>(initialTableId);
    const [orderType, setOrderType] = useState<string>(initialTableId ? 'mesa' : 'balcao');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    
    const restaurantRef = useMemoFirebase(() => restaurantId ? doc(firestore, 'restaurants', restaurantId) : null, [firestore, restaurantId]);
    const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

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

    const preparingOrdersQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${restaurantId}/orders`),
            where('status', '==', 'preparando')
        );
    }, [restaurantId, firestore]);

    const { data: rawCategories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: rawItems, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);
    const { data: rawTables, isLoading: isTablesLoading } = useCollection<Table>(tablesQuery);
    const { data: activeOrders } = useCollection<Order>(preparingOrdersQuery);

    const { categories, categoryIdMap } = useMemo(() => {
        if (!rawCategories) return { categories: [], categoryIdMap: new Map<string, string[]>() };
        const nameMap = new Map<string, MenuItemCategory>();
        const idAliases = new Map<string, string[]>();

        rawCategories.forEach(cat => {
            const normalized = (cat.name || '').trim().toLowerCase();
            if (!nameMap.has(normalized)) {
                nameMap.set(normalized, cat);
                idAliases.set(cat.id, [cat.id]);
            } else {
                const canonical = nameMap.get(normalized)!;
                const currentList = idAliases.get(canonical.id) || [canonical.id];
                currentList.push(cat.id);
                idAliases.set(canonical.id, currentList);
            }
        });

        return {
            categories: Array.from(nameMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0)),
            categoryIdMap: idAliases
        };
    }, [rawCategories]);

    const tables = useMemo(() => {
        if (!rawTables) return [];
        const seen = new Map<string, Table>();
        rawTables.forEach(t => {
            const key = (t.name || '').trim().toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, t);
            } else {
                const existing = seen.get(key)!;
                if (existing.status === 'livre' && (t.status === 'ocupada' || t.status === 'fechando')) {
                    seen.set(key, t);
                }
            }
        });
        return Array.from(seen.values()).sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [rawTables]);

    const items = useMemo(() => {
        if (!rawItems) return [];
        const seen = new Map<string, MenuItem>();
        rawItems.forEach(i => {
            const key = `${(i.name || '').trim().toLowerCase()}-${i.price}`;
            if (!seen.has(key)) seen.set(key, i);
        });
        return Array.from(seen.values());
    }, [rawItems]);

    const estimatedWaitTime = useMemo(() => {
        const backlogTime = activeOrders?.reduce((total, order) => {
            const orderWait = order.items.reduce((sum, item) => sum + ((item.preparationTimeAtOrder || 0) * item.quantity), 0);
            return total + orderWait;
        }, 0) || 0;
        const currentOrderTime = orderItems.reduce((sum, item) => sum + (item.preparationTime * item.quantity), 0);
        return backlogTime + currentOrderTime;
    }, [activeOrders, orderItems]);

    useEffect(() => {
        if (initialTableId) {
            setTableId(initialTableId);
            setOrderType('mesa');
        }
    }, [initialTableId]);

    const handleItemClick = (item: MenuItem) => {
        const hasIngredients = item.ingredients && item.ingredients.length > 0;
        const hasAddons = item.addonGroups && item.addonGroups.length > 0;

        if (!hasIngredients && !hasAddons) {
            // Adiciona direto se não tiver customização
            setOrderItems(prev => [...prev, {
                menuItemId: item.id,
                name: item.name,
                quantity: 1,
                price: item.price,
                printSectorId: item.printSectorId,
                notes: "",
                addons: [],
                ingredientsExtraPrice: 0,
                preparationTime: item.preparationTime || 0
            }]);
            toast({ title: `${item.name} adicionado!` });
        } else {
            setSelectedItem(item);
        }
    };

    const handleAddConfirmed = (data: {
        item: MenuItem;
        quantity: number;
        addons: SelectionAddon[];
        notes: string;
        totalPrice: number;
        ingredientsExtraPrice: number;
    }) => {
        setOrderItems(prev => [...prev, {
            menuItemId: data.item.id,
            name: data.item.name,
            quantity: data.quantity,
            price: data.item.price, 
            printSectorId: data.item.printSectorId,
            notes: data.notes,
            addons: data.addons,
            ingredientsExtraPrice: data.ingredientsExtraPrice,
            preparationTime: data.item.preparationTime || 0
        }]);
        setSelectedItem(null);
    };

    const handleRemoveItem = (index: number) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreateOrder = async () => {
        if (orderItems.length === 0 || isSubmitting || !restaurantId) return;
        
        setIsSubmitting(true);
        
        let origin: any = 'mesa';
        let destination: any = 'local';
        let tableName = '';

        const selectedTable = tables?.find(t => t.id === tableId);

        if (orderType === 'balcao') {
            origin = 'balcao';
            destination = 'local';
            tableName = customerName ? `Balcão - ${customerName}` : 'Balcão';
        } else if (orderType === 'retirada') {
            origin = 'balcao';
            destination = 'retirada';
            tableName = customerName ? `Retirada - ${customerName}` : 'Retirada';
        } else if (orderType === 'entrega') {
            origin = 'telefone';
            destination = 'entrega';
            tableName = customerName ? `Entrega - ${customerName}` : 'Entrega';
        } else {
            origin = 'mesa';
            destination = 'local';
            tableName = selectedTable?.name || 'Mesa';
        }

        try {
            const ordersCol = collection(firestore, `restaurants/${restaurantId}/orders`);
            const snapshot = await getCountFromServer(ordersCol);
            const nextOrderNumber = (snapshot.data().count || 0) + 1;

            const itemsTotal = orderItems.reduce((acc, item) => {
                const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
                const ingredientsPrice = item.ingredientsExtraPrice || 0;
                return acc + (item.price + addonsPrice + ingredientsPrice) * item.quantity;
            }, 0);

            const deliveryFee = orderType === 'entrega' ? (restaurant?.deliveryFee || 0) : 0;
            const finalTotal = itemsTotal + deliveryFee;

            const orderData = {
                restaurantId,
                orderNumber: nextOrderNumber,
                origin,
                destination,
                tableId: orderType === 'mesa' ? (tableId || null) : null,
                tableName,
                customerName: (orderType === 'balcao' || orderType === 'retirada' || orderType === 'entrega') ? customerName : null,
                customerPhone: (orderType === 'balcao' || orderType === 'retirada' || orderType === 'entrega') ? customerPhone : null,
                deliveryAddress: orderType === 'entrega' ? deliveryAddress : null,
                status: 'aberto',
                total: finalTotal,
                deliveryFee: deliveryFee,
                createdAt: serverTimestamp(),
                items: orderItems.map(item => ({
                    menuItemId: item.menuItemId,
                    name: item.name,
                    quantity: item.quantity,
                    priceAtOrder: item.price,
                    notes: item.notes || null,
                    status: 'pendente',
                    printSectorId: item.printSectorId,
                    addons: item.addons?.map(a => ({ name: a.name, price: a.price })) || [],
                    ingredientExtrasPrice: item.ingredientsExtraPrice || 0,
                    preparationTimeAtOrder: item.preparationTime
                }))
            };
            
            await addDoc(ordersCol, orderData);
            
            if (orderType === 'mesa' && tableId) {
                await updateDoc(doc(firestore, `restaurants/${restaurantId}/tables`, tableId), { status: 'ocupada' });
            }
            
            toast({ title: `Pedido #${nextOrderNumber.toString().padStart(3, '0')} enviado!` });
            
            // Sucesso! Fecha o formulário imediatamente sem modal de confirmação.
            onSuccess();

        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao criar pedido" });
            setIsSubmitting(false);
        }
    };

    const nextStep = () => {
        if (step === 1) {
            if (orderType === 'mesa' && !tableId) {
                toast({ variant: "destructive", title: "Selecione a mesa" });
                return;
            }
            if (orderType === 'balcao' && !customerName) {
                toast({ variant: "destructive", title: "Informe o nome do cliente" });
                return;
            }
            if ((orderType === 'retirada' || orderType === 'entrega') && (!customerName || !customerPhone)) {
                toast({ variant: "destructive", title: "Preencha os dados do cliente" });
                return;
            }
            if (orderType === 'entrega' && !deliveryAddress) {
                toast({ variant: "destructive", title: "Preencha o endereço de entrega" });
                return;
            }
        }
        if (step === 2 && orderItems.length === 0) {
            toast({ variant: "destructive", title: "Adicione pelo menos um item" });
            return;
        }
        setStep(prev => prev + 1);
    };

    const prevStep = () => setStep(prev => prev - 1);

    if (isCatsLoading || isItemsLoading || isTablesLoading) return <Skeleton className="h-[80vh] w-full" />;

    const itemsSubtotal = orderItems.reduce((acc, item) => {
        const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
        const ingredientsPrice = item.ingredientsExtraPrice || 0;
        return acc + (item.price + addonsPrice + ingredientsPrice) * item.quantity;
    }, 0);

    const activeDeliveryFee = orderType === 'entrega' ? (restaurant?.deliveryFee || 0) : 0;
    const totalAmount = itemsSubtotal + activeDeliveryFee;

    const selectedTable = tables?.find(t => t.id === tableId);

    return (
        <>
            <div className="flex flex-col h-full bg-background overflow-hidden">
                <div className="px-6 py-4 bg-muted/30 border-b flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center flex-1 last:flex-none">
                                <div className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-black transition-all",
                                    step === s ? "bg-primary text-white scale-110 shadow-lg" : 
                                    step > s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                )}>
                                    {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                                </div>
                                <div className={cn(
                                    "hidden sm:block ml-2 text-[10px] font-black uppercase tracking-widest",
                                    step === s ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {s === 1 ? "Identificação" : s === 2 ? "Cardápio" : "Resumo"}
                                </div>
                                {s < 3 && <div className={cn("flex-1 h-0.5 mx-4", step > s ? "bg-green-500" : "bg-muted")} />}
                            </div>
                        ))}
                    </div>
                    
                    {estimatedWaitTime > 0 && (
                        <div className="flex items-center justify-center gap-2 bg-orange-100 text-orange-800 py-1.5 px-4 rounded-full self-center border border-orange-200 animate-in fade-in duration-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                                Tempo estimado para entrega: ~{estimatedWaitTime} min
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {step === 1 && (
                        <div className="p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* 1. Escolha do Tipo de Atendimento em Cards Grandes */}
                            <div className="space-y-3">
                                <label className="text-sm font-black text-foreground flex items-center gap-2">
                                    <span className="h-4 w-1.5 bg-primary rounded-full" />
                                    1. Onde será este pedido?
                                </label>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setOrderType('mesa')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center gap-2 active:scale-95",
                                            orderType === 'mesa'
                                                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-xl", orderType === 'mesa' ? "bg-primary text-white" : "bg-muted")}>
                                            <Utensils className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">Na Mesa</p>
                                            <p className="text-[10px] opacity-80">Salão do restaurante</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOrderType('balcao')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center gap-2 active:scale-95",
                                            orderType === 'balcao'
                                                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-xl", orderType === 'balcao' ? "bg-primary text-white" : "bg-muted")}>
                                            <Store className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">No Balcão</p>
                                            <p className="text-[10px] opacity-80">Consumo imediato</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOrderType('retirada')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center gap-2 active:scale-95",
                                            orderType === 'retirada'
                                                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-xl", orderType === 'retirada' ? "bg-primary text-white" : "bg-muted")}>
                                            <Package className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">Retirada</p>
                                            <p className="text-[10px] opacity-80">Cliente vem buscar</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOrderType('entrega')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center gap-2 active:scale-95",
                                            orderType === 'entrega'
                                                ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/30"
                                                : "border-border bg-card hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("p-2.5 rounded-xl", orderType === 'entrega' ? "bg-primary text-white" : "bg-muted")}>
                                            <Bike className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm">Entrega</p>
                                            <p className="text-[10px] opacity-80">Motoboy / Delivery</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Seleção de Mesa Direta em Botões Grandes */}
                            {orderType === 'mesa' && (
                                <div className="space-y-3 pt-2">
                                    <label className="text-sm font-black text-foreground flex items-center gap-2">
                                        <span className="h-4 w-1.5 bg-primary rounded-full" />
                                        2. Toque na Mesa desejada:
                                    </label>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
                                        {tables?.map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setTableId(t.id)}
                                                className={cn(
                                                    "p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all active:scale-95 min-h-[72px]",
                                                    tableId === t.id
                                                        ? "border-primary bg-primary/10 text-primary shadow-md ring-2 ring-primary/40"
                                                        : t.status === 'livre'
                                                        ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-foreground"
                                                        : "border-border bg-muted/40 hover:bg-muted text-muted-foreground"
                                                )}
                                            >
                                                <span className="font-black text-base leading-tight">{t.name}</span>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        t.status === 'livre' ? "bg-emerald-500" : "bg-red-500"
                                                    )} />
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase",
                                                        t.status === 'livre' ? "text-emerald-700" : "text-red-700"
                                                    )}>
                                                        {t.status === 'livre' ? 'Livre' : 'Ocupada'}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                        {tables?.length === 0 && (
                                            <p className="col-span-full text-center text-sm text-muted-foreground py-6">
                                                Nenhuma mesa cadastrada. Cadastre mesas na aba "Mesas".
                                            </p>
                                        )}
                                    </div>
                                    {selectedTable && (
                                        <p className="text-xs font-bold text-primary flex items-center gap-1.5 bg-primary/10 px-3 py-2 rounded-xl">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Mesa selecionada: <strong className="text-sm">{selectedTable.name}</strong>
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* 3. Dados do Cliente com campos grandes e claros */}
                            {(orderType === 'balcao' || orderType === 'retirada' || orderType === 'entrega') && (
                                <div className="space-y-3 pt-2">
                                    <label className="text-sm font-black text-foreground flex items-center gap-2">
                                        <span className="h-4 w-1.5 bg-primary rounded-full" />
                                        2. Quem é o cliente?
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                placeholder="Nome do Cliente (ex: João)" 
                                                className="h-14 pl-11 text-base font-bold rounded-xl border-2"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                            />
                                        </div>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                placeholder="WhatsApp / Telefone" 
                                                className="h-14 pl-11 text-base font-bold rounded-xl border-2"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {orderType === 'entrega' && (
                                        <div className="relative pt-1">
                                            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input 
                                                placeholder="Rua, número, bairro e ponto de referência" 
                                                className="h-14 pl-11 text-base font-bold rounded-xl border-2"
                                                value={deliveryAddress}
                                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}


                    {step === 2 && (
                        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Tabs defaultValue={categories?.[0]?.id} className="w-full">
                                <ScrollArea className="w-full whitespace-nowrap bg-muted/40 rounded-xl p-1 mb-4 border">
                                    <TabsList className="bg-transparent h-auto gap-1">
                                        {categories?.map(c => (
                                            <TabsTrigger 
                                                key={c.id} 
                                                value={c.id} 
                                                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm px-4 py-2.5 text-xs sm:text-sm font-black rounded-lg transition-all"
                                            >
                                                {c.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <ScrollBar orientation="horizontal" className="hidden" />
                                </ScrollArea>
                                
                                {categories?.map(c => {
                                    const aliasIds = categoryIdMap.get(c.id) || [c.id];
                                    return (
                                    <TabsContent key={c.id} value={c.id} className="mt-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {items?.filter(i => aliasIds.includes(i.categoryId) && i.isAvailable).map(item => {
                                                const currentQty = orderItems
                                                    .filter(oi => oi.menuItemId === item.id)
                                                    .reduce((sum, oi) => sum + oi.quantity, 0);

                                                return (
                                                    <Card 
                                                        key={item.id} 
                                                        className={cn(
                                                            "p-3.5 cursor-pointer hover:border-primary border-2 flex items-center gap-3.5 transition-all active:scale-98 shadow-sm rounded-2xl",
                                                            currentQty > 0 && "border-primary bg-primary/5"
                                                        )} 
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-muted border">
                                                            <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                                                            {currentQty > 0 && (
                                                                <div className="absolute top-0 right-0 bg-primary text-white text-[11px] font-black w-6 h-6 rounded-bl-lg flex items-center justify-center">
                                                                    {currentQty}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-foreground truncate leading-tight">{item.name}</p>
                                                            <p className="text-sm text-emerald-700 font-black mt-1">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                                            </p>
                                                            {item.preparationTime && item.preparationTime > 0 && (
                                                                <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground mt-0.5">
                                                                    <Clock className="h-3 w-3" /> {item.preparationTime} min
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                                                            currentQty > 0 ? "bg-primary text-white" : "bg-primary/10 text-primary"
                                                        )}>
                                                            <Plus className="h-5 w-5" />
                                                        </div>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </TabsContent>
                                    );
                                })}
                            </Tabs>

                            {orderItems.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 p-4 rounded-2xl flex justify-between items-center shadow-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-600 text-white h-9 w-9 rounded-full flex items-center justify-center font-black text-sm">
                                            {orderItems.reduce((acc, curr) => acc + curr.quantity, 0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                                                {orderItems.length} {orderItems.length === 1 ? 'item diferente adicionado' : 'itens diferentes adicionados'}
                                            </span>
                                            {orderType === 'entrega' && activeDeliveryFee > 0 && (
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase">+ Taxa de Entrega</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="font-black text-base text-emerald-900 dark:text-emerald-100">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-card p-5 rounded-2xl border-2 space-y-4 shadow-sm">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <div>
                                        <h3 className="text-base font-black text-foreground">Conferência do Pedido</h3>
                                        <p className="text-xs text-muted-foreground">Verifique antes de enviar para a cozinha</p>
                                    </div>
                                    <Badge className="font-bold text-xs px-3 py-1 bg-primary text-white">
                                        {orderType === 'mesa' 
                                            ? (selectedTable?.name || 'Mesa') 
                                            : customerName ? `${orderType} - ${customerName}` : orderType}
                                    </Badge>
                                </div>
                                
                                <div className="space-y-3">
                                    {orderItems.map((item, idx) => {
                                        const addonsPrice = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                                        const ingredientsPrice = item.ingredientsExtraPrice || 0;
                                        const itemTotal = (item.price + addonsPrice + ingredientsPrice) * item.quantity;

                                        return (
                                            <div key={idx} className="bg-muted/30 p-3.5 rounded-xl border flex justify-between items-start">
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-black text-foreground">{item.quantity}x {item.name}</p>
                                                    {item.addons?.map((a, ai) => (
                                                        <p key={ai} className="text-xs text-muted-foreground font-semibold">+ {a.name} (+R$ {a.price.toFixed(2)})</p>
                                                    ))}
                                                    {item.notes && (
                                                        <p className="text-xs italic text-primary font-bold px-2 py-1 bg-primary/10 rounded-lg mt-1 inline-block">
                                                            Obs: {item.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-2 ml-3">
                                                    <span className="text-sm font-black text-foreground">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal)}
                                                    </span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 px-2 text-destructive hover:bg-destructive/10 text-xs font-bold"
                                                        onClick={() => handleRemoveItem(idx)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {orderType === 'entrega' && activeDeliveryFee > 0 && (
                                        <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Bike className="h-4 w-4 text-primary" />
                                                <span className="text-xs font-bold">Taxa de Entrega</span>
                                            </div>
                                            <span className="text-sm font-black">R$ {activeDeliveryFee.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-5 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 space-y-2">
                                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                                    <span>Subtotal dos itens</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemsSubtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-100 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                                    <span className="text-base font-black">Valor Total</span>
                                    <span className="text-2xl font-black">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 sm:p-6 bg-background border-t-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex gap-3">
                    {step > 1 && (
                        <Button 
                            variant="outline" 
                            size="lg"
                            className="flex-1 h-14 border-2 font-bold text-sm rounded-xl"
                            onClick={prevStep}
                            disabled={isSubmitting}
                        >
                            <ChevronLeft className="mr-1.5 h-5 w-5" />
                            Voltar
                        </Button>
                    )}
                    
                    {step < 3 ? (
                        <Button 
                            size="lg"
                            className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                            onClick={nextStep}
                        >
                            {step === 1 ? "Ir para o Cardápio" : `Revisar Pedido (${orderItems.length})`}
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    ) : (
                        <Button 
                            size="lg"
                            className="flex-[2] h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-base rounded-xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2" 
                            disabled={orderItems.length === 0 || isSubmitting} 
                            onClick={handleCreateOrder}
                        >
                            <CheckCircle2 className="h-5 w-5" />
                            {isSubmitting ? "Enviando para a cozinha..." : "Confirmar e Enviar Pedido"}
                        </Button>
                    )}
                </div>

            </div>

            <MenuItemSelectionDialog 
                item={selectedItem} 
                isOpen={!!selectedItem} 
                onClose={() => setSelectedItem(null)}
                onConfirm={handleAddConfirmed}
            />
        </>
    );
}

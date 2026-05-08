'use client';
import { useState, useEffect, useMemo } from 'react';
import type { MenuItem, Table, MenuItemCategory, Restaurant, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, ShoppingBag, Trash2, User, Phone, MapPin, ChevronRight, ChevronLeft, CheckCircle2, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, doc, updateDoc, orderBy, getCountFromServer, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuItemSelectionDialog } from './menu-item-selection-dialog';
import { KitchenOrderModal } from './kitchen-order-modal';
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
    
    // Estados para o fluxo de impressão da cozinha
    const [showKitchenPrint, setShowKitchenPrint] = useState(false);
    const [createdOrderData, setCreatedOrderData] = useState<any>(null);

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

    // Query para calcular tempo de espera (pedidos em preparo)
    const preparingOrdersQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${restaurantId}/orders`),
            where('status', '==', 'preparando')
        );
    }, [restaurantId, firestore]);

    const { data: categories, isLoading: isCatsLoading } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: items, isLoading: isItemsLoading } = useCollection<MenuItem>(itemsQuery);
    const { data: tables, isLoading: isTablesLoading } = useCollection<Table>(tablesQuery);
    const { data: activeOrders } = useCollection<Order>(preparingOrdersQuery);

    const estimatedWaitTime = useMemo(() => {
        if (!activeOrders) return 0;
        return activeOrders.reduce((total, order) => {
            const orderWait = order.items.reduce((sum, item) => sum + ((item.preparationTimeAtOrder || 0) * item.quantity), 0);
            return total + orderWait;
        }, 0);
    }, [activeOrders]);

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

            const finalTotal = orderItems.reduce((acc, item) => {
                const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
                const ingredientsPrice = item.ingredientsExtraPrice || 0;
                return acc + (item.price + addonsPrice + ingredientsPrice) * item.quantity;
            }, 0);

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
            
            const docRef = await addDoc(ordersCol, orderData);
            
            if (orderType === 'mesa' && tableId) {
                await updateDoc(doc(firestore, `restaurants/${restaurantId}/tables`, tableId), { status: 'ocupada' });
            }
            
            toast({ title: `Pedido #${nextOrderNumber.toString().padStart(3, '0')} enviado!` });
            
            setCreatedOrderData({ ...orderData, id: docRef.id });
            setShowKitchenPrint(true);

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

    const totalAmount = orderItems.reduce((acc, item) => {
        const addonsPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
        const ingredientsPrice = item.ingredientsExtraPrice || 0;
        return acc + (item.price + addonsPrice + ingredientsPrice) * item.quantity;
    }, 0);

    const selectedTable = tables?.find(t => t.id === tableId);

    return (
        <>
            <div className="flex flex-col h-full bg-background overflow-hidden">
                <div className="px-6 py-4 bg-muted/30 border-b flex flex-col gap-2">
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
                        <div className="flex items-center justify-center gap-2 bg-orange-100 text-orange-800 py-1 px-3 rounded-full self-center">
                            <Clock className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">
                                Fila de Espera: ~{estimatedWaitTime} MIN
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {step === 1 && (
                        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                    <span className="h-4 w-1 bg-primary rounded-full" />
                                    Tipo de Atendimento
                                </label>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Select value={orderType} onValueChange={setOrderType}>
                                        <SelectTrigger className="h-14 border-2 bg-background font-bold text-sm uppercase">
                                            <SelectValue placeholder="Como será o atendimento?" />
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
                                            <SelectTrigger className="h-14 border-2 bg-background font-bold text-sm uppercase">
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

                                {(orderType === 'balcao' || orderType === 'retirada' || orderType === 'entrega') && (
                                    <div className="space-y-4 pt-4">
                                        <label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                            <span className="h-4 w-1 bg-primary rounded-full" />
                                            Dados do Cliente
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input 
                                                    placeholder="NOME DO CLIENTE" 
                                                    className="h-14 pl-10 border-2 font-bold text-sm uppercase"
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                />
                                            </div>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input 
                                                    placeholder="WHATSAPP / TELEFONE" 
                                                    className="h-14 pl-10 border-2 font-bold text-sm uppercase"
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {orderType === 'entrega' && (
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input 
                                                    placeholder="ENDEREÇO COMPLETO PARA ENTREGA" 
                                                    className="h-14 pl-10 border-2 font-bold text-sm uppercase"
                                                    value={deliveryAddress}
                                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Tabs defaultValue={categories?.[0]?.id} className="w-full">
                                <ScrollArea className="w-full whitespace-nowrap bg-muted/30 rounded-md p-1 mb-6">
                                    <TabsList className="bg-transparent h-auto">
                                        {categories?.map(c => (
                                            <TabsTrigger 
                                                key={c.id} 
                                                value={c.id} 
                                                className="data-[state=active]:bg-background px-6 py-3 text-[10px] font-black uppercase tracking-widest"
                                            >
                                                {c.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <ScrollBar orientation="horizontal" className="hidden" />
                                </ScrollArea>
                                
                                {categories?.map(c => (
                                    <TabsContent key={c.id} value={c.id} className="mt-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {items?.filter(i => i.categoryId === c.id && i.isAvailable).map(item => (
                                                <Card 
                                                    key={item.id} 
                                                    className="p-3 cursor-pointer hover:border-primary border-2 flex items-center gap-4 transition-all active:scale-95 shadow-sm" 
                                                    onClick={() => handleItemClick(item)}
                                                >
                                                    <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                                                        <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black uppercase truncate leading-tight">{item.name}</p>
                                                        <p className="text-xs text-primary font-black mt-1">R$ {item.price.toFixed(2)}</p>
                                                        {item.preparationTime && (
                                                            <div className="flex items-center gap-1 text-[8px] font-black text-muted-foreground mt-1 uppercase">
                                                                <Clock className="h-2 w-2" /> {item.preparationTime} MIN
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <Plus className="h-4 w-4 text-primary" />
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>

                            {orderItems.length > 0 && (
                                <div className="bg-primary/5 border-2 border-dashed border-primary/30 p-4 rounded-xl flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center font-black text-xs">
                                            {orderItems.length}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-primary">Itens adicionados</span>
                                    </div>
                                    <span className="font-black text-sm">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-muted/10 p-5 rounded-2xl border-2 space-y-4">
                                <div className="flex justify-between items-center border-b pb-4">
                                    <label className="text-xs font-black uppercase text-primary tracking-widest">Resumo do Pedido</label>
                                    <Badge variant="outline" className="font-black text-[10px] border-primary text-primary">
                                        {orderType === 'mesa' 
                                            ? (selectedTable?.name.toUpperCase() || 'MESA') 
                                            : customerName ? `${orderType.toUpperCase()} - ${customerName.toUpperCase()}` : orderType.toUpperCase()}
                                    </Badge>
                                </div>
                                
                                <div className="space-y-3">
                                    {orderItems.map((item, idx) => {
                                        const addonsPrice = item.addons?.reduce((s, a) => s + a.price, 0) || 0;
                                        const ingredientsPrice = item.ingredientsExtraPrice || 0;
                                        const itemTotal = (item.price + addonsPrice + ingredientsPrice) * item.quantity;

                                        return (
                                            <div key={idx} className="bg-background p-4 rounded-xl border-2 flex justify-between items-start shadow-sm">
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-black uppercase">{item.quantity}x {item.name}</p>
                                                    {item.addons?.map((a, ai) => (
                                                        <p key={ai} className="text-[10px] text-muted-foreground uppercase font-bold">+ {a.name} (+R$ {a.price.toFixed(2)})</p>
                                                    ))}
                                                    {item.notes && <p className="text-[10px] italic text-primary mt-2 font-bold px-2 py-1 bg-primary/5 rounded border-l-2 border-primary">NOTA: {item.notes}</p>}
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-2 ml-4">
                                                    <span className="text-sm font-black">R$ {itemTotal.toFixed(2)}</span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveItem(idx)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-primary/5 p-5 rounded-2xl border-2 border-primary/20 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Valor Subtotal</span>
                                    <span className="text-sm font-bold">R$ {totalAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-primary">
                                    <span className="text-xs font-black uppercase">Total Final</span>
                                    <span className="text-2xl font-black">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-background border-t-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex gap-3">
                    {step > 1 && (
                        <Button 
                            variant="outline" 
                            size="lg"
                            className="flex-1 h-14 border-2 font-black uppercase text-xs"
                            onClick={prevStep}
                            disabled={isSubmitting}
                        >
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Voltar
                        </Button>
                    )}
                    
                    {step < 3 ? (
                        <Button 
                            size="lg"
                            className="flex-[2] h-14 bg-black hover:bg-zinc-800 text-white font-black uppercase text-xs shadow-lg active:scale-95 transition-all"
                            onClick={nextStep}
                        >
                            Próximo Passo
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button 
                            size="lg"
                            className="flex-[2] h-14 bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-black uppercase text-xs shadow-xl active:scale-95 transition-all" 
                            disabled={orderItems.length === 0 || isSubmitting} 
                            onClick={handleCreateOrder}
                        >
                            {isSubmitting ? "Enviando..." : "Finalizar e Enviar"}
                            <ShoppingBag className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Modais de suporte renderizados fora da árvore de conteúdo principal para evitar travamentos */}
            <MenuItemSelectionDialog 
                item={selectedItem} 
                isOpen={!!selectedItem} 
                onClose={() => setSelectedItem(null)}
                onConfirm={handleAddConfirmed}
            />

            <KitchenOrderModal 
                isOpen={showKitchenPrint}
                onClose={() => {
                    setShowKitchenPrint(false);
                    onSuccess();
                }}
                order={createdOrderData}
                restaurant={restaurant}
            />
        </>
    );
}
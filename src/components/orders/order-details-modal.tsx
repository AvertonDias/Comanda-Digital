'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Order, OrderStatus, Restaurant, SplitPaymentPart, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { ArrowRight, ChefHat, Bike, Trash2, QrCode, Copy, Check, Users, Minus, Plus, Wallet, CreditCard, Banknote, ListChecks, DollarSign, Printer, ChevronLeft, Search, Info, ShoppingBag, CheckCircle2, Clock, Undo2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, query, collection, orderBy, where, serverTimestamp, addDoc, getCountFromServer } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { MenuItemSelectionDialog } from "./menu-item-selection-dialog";
import { OrderReceiptModal } from "./order-receipt-modal";
import { KitchenOrderModal } from "./kitchen-order-modal";
import { useRestaurant } from "@/hooks/use-restaurant";

export const PAYMENT_METHODS = [
    { id: 'pix', label: 'Pix', icon: QrCode },
    { id: 'credit', label: 'Crédito', icon: CreditCard },
    { id: 'debit', label: 'Débito', icon: CreditCard },
    { id: 'cash', label: 'Dinheiro', icon: Banknote },
];

function consolidateItems(items: any[]) {
    if (!items) return [];
    const groups: Record<string, any> = {};
    items.forEach(item => {
        const addonsKey = item.addons?.map((a: any) => a.name).sort().join(',') || '';
        const notesKey = item.notes?.trim() || '';
        const extraKey = item.ingredientExtrasPrice || 0;
        const key = `${item.menuItemId}-${addonsKey}-${notesKey}-${extraKey}`;
        if (groups[key]) {
            groups[key].quantity += item.quantity;
        } else {
            groups[key] = { ...item };
        }
    });
    return Object.values(groups);
}

function normalizeText(text: string) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
}

function generatePixPayload(key: string, amount: number, name: string, txid: string = '***', city: string = 'SAO PAULO') {
    const amountStr = amount.toFixed(2);
    const merchantName = normalizeText(name).slice(0, 25);
    const merchantCity = normalizeText(city).slice(0, 15);
    const cleanTxid = normalizeText(txid).replace(/\s/g, '').slice(0, 25) || '***';
    const gui = '0014br.gov.bcb.pix';
    const keyTag = `01${key.length.toString().padStart(2, '0')}${key}`;
    const merchantAccountInfo = `${gui}${keyTag}`;
    const txidTag = `05${cleanTxid.length.toString().padStart(2, '0')}${cleanTxid}`;
    const payload = ['000201', `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`, '52040000', '5303986', `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`, '5802BR', `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`, `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`, `62${txidTag.length.toString().padStart(2, '0')}${txidTag}`, '6304'].join('');
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= (payload.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function OrderDetailsModal({ order, isOpen, onOpenChange, onStatusChange }: OrderDetailsModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { role } = useRestaurant();

    const [lastOpenedOrderId, setLastOpenedOrderId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    const [isSplitting, setIsSplitting] = useState(false);
    const [splitMode, setSplitMode] = useState<'value' | 'items'>('value');
    const [peopleCount, setPeopleCount] = useState(2);
    const [paidPartsCount, setPaidPartsCount] = useState(0);
    const [accumulatedPaid, setAccumulatedPaid] = useState(0);
    const [currentPartAmount, setCurrentPartAmount] = useState<number>(0);
    const [recordedSplitParts, setRecordedSplitParts] = useState<SplitPaymentPart[]>([]);
    
    const [itemsBalance, setItemsBalance] = useState<any[]>([]);
    const [selectedItemsForPart, setSelectedItemsForPart] = useState<Record<number, number>>({});

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState<string | null>(null);
    const [selectedItemToAdd, setSelectedItemToAdd] = useState<MenuItem | null>(null);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [showKitchenPrint, setShowKitchenPrint] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const relatedOrdersQuery = useMemoFirebase(() => {
        if (!order?.tableId || !order?.restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${order.restaurantId}/orders`),
            where('tableId', '==', order.tableId),
            where('status', '==', order.status)
        );
    }, [order?.tableId, order?.restaurantId, order?.status, firestore, isOpen]);

    const { data: relatedOrders } = useCollection<Order>(relatedOrdersQuery);

    const allGroupedOrders = useMemo(() => {
        if (!order) return [];
        const list = relatedOrders ? [...relatedOrders] : [];
        if (!list.some(o => o.id === order.id)) list.push(order);
        return list;
    }, [relatedOrders, order]);

    const combinedTotal = useMemo(() => {
        return allGroupedOrders.reduce((acc, curr) => acc + curr.total, 0);
    }, [allGroupedOrders]);

    const currentGroupItems = useMemo(() => {
        const combined = allGroupedOrders.flatMap(o => o.items);
        return consolidateItems(combined);
    }, [allGroupedOrders]);

    const groupedItemsWithDelivery = useMemo(() => {
        if (!allGroupedOrders || allGroupedOrders.length === 0) return [];

        type GroupEntry = {
            key: string;
            name: string;
            quantity: number;
            priceAtOrder: number;
            notes?: string;
            addons?: any[];
            ingredientExtrasPrice?: number;
            deliveredCount: number;
            isFullyDelivered: boolean;
            sourceRefs: { orderId: string; itemIndex: number; isDelivered: boolean }[];
        };

        const groups: Record<string, GroupEntry> = {};

        allGroupedOrders.forEach(ord => {
            if (!ord.items) return;
            ord.items.forEach((item, itemIndex) => {
                const addonsKey = item.addons?.map((a: any) => a.name).sort().join(',') || '';
                const notesKey = item.notes?.trim() || '';
                const extraKey = item.ingredientExtrasPrice || 0;
                const isItemDelivered = item.status === 'entregue' || (item as any).delivered === true;
                const key = `${item.menuItemId}-${addonsKey}-${notesKey}-${extraKey}`;

                if (!groups[key]) {
                    groups[key] = {
                        key,
                        name: item.name,
                        quantity: item.quantity,
                        priceAtOrder: item.priceAtOrder,
                        notes: item.notes,
                        addons: item.addons,
                        ingredientExtrasPrice: item.ingredientExtrasPrice,
                        deliveredCount: isItemDelivered ? item.quantity : 0,
                        isFullyDelivered: isItemDelivered,
                        sourceRefs: [{ orderId: ord.id, itemIndex, isDelivered: isItemDelivered }]
                    };
                } else {
                    groups[key].quantity += item.quantity;
                    if (isItemDelivered) {
                        groups[key].deliveredCount += item.quantity;
                    }
                    groups[key].sourceRefs.push({ orderId: ord.id, itemIndex, isDelivered: isItemDelivered });
                    groups[key].isFullyDelivered = groups[key].deliveredCount === groups[key].quantity;
                }
            });
        });

        return Object.values(groups);
    }, [allGroupedOrders]);

    const totalItemsCount = useMemo(() => {
        return groupedItemsWithDelivery.reduce((acc, curr) => acc + curr.quantity, 0);
    }, [groupedItemsWithDelivery]);

    const deliveredItemsCount = useMemo(() => {
        return groupedItemsWithDelivery.reduce((acc, curr) => acc + curr.deliveredCount, 0);
    }, [groupedItemsWithDelivery]);

    const allItemsDelivered = totalItemsCount > 0 && deliveredItemsCount === totalItemsCount;

    const handleToggleItemDelivery = async (group: any) => {
        if (!firestore || !order?.restaurantId) return;

        try {
            const nextDelivered = !group.isFullyDelivered;
            const nextStatus = nextDelivered ? 'entregue' : 'pendente';

            const orderMap = new Map<string, number[]>();
            group.sourceRefs.forEach((ref: any) => {
                const list = orderMap.get(ref.orderId) || [];
                list.push(ref.itemIndex);
                orderMap.set(ref.orderId, list);
            });

            const updatePromises: Promise<any>[] = [];

            orderMap.forEach((indices, targetOrderId) => {
                const targetOrder = allGroupedOrders.find(o => o.id === targetOrderId);
                if (!targetOrder) return;

                const updatedItems = [...targetOrder.items];
                indices.forEach(idx => {
                    if (updatedItems[idx]) {
                        updatedItems[idx] = {
                            ...updatedItems[idx],
                            status: nextStatus as any,
                            delivered: nextDelivered,
                            deliveredAt: nextDelivered ? new Date().toISOString() : null
                        };
                    }
                });

                const orderDocRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, targetOrderId);
                updatePromises.push(updateDoc(orderDocRef, { items: updatedItems }));
            });

            await Promise.all(updatePromises);

            toast({
                title: nextDelivered ? `"${group.name}" marcado como entregue!` : `"${group.name}" marcado como pendente`,
                description: nextDelivered ? "Item entregue ao cliente." : "Status retornado para pendente."
            });
        } catch (error) {
            console.error("Erro ao atualizar entrega do item:", error);
            toast({
                variant: "destructive",
                title: "Erro ao atualizar item",
                description: "Não foi possível salvar o status de entrega."
            });
        }
    };

    const handleMarkAllItemsDelivered = async (nextDelivered: boolean = true) => {
        if (!firestore || !order?.restaurantId || allGroupedOrders.length === 0) return;

        try {
            const nextStatus = nextDelivered ? 'entregue' : 'pendente';
            const updatePromises = allGroupedOrders.map(ord => {
                const updatedItems = (ord.items || []).map(item => ({
                    ...item,
                    status: nextStatus as any,
                    delivered: nextDelivered,
                    deliveredAt: nextDelivered ? new Date().toISOString() : null
                }));
                const orderDocRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, ord.id);
                return updateDoc(orderDocRef, { items: updatedItems });
            });

            await Promise.all(updatePromises);

            toast({
                title: nextDelivered 
                    ? "Todos os itens foram marcados como entregues!" 
                    : "Todos os itens foram marcados como pendentes"
            });
        } catch (error) {
            console.error("Erro ao atualizar todos os itens:", error);
            toast({
                variant: "destructive",
                title: "Erro ao atualizar itens"
            });
        }
    };


    const restaurantRef = useMemoFirebase(() => order?.restaurantId ? doc(firestore, 'restaurants', order.restaurantId) : null, [firestore, order?.restaurantId]);
    const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

    const categoriesQuery = useMemoFirebase(() => {
        if (!order?.restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${order.restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
    }, [order?.restaurantId, firestore]);

    const itemsQuery = useMemoFirebase(() => {
        if (!order?.restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${order.restaurantId}/menuItems`));
    }, [order?.restaurantId, firestore]);

    const { data: categories } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: items } = useCollection<MenuItem>(itemsQuery);

    const remainingBalance = useMemo(() => {
        return Math.max(0, combinedTotal - accumulatedPaid);
    }, [combinedTotal, accumulatedPaid]);

    useEffect(() => {
        if (isOpen && order && order.id !== lastOpenedOrderId) {
            setLastOpenedOrderId(order.id);
            setPaymentMethod(null);
            setCopied(false);
            setIsSplitting(false);
            setSplitMode('value');
            setPeopleCount(2);
            setPaidPartsCount(0);
            setAccumulatedPaid(0);
            setRecordedSplitParts([]);
            setSelectedItemsForPart({});
            setShowReceiptPreview(false);
            setShowKitchenPrint(false);
            setShowCancelConfirm(false);
        }
    }, [isOpen, order, lastOpenedOrderId]);

    useEffect(() => {
        if (isOpen) {
            setItemsBalance(currentGroupItems.map((item, idx) => ({ ...item, originalIndex: idx, remainingQty: item.quantity })));
        }
    }, [currentGroupItems, isOpen]);

    useEffect(() => {
        if (splitMode === 'items') {
            let total = 0;
            Object.entries(selectedItemsForPart).forEach(([idx, qty]) => {
                const item = itemsBalance[Number(idx)];
                if (item) total += (item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * qty;
            });
            setCurrentPartAmount(Number(total.toFixed(2)));
        }
    }, [selectedItemsForPart, splitMode, itemsBalance]);

    useEffect(() => {
        if (isSplitting && splitMode === 'value' && remainingBalance > 0) {
            const suggested = paidPartsCount < peopleCount - 1 ? combinedTotal / peopleCount : remainingBalance;
            setCurrentPartAmount(Number(suggested.toFixed(2)));
        }
    }, [isSplitting, splitMode, remainingBalance, combinedTotal, peopleCount, paidPartsCount]);

    const amountForPix = isSplitting ? currentPartAmount : (remainingBalance || combinedTotal || 0);
    const txidLabel = `PEDIDO${order?.orderNumber}${isSplitting ? 'P' + (paidPartsCount + 1) : ''}`;

    const pixPayload = useMemo(() => {
        if (restaurant?.pixKey && amountForPix > 0) {
            return generatePixPayload(
                restaurant.pixKey, 
                amountForPix, 
                restaurant.name || 'Restaurante', 
                txidLabel,
                restaurant.city || 'SAO PAULO'
            );
        }
        return null;
    }, [restaurant, amountForPix, txidLabel]);

    const qrCodeUrl = useMemo(() => {
        if (!pixPayload) return null;
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`;
    }, [pixPayload]);

    if (!order) return null;

    const displayOrderNumber = order.orderNumber?.toString().padStart(3, '0') || '000';
    const isFinalizing = order.status === 'pronto';
    const isFullyPaid = accumulatedPaid >= (combinedTotal || 0) - 0.05;

    const handleRegisterPart = () => {
        if (!paymentMethod) return toast({ variant: "destructive", title: "Selecione o pagamento" });
        if (currentPartAmount <= 0 || currentPartAmount > remainingBalance + 0.05) return toast({ variant: "destructive", title: "Valor inválido" });

        // CRITICAL: Avoid 'undefined' in the object, spread optionally instead
        const newPart: SplitPaymentPart = {
            part: paidPartsCount + 1,
            amount: currentPartAmount,
            method: paymentMethod,
            ...(splitMode === 'items' ? {
                items: Object.entries(selectedItemsForPart)
                    .filter(([_, qty]) => qty > 0)
                    .map(([idx, qty]) => ({
                        name: itemsBalance[Number(idx)].name,
                        quantity: qty
                    }))
            } : {})
        };

        if (splitMode === 'items') {
            setItemsBalance(prev => prev.map((item, idx) => ({
                ...item,
                remainingQty: Number((item.remainingQty - (selectedItemsForPart[idx] || 0)).toFixed(2))
            })));
            setSelectedItemsForPart({});
        }

        setRecordedSplitParts(prev => [...prev, newPart]);
        setAccumulatedPaid(prev => prev + currentPartAmount);
        setPaidPartsCount(prev => prev + 1);
        setPaymentMethod(null);
        toast({ title: `Parte ${paidPartsCount + 1} registrada!` });
    };

    const handleItemQtyChange = (index: number, delta: number) => {
        const item = itemsBalance[index];
        const currentSelected = selectedItemsForPart[index] || 0;
        const next = Math.max(0, Math.min(item.remainingQty, currentSelected + delta));
        setSelectedItemsForPart(prev => ({ ...prev, [index]: next }));
    };

    const handleConfirmAddExtra = async (data: { item: MenuItem; quantity: number; addons: any[]; notes: string; totalPrice: number; ingredientsExtraPrice: number }) => {
        try {
            const ordersCol = collection(firestore, `restaurants/${order.restaurantId}/orders`);
            const snapshot = await getCountFromServer(ordersCol);
            const nextOrderNumber = (snapshot.data().count || 0) + 1;

            const newOrderData = {
                restaurantId: order.restaurantId,
                orderNumber: nextOrderNumber,
                origin: order.origin || 'mesa',
                destination: order.destination || 'local',
                tableId: order.tableId || null,
                tableName: order.tableName || 'Mesa',
                customerName: order.customerName || null,
                customerPhone: order.customerPhone || null,
                status: 'aberto',
                total: data.totalPrice,
                createdAt: serverTimestamp(),
                items: [{
                    menuItemId: data.item.id,
                    name: data.item.name,
                    quantity: data.quantity,
                    priceAtOrder: data.item.price,
                    notes: data.notes || null,
                    status: 'pendente' as const,
                    printSectorId: data.item.printSectorId,
                    addons: data.addons?.map(a => ({ name: a.name, price: a.price })) || [],
                    ingredientExtrasPrice: data.ingredientsExtraPrice || 0,
                    preparationTimeAtOrder: data.item.preparationTime || 0
                }]
            };

            await addDoc(ordersCol, newOrderData);
            toast({ title: "Novo pedido adicionado!" });
            setSelectedItemToAdd(null);
            setIsMenuOpen(false);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Erro ao adicionar item" });
        }
    };

    const handlePrintKitchen = async () => {
        const idsToUpdate = allGroupedOrders.map(o => o.id);
        const promises = idsToUpdate.map(id => {
            const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, id);
            return updateDoc(orderRef, { isPrinted: true }).catch(() => {});
        });
        await Promise.all(promises);
        
        setShowKitchenPrint(true);
        setTimeout(() => {
            window.print();
            setShowKitchenPrint(false);
        }, 500); 
    };

    const handleActionClick = () => {
        if (isFinalizing && !isFullyPaid && isSplitting) return toast({ variant: "destructive", title: "Conta incompleta" });
        if (isFinalizing && !paymentMethod && !isSplitting) return toast({ variant: "destructive", title: "Selecione o pagamento" });
        
        const nextStatusMap: Record<string, OrderStatus> = {
            'aberto': 'preparando',
            'preparando': 'pronto',
            'pronto': 'finalizado'
        };

        const newStatus = nextStatusMap[order.status];
        if (!newStatus) return; // Safety check for undefined status transition

        const finalData: any = isFinalizing ? { 
            paymentMethod: isSplitting ? 'multiplos' : (paymentMethod || 'manual'),
            splitPayments: isSplitting ? recordedSplitParts : null,
            closedAt: serverTimestamp()
        } : {};

        const targetIds = allGroupedOrders.map(o => o.id);
        onStatusChange(targetIds, newStatus, finalData);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[90vh] sm:max-w-lg flex flex-col p-0 overflow-hidden border-none sm:border [&>button:last-child]:hidden">
                    <DialogHeader className="p-4 sm:p-6 pb-3 flex flex-row items-center gap-2 space-y-0 shrink-0 bg-background z-10 border-b">
                        <Button variant="ghost" size="icon" className="h-9 w-9 -ml-1 shrink-0 rounded-xl" onClick={() => onOpenChange(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col flex-1 min-w-0">
                            <DialogTitle className="font-black uppercase tracking-tight text-lg sm:text-xl truncate">
                                {order.tableName || `Pedido #${displayOrderNumber}`}
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground font-medium truncate">
                                {order.customerName ? `Cliente: ${order.customerName}` : order.origin === 'mesa' ? 'Atendimento na Mesa' : order.destination === 'entrega' ? 'Pedido para Entrega' : 'Atendimento no Balcão'}
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {order.status === 'aberto' && (
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-9 w-9 border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 rounded-xl" 
                                    onClick={handlePrintKitchen}
                                    title="Imprimir comanda da cozinha"
                                >
                                    <ChefHat className="h-4 w-4" />
                                </Button>
                            )}
                            {order.status === 'pronto' && (
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-9 w-9 border-2 border-primary/20 text-primary hover:bg-primary/5 rounded-xl" 
                                    onClick={() => setShowReceiptPreview(true)}
                                    title="Imprimir cupom"
                                >
                                    <Printer className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-4 sm:p-6 space-y-6">
                            {/* Resumo de Status e Total */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-black uppercase text-muted-foreground">Status do Pedido</span>
                                    <Badge className={cn("w-full justify-center h-8 font-black text-xs uppercase rounded-xl border-none shadow-xs", 
                                        order.status === 'aberto' ? 'bg-blue-600 text-white' : 
                                        order.status === 'preparando' ? 'bg-amber-500 text-white' : 
                                        'bg-emerald-600 text-white'
                                    )}>
                                        {order.status === 'aberto' ? '⏳ Em Aberto' : 
                                         order.status === 'preparando' ? '🍳 Em Preparo' : 
                                         '✅ Pronto p/ Servir'}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] font-black uppercase text-muted-foreground">Total da Comanda</span>
                                    <div className="h-8 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}
                                    </div>
                                </div>
                            </div>

                            {/* Seção de Itens da Comanda com controle de entrega */}
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-2.5 border-b pb-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-primary" />
                                                ITENS DA COMANDA
                                            </h4>
                                            {order.status === 'aberto' && (
                                                <Button variant="outline" size="sm" className="h-8 text-xs font-bold rounded-xl border-2" onClick={() => setIsMenuOpen(true)}>
                                                    <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Adicionar Item
                                                </Button>
                                            )}
                                        </div>
                                        
                                        {totalItemsCount > 0 && (
                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    Progresso: <strong className="text-foreground">{deliveredItemsCount} de {totalItemsCount} entregues</strong> ({Math.round((deliveredItemsCount / totalItemsCount) * 100)}%)
                                                </p>

                                                <Button
                                                    variant={allItemsDelivered ? "ghost" : "outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "h-8 px-3 text-xs font-bold rounded-xl transition-all shrink-0",
                                                        allItemsDelivered 
                                                            ? "text-muted-foreground hover:bg-muted" 
                                                            : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                    )}
                                                    onClick={() => handleMarkAllItemsDelivered(!allItemsDelivered)}
                                                >
                                                    {allItemsDelivered ? (
                                                        <>
                                                            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                                            Desmarcar Todos
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                                            Entregar Todos os Itens
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barra de progresso visual de entrega */}
                                    {totalItemsCount > 0 && (
                                        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border">
                                            <div 
                                                className="bg-emerald-600 h-full transition-all duration-300 rounded-full" 
                                                style={{ width: `${Math.round((deliveredItemsCount / totalItemsCount) * 100)}%` }}
                                            />
                                        </div>
                                    )}

                                    {allItemsDelivered && totalItemsCount > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <span className="leading-snug">Todos os itens desta comanda já foram entregues na mesa!</span>
                                        </div>
                                    )}

                                    {/* Lista de Itens do Pedido */}
                                    <div className="space-y-3 pt-1">
                                        {groupedItemsWithDelivery.map((item, idx) => {
                                            const itemTotalPrice = (item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * item.quantity;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={cn(
                                                        "p-3.5 sm:p-4 rounded-2xl border-2 transition-all shadow-xs flex flex-col gap-3",
                                                        item.isFullyDelivered 
                                                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800" 
                                                            : "bg-card border-border hover:border-primary/40"
                                                    )}
                                                >
                                                    {/* Linha Superior: Quantidade + Nome do item sem corte + Preço */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                            <span className={cn(
                                                                "flex items-center justify-center min-w-8 h-7 px-2 rounded-lg text-xs font-black shrink-0 mt-0.5",
                                                                item.isFullyDelivered 
                                                                    ? "bg-emerald-600 text-white" 
                                                                    : "bg-muted text-foreground"
                                                            )}>
                                                                {item.quantity}x
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn(
                                                                    "text-sm font-black uppercase leading-snug break-words hyphens-auto",
                                                                    item.isFullyDelivered && "text-emerald-900 dark:text-emerald-200 opacity-90"
                                                                )}>
                                                                    {item.name}
                                                                </p>
                                                                {item.addons?.map((a: any, ai: number) => (
                                                                    <p key={ai} className="text-xs text-muted-foreground font-semibold mt-0.5 leading-normal break-words">+ {a.name} (+R$ {a.price.toFixed(2)})</p>
                                                                ))}
                                                                {item.ingredientExtrasPrice > 0 && (
                                                                    <p className="text-xs text-muted-foreground font-semibold mt-0.5 leading-normal break-words">+ EXTRA (+R$ {item.ingredientExtrasPrice.toFixed(2)})</p>
                                                                )}
                                                                {item.notes && (
                                                                    <p className="text-xs italic text-primary font-bold px-2.5 py-1 bg-primary/10 rounded-md mt-1.5 inline-block break-words leading-tight">
                                                                        Obs: {item.notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <span className="text-sm sm:text-base font-black text-foreground">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotalPrice)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Linha Inferior: Status e Botão de Ação flexível sem cortar texto */}
                                                    <div className="pt-2.5 border-t flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                                                        {item.isFullyDelivered ? (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                                                <span>Entregue na mesa</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold">
                                                                <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                                                <span>Aguardando entrega</span>
                                                            </div>
                                                        )}

                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={item.isFullyDelivered ? "outline" : "default"}
                                                            onClick={() => handleToggleItemDelivery(item)}
                                                            className={cn(
                                                                "h-9 px-3.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs cursor-pointer shrink-0 ml-auto",
                                                                item.isFullyDelivered
                                                                    ? "text-muted-foreground hover:bg-muted border-border"
                                                                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                            )}
                                                            title={item.isFullyDelivered ? "Clique para desfazer entrega" : "Clique para marcar como entregue"}
                                                        >
                                                            {item.isFullyDelivered ? (
                                                                <>
                                                                    <Undo2 className="h-3.5 w-3.5 mr-1" />
                                                                    <span>Desfazer</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle2 className="h-4 w-4 mr-1 text-white" />
                                                                    <span>Marcar Entregue</span>
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>



                            {isFinalizing && (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <p className="font-black text-[10px] uppercase text-primary flex items-center gap-2"><Users className="h-3 w-3" /> Divisão de Conta</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Dividir?</span>
                                            <Switch checked={isSplitting} onCheckedChange={setIsSplitting} />
                                        </div>
                                    </div>

                                    {isSplitting ? (
                                        <div className="space-y-4">
                                            <div className="flex bg-muted/50 p-1 rounded-xl">
                                                <button onClick={() => setSplitMode('value')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase transition-all", splitMode === 'value' ? "bg-background shadow-xs text-foreground" : "text-muted-foreground opacity-70")}><DollarSign className="h-4 w-4" /> Por Valor</button>
                                                <button onClick={() => setSplitMode('items')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase transition-all", splitMode === 'items' ? "bg-background shadow-xs text-foreground" : "text-muted-foreground opacity-70")}><ListChecks className="h-4 w-4" /> Por Itens</button>
                                            </div>

                                            {splitMode === 'items' ? (
                                                <div className="space-y-3 bg-muted/20 p-4 rounded-xl border-2">
                                                    <div className="space-y-2">
                                                        {itemsBalance.map((item, idx) => item.remainingQty > 0 && (
                                                            <div key={idx} className="flex items-center justify-between bg-background p-3 rounded-xl border">
                                                                <div className="flex-1 min-w-0 pr-3">
                                                                    <p className="text-xs font-black uppercase break-words leading-tight">{item.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground font-bold mt-0.5">{item.remainingQty} restantes</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleItemQtyChange(idx, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                                                                    <span className="text-sm font-black min-w-[24px] text-center">{selectedItemsForPart[idx] || 0}</span>
                                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleItemQtyChange(idx, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-primary/5 p-4 rounded-xl border-2 border-primary/20 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">Pessoas</span>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))} disabled={paidPartsCount > 0}><Minus className="h-3 w-3" /></Button>
                                                            <span className="font-black text-sm">{peopleCount}</span>
                                                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPeopleCount(peopleCount + 1)} disabled={paidPartsCount > 0}><Plus className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">Status</span>
                                                        <p className="text-sm font-black text-primary">{paidPartsCount} pagas</p>
                                                    </div>
                                                </div>
                                            )}

                                            {!isFullyPaid && (
                                                <div className="space-y-4 bg-muted/30 p-4 rounded-xl border-2 border-dashed">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase">Valor desta Parte (R$)</Label>
                                                        <div className="relative">
                                                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input type="number" step="0.01" value={currentPartAmount} onChange={e => setCurrentPartAmount(Number(e.target.value))} className="pl-9 font-black text-lg h-12" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black uppercase">Forma de Pagamento</Label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {PAYMENT_METHODS.map((method) => (
                                                                <button key={method.id} onClick={() => setPaymentMethod(method.id)} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all", paymentMethod === method.id ? "border-primary bg-primary/5" : "border-muted bg-background")}>
                                                                    <method.icon className="h-3 w-3" />
                                                                    <span className="text-[9px] font-black uppercase">{method.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {paymentMethod === 'pix' && qrCodeUrl && (
                                                        <div className="p-4 bg-white rounded-xl border-2 border-primary/20 flex flex-col items-center gap-3 animate-in zoom-in-95">
                                                            <p className="text-[10px] font-black uppercase text-primary">Pagar Parte {paidPartsCount + 1} com Pix</p>
                                                            <div className="relative h-40 w-40 bg-white p-2 rounded-lg shadow-inner">
                                                                <Image src={qrCodeUrl} alt="Pix" width={160} height={160} />
                                                            </div>
                                                            <Button variant="outline" size="sm" className="w-full h-9 text-[10px] font-black uppercase gap-2" onClick={() => { if (pixPayload) { navigator.clipboard.writeText(pixPayload); setCopied(true); toast({ title: "Copiado!" }); setTimeout(() => setCopied(false), 2000); } }}>
                                                                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copiado!" : "Copiar Código Pix"}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    <Button className="w-full h-10 font-black uppercase text-[10px] bg-black" onClick={handleRegisterPart}>Confirmar Parte {paidPartsCount + 1}</Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <p className="font-black text-xs text-foreground flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-primary" /> 
                                                Como o cliente vai pagar?
                                            </p>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {PAYMENT_METHODS.map((method) => (
                                                    <button 
                                                        key={method.id} 
                                                        type="button"
                                                        onClick={() => setPaymentMethod(method.id)} 
                                                        className={cn(
                                                            "flex items-center justify-center gap-2.5 p-3.5 rounded-xl border-2 transition-all active:scale-95",
                                                            paymentMethod === method.id 
                                                                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs" 
                                                                : "border-border bg-background hover:bg-muted text-foreground"
                                                        )}
                                                    >
                                                        <method.icon className="h-5 w-5" />
                                                        <span className="text-sm font-bold">{method.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {paymentMethod === 'pix' && qrCodeUrl && (
                                                <div className="p-4 bg-white dark:bg-card rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 flex flex-col items-center gap-3 animate-in zoom-in-95">
                                                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                                                        Aponte a câmera para o QR Code Pix
                                                    </p>
                                                    <div className="relative h-44 w-44 bg-white p-2 rounded-xl shadow-xs border">
                                                        <Image src={qrCodeUrl} alt="QR Code Pix" width={176} height={176} />
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        size="lg" 
                                                        className="w-full h-12 text-xs font-bold gap-2 rounded-xl border-2" 
                                                        onClick={() => { 
                                                            if (pixPayload) { 
                                                                navigator.clipboard.writeText(pixPayload); 
                                                                setCopied(true); 
                                                                toast({ title: "Código Pix Copiado!" }); 
                                                                setTimeout(() => setCopied(false), 2000); 
                                                            } 
                                                        }}
                                                    >
                                                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} 
                                                        {copied ? "Copiado com Sucesso!" : "Copiar Código Pix (Copia e Cola)"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>

                    <div className="p-4 sm:p-5 bg-muted/20 border-t mt-auto shrink-0 bg-background z-10">
                        <div className="flex justify-between items-center text-lg font-black mb-3">
                            <span className="text-xs sm:text-sm text-muted-foreground uppercase font-bold">Valor Total</span>
                            <span className="text-xl sm:text-2xl text-emerald-700 dark:text-emerald-400 font-black">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}
                            </span>
                        </div>

                        <DialogFooter className="flex-row gap-2">
                            <Button 
                                variant="outline" 
                                className="font-bold text-xs h-12 px-3 sm:px-4 rounded-xl border-2 shrink-0" 
                                onClick={() => onOpenChange(false)}
                            >
                                Voltar
                            </Button>
                            
                            {(order.status === 'aberto' || order.status === 'preparando') && (
                                <Button 
                                    variant="destructive" 
                                    className="font-bold text-xs h-12 px-3 rounded-xl shrink-0" 
                                    onClick={() => setShowCancelConfirm(true)}
                                    title="Cancelar comanda"
                                >
                                    <Trash2 className="h-4 w-4 sm:mr-1.5"/> 
                                    <span className="hidden sm:inline">Cancelar</span>
                                </Button>
                            )}
                            
                            {order.status !== 'finalizado' && (
                                <Button 
                                    className={cn(
                                        "flex-1 min-w-0 font-black text-xs sm:text-sm h-12 rounded-xl shadow-md transition-all px-2.5 sm:px-4 flex items-center justify-center text-center",
                                        order.status === 'pronto' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    )}
                                    onClick={handleActionClick}
                                    disabled={isFinalizing && (isSplitting ? !isFullyPaid : !paymentMethod)}
                                >
                                    <span className="flex items-center justify-center gap-1.5 min-w-0">
                                        {order.status === 'aberto' ? <ChefHat className="shrink-0 h-4 w-4" /> : order.status === 'preparando' ? <ShoppingBag className="shrink-0 h-4 w-4" /> : <Check className="shrink-0 h-4 w-4" />}
                                        <span className="break-words leading-tight">
                                            {order.status === 'aberto' ? 'Iniciar Preparo' : order.status === 'preparando' ? 'Marcar Pronto' : 'Receber e Finalizar'}
                                        </span>
                                        <ArrowRight className="shrink-0 h-4 w-4 ml-1 hidden xs:inline-block"/>
                                    </span>
                                </Button>
                            )}
                        </DialogFooter>
                    </div>

                </DialogContent>
            </Dialog>

            <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Cancelar Pedido?</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação removerá os itens da comanda.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { onStatusChange(allGroupedOrders.map(o => o.id), 'cancelado'); setShowCancelConfirm(false); }} className="bg-destructive">Sim, cancelar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[80vh] sm:max-w-[450px] p-0 flex flex-col border-none sm:border overflow-hidden [&>button:last-child]:hidden">
                    <DialogHeader className="p-4 border-b flex flex-row items-center gap-2 space-y-0 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsMenuOpen(false)}><ChevronLeft className="h-5 w-5" /></Button>
                        <DialogTitle className="text-sm font-black uppercase">Adicionar Item Extra</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 bg-muted/10 border-b space-y-3 shrink-0">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">1. Escolha a Categoria</Label>
                        <Select value={selectedMenuCategoryId || ""} onValueChange={setSelectedMenuCategoryId}>
                            <SelectTrigger className="h-12 border-2 bg-background font-bold text-xs uppercase shadow-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>{categories?.map(cat => <SelectItem key={cat.id} value={cat.id} className="text-xs font-bold uppercase">{cat.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <ScrollArea className="flex-1 p-4 bg-background">
                        {selectedMenuCategoryId ? (
                            <div className="space-y-3">
                                {items?.filter(i => i.categoryId === selectedMenuCategoryId && i.isAvailable).map(item => (
                                    <Card key={item.id} className="p-3 flex items-center gap-4 cursor-pointer hover:border-primary border-2 transition-all active:scale-95 shadow-sm" onClick={() => { if (((item.ingredients?.length || 0) > 0) || ((item.addonGroups?.length || 0) > 0)) { setSelectedItemToAdd(item); } else { handleConfirmAddExtra({ item, quantity: 1, addons: [], notes: "", totalPrice: item.price, ingredientsExtraPrice: 0 }); } }}>
                                        <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0 border"><img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /></div>
                                        <div className="flex-1 min-w-0"><p className="text-[11px] font-black uppercase truncate mb-1">{item.name}</p><p className="text-xs font-black text-primary">R$ {item.price.toFixed(2)}</p></div>
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20"><Plus className="h-4 w-4 text-primary" /></div>
                                    </Card>
                                ))}
                            </div>
                        ) : <div className="flex flex-col items-center justify-center h-full py-20 opacity-30"><Search className="h-12 w-12 text-muted-foreground" /><p className="text-[11px] font-black uppercase">Aguardando Categoria</p></div>}
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <MenuItemSelectionDialog item={selectedItemToAdd} isOpen={!!selectedItemToAdd} onClose={() => setSelectedItemToAdd(null)} onConfirm={handleConfirmAddExtra} />
            <OrderReceiptModal isOpen={showReceiptPreview} onClose={() => setShowReceiptPreview(false)} restaurant={restaurant} pixPayload={pixPayload} order={{ ...order, items: currentGroupItems, total: combinedTotal, splitPayments: recordedSplitParts.length > 0 ? recordedSplitParts : (order.splitPayments || []), paymentMethod: recordedSplitParts.length > 0 ? 'multiplos' : (paymentMethod || order.paymentMethod || 'A Pagar') }} />
            {showKitchenPrint && <KitchenOrderModal restaurant={restaurant} pixPayload={pixPayload} order={{ ...order, items: currentGroupItems }} />}
        </>
    );
}

interface OrderDetailsModalProps {
    order: Order | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onStatusChange: (orderIds: string | string[], status: OrderStatus, extraData?: any) => void;
}

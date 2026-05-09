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
import type { Order, OrderStatus, Restaurant, SplitPaymentPart, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ChefHat, Bike, ShoppingBag, Trash2, QrCode, Copy, Check, Users, Minus, Plus, Wallet, CreditCard, Banknote, ListChecks, DollarSign, Printer, ChevronLeft, Search, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, arrayUnion, increment, query, collection, orderBy, where } from "firebase/firestore";
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
        const key = `${item.menuItemId}-${addonsKey}-${notesKey}`;
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
            where('status', 'in', ['aberto', 'preparando', 'pronto'])
        );
    }, [order?.tableId, order?.restaurantId, firestore, isOpen]);

    const { data: relatedOrders } = useCollection<Order>(relatedOrdersQuery);

    const allGroupedOrders = useMemo(() => {
        if (!order) return [];
        if (!relatedOrders || relatedOrders.length === 0) return [order];
        const list = [...relatedOrders];
        if (!list.some(o => o.id === order.id)) list.push(order);
        return list;
    }, [relatedOrders, order]);

    const combinedTotal = useMemo(() => {
        return allGroupedOrders.reduce((acc, curr) => acc + curr.total, 0);
    }, [allGroupedOrders]);

    const itemsByStatus = useMemo(() => {
        const map: Record<string, any[]> = {
            'aberto': [],
            'preparando': [],
            'pronto': []
        };
        allGroupedOrders.forEach(o => {
            if (map[o.status]) {
                map[o.status].push(...o.items);
            }
        });
        Object.keys(map).forEach(s => {
            map[s] = consolidateItems(map[s]);
        });
        return map;
    }, [allGroupedOrders]);

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
            const combined = allGroupedOrders.flatMap(o => o.items);
            const consolidated = consolidateItems(combined);
            setItemsBalance(consolidated.map((item, idx) => ({ ...item, originalIndex: idx, remainingQty: item.quantity })));
        }
    }, [allGroupedOrders, isOpen]);

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

    const amountForPix = isSplitting ? currentPartAmount : (remainingBalance || 0);
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
    const isGrouped = allGroupedOrders.length > 1;
    const isFinalizing = order.status === 'pronto' || (isGrouped && allGroupedOrders.some(o => o.status === 'pronto'));
    const isFullyPaid = accumulatedPaid >= (combinedTotal || 0) - 0.05;

    const getCategoryName = (menuItemId: string) => {
        const menuItem = items?.find(i => i.id === menuItemId);
        if (!menuItem) return '';
        const category = categories?.find(c => c.id === menuItem.categoryId);
        return category?.name || '';
    };

    const handleRegisterPart = () => {
        if (!paymentMethod) return toast({ variant: "destructive", title: "Selecione o pagamento" });
        if (currentPartAmount <= 0 || currentPartAmount > remainingBalance + 0.05) return toast({ variant: "destructive", title: "Valor inválido" });

        const newPart: SplitPaymentPart = {
            part: paidPartsCount + 1,
            amount: currentPartAmount,
            method: paymentMethod,
            items: splitMode === 'items' ? Object.entries(selectedItemsForPart)
                .filter(([_, qty]) => qty > 0)
                .map(([idx, qty]) => ({
                    name: itemsBalance[Number(idx)].name,
                    quantity: qty
                })) : undefined
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
        const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, order.id);
        
        const newItem = {
            menuItemId: data.item.id,
            name: data.item.name,
            quantity: data.quantity,
            priceAtOrder: data.item.price,
            notes: data.notes || null,
            status: 'pendente' as const,
            printSectorId: data.item.printSectorId,
            addons: data.addons?.map(a => ({ name: a.name, price: a.price })) || [],
            ingredientExtrasPrice: data.ingredientExtrasPrice || 0
        };

        try {
            await updateDoc(orderRef, {
                items: arrayUnion(newItem),
                total: increment(data.totalPrice)
            });
            toast({ title: "Item adicionado!" });
            setSelectedItemToAdd(null);
            setIsMenuOpen(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Erro ao adicionar item" });
        }
    };

    const handlePrintKitchen = async () => {
        const idsToUpdate = (order as any).allOrderIds || [order.id];
        const promises = idsToUpdate.map(id => {
            const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, id);
            return updateDoc(orderRef, { isPrinted: true }).catch(() => {});
        });
        await Promise.all(promises);
        setShowKitchenPrint(true);
        setTimeout(() => {
            window.print();
            setShowKitchenPrint(false);
        }, 150);
    };

    const handleActionClick = () => {
        if (isFinalizing && !isFullyPaid && isSplitting) return toast({ variant: "destructive", title: "Conta incompleta" });
        if (isFinalizing && !paymentMethod && !isSplitting) return toast({ variant: "destructive", title: "Selecione o pagamento" });
        
        const nextStatusMap: Record<string, OrderStatus> = {
            'aberto': 'preparando',
            'preparando': 'pronto',
            'pronto': 'finalizado'
        };

        const finalData: any = isFinalizing ? { 
            paymentMethod: isSplitting ? 'multiplos' : paymentMethod,
            splitPayments: isSplitting ? recordedSplitParts : null,
            closedAt: serverTimestamp()
        } : {};

        const targetIds = (order as any).allOrderIds || [order.id];
        onStatusChange(targetIds, nextStatusMap[order.status], finalData);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[90vh] sm:max-w-md flex flex-col p-0 overflow-hidden border-none sm:border [&>button:last-child]:hidden">
                    <DialogHeader className="p-6 pb-2 flex flex-row items-center gap-2 space-y-0 shrink-0 bg-background z-10 border-b">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => onOpenChange(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col flex-1">
                            <DialogTitle className="font-black uppercase tracking-tight text-xl">
                                {order.tableName || `Pedido #${displayOrderNumber}`}
                            </DialogTitle>
                            {isGrouped && (
                                <span className="text-primary text-[9px] font-black uppercase tracking-widest animate-pulse">
                                    VÁRIOS PEDIDOS AGRUPADOS
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {order.status === 'aberto' && (
                                <Button variant="outline" size="icon" className="h-9 w-9 border-2 border-orange-200 text-orange-600" onClick={handlePrintKitchen}>
                                    <ChefHat className="h-4 w-4" />
                                </Button>
                            )}
                            {order.status === 'pronto' && (
                                <Button variant="outline" size="icon" className="h-9 w-9 border-2 border-primary/20 text-primary" onClick={() => setShowReceiptPreview(true)}>
                                    <Printer className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground">Status Geral</span>
                                    <Badge className={cn("w-full justify-center h-7 font-black text-[10px] uppercase", 
                                        order.status === 'aberto' ? 'bg-blue-500' : 
                                        order.status === 'preparando' ? 'bg-yellow-500' : 
                                        'bg-green-500'
                                    )}>
                                        {isGrouped ? 'VÁRIOS PEDIDOS' : order.status}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground">Valor Acumulado</span>
                                    <div className="h-7 flex items-center justify-center rounded-md bg-primary/10 text-primary font-black text-xs">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {Object.entries(itemsByStatus).map(([status, items]) => items.length > 0 && (
                                    <div key={status} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className={cn("text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2",
                                                status === 'aberto' ? "text-blue-600" :
                                                status === 'preparando' ? "text-yellow-600" : "text-green-600"
                                            )}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", 
                                                    status === 'aberto' ? "bg-blue-600" : 
                                                    status === 'preparando' ? "bg-yellow-600" : "bg-green-600"
                                                )} />
                                                {status === 'aberto' ? 'Itens Novos (Aguardando)' : 
                                                 status === 'preparando' ? 'Em Preparo na Cozinha' : 'Itens Prontos p/ Servir'}
                                            </h4>
                                            
                                            {status === 'aberto' && order.status === 'aberto' && (
                                                <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase bg-muted" onClick={() => setIsMenuOpen(true)}>
                                                    <Plus className="h-2 w-2 mr-1" /> Adicionar Item
                                                </Button>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-2 bg-muted/20 p-3 rounded-xl border-2 border-dashed">
                                            {items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-start gap-3">
                                                    <span className="text-xs font-black text-muted-foreground mt-0.5">{item.quantity}x</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold uppercase truncate leading-tight">
                                                            <span className="text-muted-foreground mr-1">[{getCategoryName(item.menuItemId)}]</span>
                                                            {item.name}
                                                        </p>
                                                        {item.addons?.map((a: any, ai: number) => (
                                                            <p key={ai} className="text-[9px] text-muted-foreground font-bold uppercase">+ {a.name}</p>
                                                        ))}
                                                        {item.notes && <p className="text-[9px] italic text-primary font-bold mt-0.5">Obs: {item.notes}</p>}
                                                    </div>
                                                    <span className="text-[11px] font-black shrink-0">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * item.quantity)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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
                                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                                <button onClick={() => setSplitMode('value')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all", splitMode === 'value' ? "bg-background shadow-sm" : "opacity-50")}><DollarSign className="h-3 w-3" /> Valor</button>
                                                <button onClick={() => setSplitMode('items')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all", splitMode === 'items' ? "bg-background shadow-sm" : "opacity-50")}><ListChecks className="h-3 w-3" /> Itens</button>
                                            </div>

                                            {splitMode === 'items' ? (
                                                <div className="space-y-3 bg-muted/20 p-4 rounded-xl border-2">
                                                    <div className="space-y-2">
                                                        {itemsBalance.map((item, idx) => item.remainingQty > 0 && (
                                                            <div key={idx} className="flex items-center justify-between bg-background p-3 rounded-lg border">
                                                                <div className="flex-1 min-w-0 pr-2">
                                                                    <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                                                                    <p className="text-[9px] text-muted-foreground font-bold">{item.remainingQty} restantes</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleItemQtyChange(idx, -1)}><Minus className="h-3 w-3" /></Button>
                                                                    <span className="text-xs font-black min-w-[20px] text-center">{selectedItemsForPart[idx] || 0}</span>
                                                                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleItemQtyChange(idx, 1)}><Plus className="h-3 w-3" /></Button>
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
                                            <p className="font-black text-[10px] uppercase text-primary flex items-center gap-2"><CreditCard className="h-3 w-3" /> Forma de Pagamento</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {PAYMENT_METHODS.map((method) => (
                                                    <button key={method.id} onClick={() => setPaymentMethod(method.id)} className={cn("flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all", paymentMethod === method.id ? "border-primary bg-primary/5" : "border-muted bg-background")}>
                                                        <method.icon className="h-4 w-4" />
                                                        <span className="text-[10px] font-black uppercase">{method.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {paymentMethod === 'pix' && qrCodeUrl && (
                                                <div className="p-4 bg-white rounded-xl border-2 border-primary/20 flex flex-col items-center gap-3 animate-in zoom-in-95">
                                                    <p className="text-[10px] font-black uppercase text-primary">Escaneie para Pagar Total</p>
                                                    <div className="relative h-40 w-40 bg-white p-2 rounded-lg shadow-inner">
                                                        <Image src={qrCodeUrl} alt="Pix" width={160} height={160} />
                                                    </div>
                                                    <Button variant="outline" size="sm" className="w-full h-9 text-[10px] font-black uppercase gap-2" onClick={() => { if (pixPayload) { navigator.clipboard.writeText(pixPayload); setCopied(true); toast({ title: "Copiado!" }); setTimeout(() => setCopied(false), 2000); } }}>
                                                        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copiado!" : "Copiar Código Pix"}
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

                    <div className="p-6 bg-muted/20 border-t mt-auto shrink-0 bg-background z-10">
                        <div className="flex justify-between items-center text-lg font-black uppercase mb-4">
                            <span>Total Comanda</span>
                            <span className="text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}</span>
                        </div>

                        <DialogFooter className="flex-row gap-2">
                            <Button variant="ghost" className="flex-1 font-black uppercase text-[10px] h-11 border-2" onClick={() => onOpenChange(false)}>Fechar</Button>
                            
                            {order.status === 'aberto' && (
                                <Button variant="destructive" className="flex-1 font-black uppercase text-[10px] h-11" onClick={() => setShowCancelConfirm(true)}>
                                    <Trash2 className="mr-2 h-3 w-3"/> Cancelar
                                </Button>
                            )}
                            
                            {order.status !== 'finalizado' && (
                                <Button 
                                    className="flex-[2] font-black uppercase text-[10px] h-11" 
                                    onClick={handleActionClick}
                                    disabled={isFinalizing && (isSplitting ? !isFullyPaid : !paymentMethod)}
                                >
                                    {order.status === 'aberto' ? <ChefHat className="mr-2 h-4 w-4" /> : order.status === 'preparando' ? <ShoppingBag className="mr-2 h-4 w-4" /> : <Bike className="mr-2 h-4 w-4" />}
                                    {order.status === 'aberto' ? 'Marcar Preparando' : order.status === 'preparando' ? 'Marcar Pronto' : 'Finalizar Mesa'}
                                    <ArrowRight className="ml-auto h-3 w-3"/>
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
                        <AlertDialogAction onClick={() => { onStatusChange(order.id, 'cancelado'); setShowCancelConfirm(false); }} className="bg-destructive">Sim, cancelar</AlertDialogAction>
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
                                    <Card key={item.id} className="p-3 flex items-center gap-4 cursor-pointer hover:border-primary border-2 transition-all active:scale-95 shadow-sm" onClick={() => { if ((item.ingredients?.length || 0) > 0 || (item.addonGroups?.length || 0) > 0) { setSelectedItemToAdd(item); } else { handleConfirmAddExtra({ item, quantity: 1, addons: [], notes: "", totalPrice: item.price, ingredientsExtraPrice: 0 }); } }}>
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
            <OrderReceiptModal isOpen={showReceiptPreview} onClose={() => setShowReceiptPreview(false)} restaurant={restaurant} pixPayload={pixPayload} order={{ ...order, items: itemsByStatus['aberto'].concat(itemsByStatus['preparando'], itemsByStatus['pronto']), total: combinedTotal, splitPayments: recordedSplitParts.length > 0 ? recordedSplitParts : (order.splitPayments || []), paymentMethod: recordedSplitParts.length > 0 ? 'multiplos' : (paymentMethod || order.paymentMethod || 'A Pagar') }} />
            {showKitchenPrint && <KitchenOrderModal restaurant={restaurant} pixPayload={pixPayload} order={{ ...order, items: itemsByStatus['aberto'] }} />}
        </>
    );
}

interface OrderDetailsModalProps {
    order: Order | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onStatusChange: (orderIds: string | string[], status: OrderStatus, extraData?: any) => void;
}

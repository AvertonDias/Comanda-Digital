
'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Order, OrderStatus, Restaurant, SplitPaymentPart, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ChefHat, Bike, ShoppingBag, Trash2, QrCode, Copy, Check, Users, Minus, Plus, Wallet, CreditCard, Banknote, ListChecks, DollarSign, UserPlus, Search, ChevronLeft } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, updateDoc, arrayUnion, increment, query, collection, orderBy, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { MenuItemSelectionDialog } from "./menu-item-selection-dialog";

type OrderDetailsModalProps = {
    order: Order | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onStatusChange: (orderIds: string | string[], newStatus: OrderStatus, extraData?: any) => void;
};

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Aberto', color: 'bg-blue-500' },
    'preparando': { title: 'Em Preparação', color: 'bg-yellow-500' },
    'pronto': { title: 'Pronto', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizado', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelado', color: 'bg-red-500' },
};

const PAYMENT_METHODS = [
    { id: 'pix', label: 'Pix', icon: QrCode },
    { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
    { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
];

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

    // Estados de Controle Geral
    const [lastOpenedOrderId, setLastOpenedOrderId] = useState<string | null>(null);
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Estados para Divisão de Conta
    const [isSplitting, setIsSplitting] = useState(false);
    const [splitMode, setSplitMode] = useState<'value' | 'items'>('value');
    const [peopleCount, setPeopleCount] = useState(2);
    const [paidPartsCount, setPaidPartsCount] = useState(0);
    const [accumulatedPaid, setAccumulatedPaid] = useState(0);
    const [currentPartAmount, setCurrentPartAmount] = useState<number>(0);
    const [recordedSplitParts, setRecordedSplitParts] = useState<SplitPaymentPart[]>([]);
    
    // Controle de Itens Pendentes
    const [itemsBalance, setItemsBalance] = useState<any[]>([]);
    const [selectedItemsForPart, setSelectedItemsForPart] = useState<Record<number, number>>({});

    // Estados para Adicionar Mais Itens
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState<string | null>(null);
    const [selectedItemToAdd, setSelectedItemToAdd] = useState<MenuItem | null>(null);

    // BUSCA DE PEDIDOS RELACIONADOS (AGRUPAMENTO POR MESA)
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
        // Garante que o pedido atual está na lista e evita duplicatas
        const list = [...relatedOrders];
        if (!list.some(o => o.id === order.id)) list.push(order);
        return list;
    }, [relatedOrders, order]);

    const combinedTotal = useMemo(() => {
        return allGroupedOrders.reduce((acc, curr) => acc + curr.total, 0);
    }, [allGroupedOrders]);

    const combinedItems = useMemo(() => {
        return allGroupedOrders.flatMap(o => o.items);
    }, [allGroupedOrders]);

    const restaurantRef = useMemoFirebase(() => order?.restaurantId ? doc(firestore, 'restaurants', order.restaurantId) : null, [firestore, order?.restaurantId]);
    const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

    // Queries para o Menu Extra
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

    // Resetar estados apenas quando abrir um novo pedido
    useEffect(() => {
        if (isOpen && order && order.id !== lastOpenedOrderId) {
            setLastOpenedOrderId(order.id);
            setNotifyWhatsApp(true);
            setPaymentMethod(null);
            setCopied(false);
            setIsSplitting(false);
            setSplitMode('value');
            setPeopleCount(2);
            setPaidPartsCount(0);
            setAccumulatedPaid(0);
            setRecordedSplitParts([]);
            setSelectedItemsForPart({});
        }
    }, [isOpen, order, lastOpenedOrderId]);

    // Atualiza balanço de itens quando os pedidos agrupados mudarem
    useEffect(() => {
        if (isOpen) {
            setItemsBalance(combinedItems.map((item, idx) => ({ ...item, originalIndex: idx, remainingQty: item.quantity })));
        }
    }, [combinedItems, isOpen]);

    // Resetar seletor de categoria quando o menu extra abrir/fechar
    useEffect(() => {
        if (!isMenuOpen) {
            setSelectedMenuCategoryId(null);
        }
    }, [isMenuOpen]);

    // Calcula valor automático baseado nos itens selecionados
    useEffect(() => {
        if (splitMode === 'items') {
            let total = 0;
            Object.entries(selectedItemsForPart).forEach(([idx, qty]) => {
                const item = itemsBalance[Number(idx)];
                if (item) total += item.priceAtOrder * qty;
            });
            setCurrentPartAmount(Number(total.toFixed(2)));
        }
    }, [selectedItemsForPart, splitMode, itemsBalance]);

    // Sugere valor por pessoa no modo Valor
    useEffect(() => {
        if (isSplitting && splitMode === 'value' && remainingBalance > 0) {
            const suggested = paidPartsCount < peopleCount - 1 ? combinedTotal / peopleCount : remainingBalance;
            setCurrentPartAmount(Number(suggested.toFixed(2)));
        }
    }, [isSplitting, splitMode, remainingBalance, combinedTotal, peopleCount, paidPartsCount]);

    const txidLabel = isSplitting ? `PEDIDO${order?.orderNumber}P${paidPartsCount + 1}` : `PEDIDO${order?.orderNumber}`;
    const pixPayload = useMemo(() => {
        const amountToPay = isSplitting ? currentPartAmount : (combinedTotal || 0);
        if (paymentMethod === 'pix' && restaurant?.pixKey && amountToPay > 0) {
            return generatePixPayload(restaurant.pixKey, amountToPay, restaurant.name || 'Restaurante', txidLabel);
        }
        return null;
    }, [paymentMethod, restaurant, currentPartAmount, combinedTotal, isSplitting, txidLabel]);

    const qrCodeUrl = pixPayload ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}` : null;

    if (!order) return null;

    const displayOrderNumber = order.orderNumber?.toString().padStart(3, '0') || '000';
    const isGrouped = allGroupedOrders.length > 1;
    const isFinalizing = order.status === 'pronto' || (isGrouped && allGroupedOrders.some(o => o.status === 'pronto'));
    const isFullyPaid = accumulatedPaid >= (combinedTotal || 0) - 0.05;

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

    const handleSetFraction = (index: number, divisor: number) => {
        if (divisor <= 0) return;
        const item = itemsBalance[index];
        const val = Number((item.remainingQty / divisor).toFixed(2));
        setSelectedItemsForPart(prev => ({ ...prev, [index]: val }));
    };

    const handleConfirmAddExtra = async (data: { item: MenuItem; quantity: number; addons: any[]; notes: string; totalPrice: number }) => {
        const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, order.id);
        
        const newItem = {
            menuItemId: data.item.id,
            name: data.item.name,
            quantity: data.quantity,
            priceAtOrder: data.item.price,
            notes: data.notes || null,
            status: 'pendente',
            printSectorId: data.item.printSectorId,
            addons: data.addons?.map(a => ({ name: a.name, price: a.price })) || []
        };

        const addonsTotal = data.addons?.reduce((acc, curr) => acc + curr.price, 0) || 0;
        const itemTotal = (data.item.price + addonsTotal) * data.quantity;

        try {
            await updateDoc(orderRef, {
                items: arrayUnion(newItem),
                total: increment(itemTotal)
            });
            toast({ title: "Item adicionado com sucesso!" });
            setSelectedItemToAdd(null);
            setIsMenuOpen(false);
        } catch (e) {
            toast({ variant: "destructive", title: "Erro ao adicionar item" });
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-md flex flex-col p-0 overflow-hidden border-none sm:border">
                    <DialogHeader className="p-6 pb-0 flex flex-row items-center gap-2 space-y-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => onOpenChange(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <DialogTitle className="font-black uppercase tracking-tight text-xl">
                                {isGrouped ? `Comanda ${order.tableName || 'Mesa'}` : `Pedido #${displayOrderNumber}`}
                            </DialogTitle>
                            {isGrouped && (
                                <span className="text-[9px] font-black text-primary uppercase">
                                    Agrupando {allGroupedOrders.length} pedidos ativos
                                </span>
                            )}
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-6">
                            {/* INFO STATUS */}
                            {!isSplitting && (
                                <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase">
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground">Status Geral</span>
                                        <Badge className={`${STATUS_CONFIG[order.status].color} text-white w-full justify-center h-6`}>
                                            {isGrouped ? 'Múltiplos' : STATUS_CONFIG[order.status].title}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground">Valor Acumulado</span>
                                        <div className="bg-primary/10 h-6 flex items-center justify-center rounded-full text-primary">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isFinalizing && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <Separator />
                                    
                                    {/* CABEÇALHO DE DIVISÃO */}
                                    <div className="flex items-center justify-between">
                                        <p className="font-black text-[10px] uppercase text-primary flex items-center gap-2">
                                            <Users className="h-3 w-3" /> Divisão de Conta
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Dividir?</span>
                                            <Switch checked={isSplitting} onCheckedChange={setIsSplitting} />
                                        </div>
                                    </div>

                                    {isSplitting ? (
                                        <div className="space-y-4">
                                            {/* SELETOR DE MODO DE DIVISÃO */}
                                            <div className="flex bg-muted/50 p-1 rounded-lg">
                                                <button 
                                                    onClick={() => setSplitMode('value')}
                                                    className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all", splitMode === 'value' ? "bg-background shadow-sm" : "opacity-50")}
                                                >
                                                    <DollarSign className="h-3 w-3" /> Valor
                                                </button>
                                                <button 
                                                    onClick={() => setSplitMode('items')}
                                                    className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all", splitMode === 'items' ? "bg-background shadow-sm" : "opacity-50")}
                                                >
                                                    <ListChecks className="h-3 w-3" /> Itens
                                                </button>
                                            </div>

                                            {/* CONTEÚDO DINÂMICO DA DIVISÃO */}
                                            {splitMode === 'items' ? (
                                                <div className="space-y-3 bg-muted/20 p-4 rounded-xl border-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Itens Pendentes</Label>
                                                        <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-primary" onClick={() => setIsMenuOpen(true)}>
                                                            <Plus className="h-3 w-3 mr-1" /> Add Item Extra
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {itemsBalance.map((item, idx) => item.remainingQty > 0 && (
                                                            <div key={idx} className="flex items-center justify-between bg-background p-3 rounded-lg border">
                                                                <div className="flex-1 min-w-0 pr-2">
                                                                    <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                                                                    <p className="text-[9px] text-muted-foreground font-bold">{item.remainingQty} restantes</p>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleItemQtyChange(idx, -1)}>
                                                                            <Minus className="h-3 w-3" />
                                                                        </Button>
                                                                        <span className="text-xs font-black min-w-[20px] text-center">
                                                                            {selectedItemsForPart[idx] || 0}
                                                                        </span>
                                                                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleItemQtyChange(idx, 1)}>
                                                                            <Plus className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 items-end w-full">
                                                                        <span className="text-[8px] font-black uppercase text-muted-foreground">Dividir por:</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <Input 
                                                                                type="number" 
                                                                                min="1"
                                                                                placeholder="Nº" 
                                                                                className="h-7 w-10 text-[10px] p-1 text-center font-black bg-muted/50 border-none shadow-none"
                                                                                onChange={(e) => {
                                                                                    const divisor = Number(e.target.value);
                                                                                    if (divisor > 0) handleSetFraction(idx, divisor);
                                                                                }}
                                                                            />
                                                                            <span className="text-[8px] font-black uppercase text-muted-foreground">Pessoas</span>
                                                                        </div>
                                                                    </div>
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
                                                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))} disabled={paidPartsCount > 0}>
                                                                <Minus className="h-3 w-3" />
                                                            </Button>
                                                            <span className="font-black text-sm">{peopleCount}</span>
                                                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPeopleCount(peopleCount + 1)} disabled={paidPartsCount > 0}>
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">Status</span>
                                                        <p className="text-sm font-black text-primary">{paidPartsCount} pagas</p>
                                                        <p className="text-[10px] font-bold text-destructive">Falta {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingBalance)}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {!isFullyPaid && (
                                                <div className="space-y-4 bg-muted/30 p-4 rounded-xl border-2 border-dashed">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase">Valor desta Parte (R$)</Label>
                                                        <div className="relative">
                                                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input 
                                                                type="number" 
                                                                step="0.01" 
                                                                value={currentPartAmount} 
                                                                onChange={e => setCurrentPartAmount(Number(e.target.value))}
                                                                className="pl-9 font-black text-lg h-12"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <Label className="text-[10px] font-black uppercase">Forma de Pagamento</Label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {PAYMENT_METHODS.map((method) => (
                                                                <button
                                                                    key={method.id}
                                                                    onClick={() => setPaymentMethod(method.id)}
                                                                    className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all", paymentMethod === method.id ? "border-primary bg-primary/5" : "border-muted bg-background")}
                                                                >
                                                                    <method.icon className="h-3 w-3" />
                                                                    <span className="text-[9px] font-black uppercase">{method.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {paymentMethod === 'pix' && qrCodeUrl && (
                                                        <div className="flex flex-col items-center gap-3 bg-white p-3 rounded-lg border">
                                                            <Image src={qrCodeUrl} alt="Pix" width={150} height={150} />
                                                            <Button variant="secondary" size="sm" className="w-full text-[9px] font-black h-8" onClick={() => { navigator.clipboard.writeText(pixPayload!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                                                                {copied ? "Copiado!" : "Copiar Pix"}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    <Button className="w-full h-10 font-black uppercase text-[10px] bg-black hover:bg-zinc-800" onClick={handleRegisterPart}>
                                                        Confirmar Parte {paidPartsCount + 1}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <p className="font-black text-[10px] uppercase text-primary flex items-center gap-2"><CreditCard className="h-3 w-3" /> Forma de Pagamento</p>
                                                <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase text-primary" onClick={() => setIsMenuOpen(true)}>
                                                    <Plus className="h-3 w-3 mr-1" /> Add Item Extra
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {PAYMENT_METHODS.map((method) => (
                                                    <button
                                                        key={method.id}
                                                        onClick={() => setPaymentMethod(method.id)}
                                                        className={cn("flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all", paymentMethod === method.id ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-background")}
                                                    >
                                                        <method.icon className={cn("h-4 w-4", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")} />
                                                        <span className={cn("text-[10px] font-black uppercase", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")}>{method.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            {paymentMethod === 'pix' && qrCodeUrl && (
                                                <div className="bg-muted/30 p-4 rounded-xl flex flex-col items-center gap-4">
                                                    <div className="bg-white p-4 rounded-lg shadow-sm border"><Image src={qrCodeUrl} alt="Pix" width={200} height={200} /></div>
                                                    <Button variant="secondary" className="w-full font-black uppercase text-[10px]" onClick={() => { navigator.clipboard.writeText(pixPayload!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                                                        {copied ? "Copiado!" : "Copiar Pix Copia e Cola"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* LISTA DE ITENS CONSOLIDADA */}
                            {!isSplitting && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="font-black text-[10px] uppercase text-muted-foreground">Itens da Sessão (Total Mesa)</p>
                                        {!isFinalizing && (
                                            <Button variant="outline" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => setIsMenuOpen(true)}>
                                                <Plus className="h-3 w-3 mr-1" /> Adicionar
                                            </Button>
                                        )}
                                    </div>
                                    <ul className="space-y-3">
                                        {combinedItems.map((item, idx) => (
                                            <li key={idx} className="flex justify-between items-start border-b border-dashed pb-2 last:border-0">
                                                <div className="flex items-start gap-3">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shrink-0">{item.quantity}x</span>
                                                    <div>
                                                        <p className="font-black text-xs uppercase">{item.name}</p>
                                                        {item.addons?.map((a, ai) => (<p key={ai} className="text-[9px] text-muted-foreground font-bold uppercase">+ {a.name}</p>))}
                                                    </div>
                                                </div>
                                                <span className="font-black text-xs">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceAtOrder * item.quantity)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-6 bg-muted/20 border-t mt-auto">
                        <div className="flex justify-between items-center text-lg font-black uppercase mb-4">
                            <span>Total Comanda</span>
                            <span className="text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(combinedTotal)}</span>
                        </div>

                        <DialogFooter className="flex-row gap-2">
                            {order.status === 'aberto' && (
                                <Button variant="destructive" className="flex-1 font-black uppercase text-[10px] h-11" onClick={() => onStatusChange(order.id, 'cancelado')}>
                                    <Trash2 className="mr-2 h-3 w-3"/> Cancelar
                                </Button>
                            )}
                            {order.status !== 'finalizado' && (
                                <Button 
                                    className="flex-[2] font-black uppercase text-[10px] h-11" 
                                    onClick={() => {
                                        if (isFinalizing && !isFullyPaid && isSplitting) return toast({ variant: "destructive", title: "Conta incompleta" });
                                        if (isFinalizing && !paymentMethod && !isSplitting) return toast({ variant: "destructive", title: "Selecione o pagamento" });
                                        
                                        const nextStatusMap: Record<OrderStatus, OrderStatus> = {
                                            'aberto': 'preparando',
                                            'preparando': 'pronto',
                                            'pronto': 'finalizado',
                                            'finalizado': 'finalizado',
                                            'cancelado': 'cancelado'
                                        };

                                        const finalData: any = isFinalizing ? { 
                                            paymentMethod: isSplitting ? 'multiplos' : paymentMethod,
                                            splitPayments: isSplitting ? recordedSplitParts : null
                                        } : {};

                                        // ENVIA TODOS OS IDS DOS PEDIDOS DA MESA PARA FINALIZAR EM LOTE
                                        const targetIds = isGrouped ? allGroupedOrders.map(o => o.id) : [order.id];
                                        onStatusChange(targetIds, nextStatusMap[order.status], finalData);
                                    }}
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

            {/* Menu para Adicionar Item Extra */}
            <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[80vh] sm:max-w-[450px] p-0 flex flex-col border-none sm:border overflow-hidden">
                    <DialogHeader className="p-4 border-b flex flex-row items-center gap-2 space-y-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsMenuOpen(false)}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <DialogTitle className="text-sm font-black uppercase">Adicionar Item Extra</DialogTitle>
                    </DialogHeader>

                    {/* SELETOR DE CATEGORIA */}
                    <div className="p-4 bg-muted/10 border-b space-y-3">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">1. Escolha a Categoria</Label>
                        <Select value={selectedMenuCategoryId || ""} onValueChange={setSelectedMenuCategoryId}>
                            <SelectTrigger className="h-12 border-2 bg-background font-bold text-xs uppercase shadow-sm">
                                <SelectValue placeholder="Selecione para ver os itens..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories?.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id} className="text-xs font-bold uppercase">
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* LISTAGEM DINÂMICA DE ITENS */}
                    <ScrollArea className="flex-1 p-4 bg-background">
                        {selectedMenuCategoryId ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest block mb-1">2. Selecione o Produto</Label>
                                {items?.filter(i => i.categoryId === selectedMenuCategoryId && i.isAvailable).map(item => (
                                    <Card 
                                        key={item.id} 
                                        className="p-3 flex items-center gap-4 cursor-pointer hover:border-primary border-2 transition-all active:scale-95 shadow-sm" 
                                        onClick={() => setSelectedItemToAdd(item)}
                                    >
                                        <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0 border shadow-inner">
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black uppercase truncate leading-none mb-1">{item.name}</p>
                                            <p className="text-xs font-black text-primary">R$ {item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <Plus className="h-4 w-4 text-primary" />
                                        </div>
                                    </Card>
                                ))}
                                {items?.filter(i => i.categoryId === selectedMenuCategoryId && i.isAvailable).length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                                        <ShoppingBag className="h-10 w-10 mb-2" />
                                        <p className="text-[10px] font-black uppercase">Nenhum item disponível nesta categoria</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4 opacity-30">
                                <Search className="h-12 w-12 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="text-[11px] font-black uppercase tracking-tight">Aguardando Categoria</p>
                                    <p className="text-[9px] font-bold uppercase text-muted-foreground leading-tight px-8">Selecione uma opção no menu acima para listar os produtos do cardápio</p>
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    
                    <div className="p-4 border-t bg-muted/10 flex flex-col gap-2">
                        <Button variant="ghost" className="w-full font-black uppercase text-[10px]" onClick={() => setIsMenuOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <MenuItemSelectionDialog 
                item={selectedItemToAdd}
                isOpen={!!selectedItemToAdd}
                onClose={() => setSelectedItemToAdd(null)}
                onConfirm={handleConfirmAddExtra}
            />
        </>
    );
}

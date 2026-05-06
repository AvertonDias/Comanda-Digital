
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
import type { Order, OrderStatus, Restaurant } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ChefHat, Bike, ShoppingBag, Trash2, MapPin, Phone, User, MessageCircle, CreditCard, Banknote, QrCode, Copy, Check, Users, Minus, Plus, Wallet } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

type OrderDetailsModalProps = {
    order: Order | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onStatusChange: (orderId: string, newStatus: OrderStatus, extraData?: any) => void;
};

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Aberto', color: 'bg-blue-500' },
    'preparando': { title: 'Em Preparação', color: 'bg-yellow-500' },
    'pronto': { title: 'Pronto', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizado', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelado', color: 'bg-red-500' },
};

const originText = {
    'mesa': 'Mesa',
    'balcao': 'Balcão',
    'whatsapp': 'WhatsApp',
    'telefone': 'Telefone',
};

const PAYMENT_METHODS = [
    { id: 'pix', label: 'Pix', icon: QrCode },
    { id: 'cartao_credito', label: 'Crédito', icon: CreditCard },
    { id: 'cartao_debito', label: 'Débito', icon: CreditCard },
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
];

function normalizeText(text: string) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .toUpperCase();
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

    const payload = [
        '000201',
        `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`,
        '52040000',
        '5303986',
        `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`,
        '5802BR',
        `59${merchantName.length.toString().padStart(2, '0')}${merchantName}`,
        `60${merchantCity.length.toString().padStart(2, '0')}${merchantCity}`,
        `62${txidTag.length.toString().padStart(2, '0')}${txidTag}`,
        '6304'
    ].join('');

    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= (payload.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    const crcResult = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    
    return payload + crcResult;
}

export function OrderDetailsModal({ order, isOpen, onOpenChange, onStatusChange }: OrderDetailsModalProps) {
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Estados para Divisão de Conta
    const [isSplitting, setIsSplitting] = useState(false);
    const [peopleCount, setPeopleCount] = useState(2);
    const [paidPartsCount, setPaidPartsCount] = useState(0);
    const [accumulatedPaid, setAccumulatedPaid] = useState(0);
    const [currentPartAmount, setCurrentPartAmount] = useState<number>(0);

    const firestore = useFirestore();
    const { toast } = useToast();

    const restaurantRef = useMemoFirebase(() => 
        order?.restaurantId ? doc(firestore, 'restaurants', order.restaurantId) : null,
        [firestore, order?.restaurantId]
    );
    const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

    const displayOrderNumber = order?.orderNumber 
        ? order.orderNumber.toString().padStart(3, '0') 
        : order?.id.slice(-4).toUpperCase() || '000';

    const remainingBalance = useMemo(() => {
        if (!order?.total) return 0;
        return Math.max(0, order.total - accumulatedPaid);
    }, [order?.total, accumulatedPaid]);

    // Ao mudar o modo de divisão ou o saldo, sugere um valor para a próxima parte
    useEffect(() => {
        if (isSplitting && remainingBalance > 0) {
            const suggested = paidPartsCount < peopleCount - 1 
                ? order!.total / peopleCount 
                : remainingBalance;
            setCurrentPartAmount(Number(suggested.toFixed(2)));
        }
    }, [isSplitting, remainingBalance, order, peopleCount, paidPartsCount]);

    const txidLabel = isSplitting ? `PEDIDO${displayOrderNumber}P${paidPartsCount + 1}` : `PEDIDO${displayOrderNumber}`;

    const pixPayload = useMemo(() => {
        const amountToPay = isSplitting ? currentPartAmount : (order?.total || 0);
        if (paymentMethod === 'pix' && restaurant?.pixKey && amountToPay > 0) {
            return generatePixPayload(restaurant.pixKey, amountToPay, restaurant.name || 'Restaurante', txidLabel);
        }
        return null;
    }, [paymentMethod, restaurant, currentPartAmount, order?.total, isSplitting, txidLabel]);

    const qrCodeUrl = useMemo(() => {
        if (pixPayload) {
            return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`;
        }
        return null;
    }, [pixPayload]);

    useEffect(() => {
        if (isOpen) {
            setNotifyWhatsApp(true);
            setPaymentMethod(null);
            setCopied(false);
            setIsSplitting(false);
            setPeopleCount(2);
            setPaidPartsCount(0);
            setAccumulatedPaid(0);
        }
    }, [isOpen]);

    if (!order) return null;

    const restaurantName = restaurant?.name || 'nosso estabelecimento';
    const currentStatus = order.status;
    const canCancel = currentStatus === 'aberto';
    
    const nextStatus: OrderStatus | null =
        currentStatus === 'aberto' ? 'preparando' :
        currentStatus === 'preparando' ? 'pronto' :
        currentStatus === 'pronto' ? 'finalizado' :
        null;

    const isFinalizing = nextStatus === 'finalizado';
    const isFullyPaid = accumulatedPaid >= (order?.total || 0) - 0.01;

    const nextStatusText =
        nextStatus === 'preparando' ? 'Marcar como "Em Preparação"' :
        nextStatus === 'pronto' ? 'Marcar como "Pronto"' :
        nextStatus === 'finalizado' ? 'Finalizar Pedido' :
        '';
        
    const nextStatusIcon =
        nextStatus === 'preparando' ? <ChefHat className="mr-2 h-4 w-4" /> :
        nextStatus === 'pronto' ? <ShoppingBag className="mr-2 h-4 w-4" /> :
        nextStatus === 'finalizado' ? <Bike className="mr-2 h-4 w-4" /> :
        null;

    const formattedDate = order.createdAt?.seconds 
        ? format(new Date(order.createdAt.seconds * 1000), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
        : 'Recentemente';

    const handleStatusUpdate = () => {
        if (!nextStatus) return;
        
        if (isFinalizing) {
            if (isSplitting && !isFullyPaid) {
                toast({ variant: "destructive", title: "Conta incompleta", description: "Registre todos os pagamentos antes de finalizar." });
                return;
            }
            if (!isSplitting && !paymentMethod) {
                toast({ variant: "destructive", title: "Forma de pagamento", description: "Selecione como o cliente pagou." });
                return;
            }
        }

        if (nextStatus === 'pronto' && notifyWhatsApp && order.customerPhone) {
            const cleanPhone = order.customerPhone.replace(/\D/g, '');
            const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
            const statusActionText = order.destination === 'entrega' ? 'já está A CAMINHO' : 'já está PRONTO';
            
            const message = encodeURIComponent(
                `Olá ${order.customerName || 'Cliente'}! 👋\n\nBoas notícias: Seu pedido #${displayOrderNumber} no *${restaurantName}* ${statusActionText}! 🚀\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}\n\nAgradecemos a preferência! ✨`
            );
            
            window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
        }

        onStatusChange(order.id, nextStatus, isFinalizing ? { paymentMethod: isSplitting ? 'multiplos' : paymentMethod } : {});
    };

    const handleRegisterPart = () => {
        if (!paymentMethod) {
            toast({ variant: "destructive", title: "Selecione o método de pagamento" });
            return;
        }
        if (currentPartAmount <= 0 || currentPartAmount > remainingBalance + 0.01) {
            toast({ variant: "destructive", title: "Valor inválido" });
            return;
        }

        setAccumulatedPaid(prev => prev + currentPartAmount);
        setPaidPartsCount(prev => prev + 1);
        setPaymentMethod(null);
        toast({ title: `Parte ${paidPartsCount + 1} registrada!`, description: `R$ ${currentPartAmount.toFixed(2)} recebidos via ${paymentMethod.toUpperCase()}` });
    };

    const handleCopyPix = () => {
        if (pixPayload) {
            navigator.clipboard.writeText(pixPayload);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "Pix Copia e Cola copiado!" });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-full w-full h-[100dvh] sm:h-auto sm:max-w-md flex flex-col p-0 overflow-hidden border-none sm:border">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="font-black uppercase tracking-tight text-xl">Pedido #{displayOrderNumber}</DialogTitle>
                    <DialogDescription className="font-bold uppercase text-[10px] text-primary">
                        {order.tableName || `Pedido de ${originText[order.origin]}`}
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase">
                            <div className="space-y-1">
                                <span className="text-muted-foreground">Status</span>
                                <Badge className={`${STATUS_CONFIG[order.status].color} hover:${STATUS_CONFIG[order.status].color} text-white w-full justify-center h-6`}>
                                    {STATUS_CONFIG[order.status].title}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <span className="text-muted-foreground">Horário</span>
                                <div className="bg-muted h-6 flex items-center justify-center rounded-full px-2">{formattedDate}</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="font-black text-[10px] uppercase text-muted-foreground">Itens do Pedido</p>
                            <ul className="space-y-3">
                                {order.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-start border-b border-dashed pb-2 last:border-0">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shrink-0">{item.quantity}x</span>
                                            <div>
                                                <p className="font-black text-xs uppercase">{item.name}</p>
                                                {item.addons?.map((a, ai) => (
                                                    <p key={ai} className="text-[9px] text-muted-foreground font-bold uppercase">+ {a.name}</p>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="font-black text-xs shrink-0">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceAtOrder * item.quantity)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {isFinalizing && (
                            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Status do Pagamento</span>
                                                <p className="text-sm font-black text-primary">
                                                    {paidPartsCount} de {peopleCount} pagos
                                                </p>
                                                <p className="text-[10px] font-bold text-destructive">Falta {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingBalance)}</p>
                                            </div>
                                        </div>

                                        {!isFullyPaid && (
                                            <div className="space-y-4 bg-muted/30 p-4 rounded-xl border-2 border-dashed">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase">Valor a pagar agora (R$)</Label>
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
                                                    <p className="text-[9px] text-muted-foreground font-bold uppercase italic">Você pode editar o valor desta parte livremente.</p>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-[10px] font-black uppercase">Forma desta parte</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {PAYMENT_METHODS.map((method) => (
                                                            <button
                                                                key={method.id}
                                                                onClick={() => setPaymentMethod(method.id)}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-left",
                                                                    paymentMethod === method.id ? "border-primary bg-primary/5" : "border-muted bg-background"
                                                                )}
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
                                                        <Button variant="secondary" size="sm" className="w-full text-[9px] font-black h-8" onClick={handleCopyPix}>
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
                                        <p className="font-black text-[10px] uppercase text-primary flex items-center gap-2">
                                            <CreditCard className="h-3 w-3" /> Forma de Pagamento
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {PAYMENT_METHODS.map((method) => (
                                                <button
                                                    key={method.id}
                                                    onClick={() => setPaymentMethod(method.id)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all text-left",
                                                        paymentMethod === method.id ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-background"
                                                    )}
                                                >
                                                    <method.icon className={cn("h-4 w-4", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")} />
                                                    <span className={cn("text-[10px] font-black uppercase", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")}>
                                                        {method.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        {paymentMethod === 'pix' && qrCodeUrl && (
                                            <div className="bg-muted/30 p-4 rounded-xl space-y-4 flex flex-col items-center">
                                                <div className="bg-white p-4 rounded-lg shadow-sm border">
                                                    <Image src={qrCodeUrl} alt="Pix QR Code" width={200} height={200} className="rounded" />
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <p className="text-[10px] font-black uppercase text-primary">QR Code Valor Total</p>
                                                    <p className="text-sm font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</p>
                                                </div>
                                                <Button variant="secondary" size="sm" className="w-full gap-2 font-black uppercase text-[10px] h-10" onClick={handleCopyPix}>
                                                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                    {copied ? "Copiado!" : "Copiar Pix Copia e Cola"}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-6 bg-muted/20 border-t mt-auto">
                    <div className="flex justify-between items-center text-lg font-black uppercase mb-4">
                        <span>Total Comanda</span>
                        <span className="text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</span>
                    </div>

                    {nextStatus === 'pronto' && order.customerPhone && (
                        <div className="flex items-center justify-between bg-background p-3 rounded-lg border-2 border-primary/20 mb-4">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-green-600" />
                                <Label htmlFor="wa-notify" className="text-[10px] font-black uppercase cursor-pointer">Avisar no WhatsApp</Label>
                            </div>
                            <Switch id="wa-notify" checked={notifyWhatsApp} onCheckedChange={setNotifyWhatsApp} />
                        </div>
                    )}
                    
                    <DialogFooter className="flex-row gap-2">
                        {canCancel && (
                            <Button variant="destructive" className="flex-1 font-black uppercase text-[10px] h-11" onClick={() => onStatusChange(order.id, 'cancelado')}>
                                <Trash2 className="mr-2 h-3 w-3"/>
                                Cancelar
                            </Button>
                        )}
                        {nextStatus && (
                            <Button 
                                className="flex-[2] font-black uppercase text-[10px] h-11" 
                                onClick={handleStatusUpdate}
                                disabled={isFinalizing && (isSplitting ? !isFullyPaid : !paymentMethod)}
                            >
                                {nextStatusIcon}
                                {nextStatusText}
                                <ArrowRight className="ml-auto h-3 w-3"/>
                            </Button>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

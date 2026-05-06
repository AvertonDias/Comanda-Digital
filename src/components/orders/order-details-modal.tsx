
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
import type { Order, OrderStatus } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ChefHat, Bike, ShoppingBag, Trash2, MapPin, Phone, User, MessageCircle, CreditCard, Banknote, QrCode } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

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

export function OrderDetailsModal({ order, isOpen, onOpenChange, onStatusChange }: OrderDetailsModalProps) {
    const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const firestore = useFirestore();

    const restaurantRef = useMemoFirebase(() => 
        order?.restaurantId ? doc(firestore, 'restaurants', order.restaurantId) : null,
        [firestore, order?.restaurantId]
    );
    const { data: restaurant } = useDoc(restaurantRef);

    useEffect(() => {
        if (isOpen) {
            setNotifyWhatsApp(true);
            setPaymentMethod(null);
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

    const displayOrderNumber = order.orderNumber 
        ? order.orderNumber.toString().padStart(3, '0') 
        : order.id.slice(-4).toUpperCase();

    const handleStatusUpdate = () => {
        if (!nextStatus) return;
        
        if (isFinalizing && !paymentMethod) return;

        if (nextStatus === 'pronto' && notifyWhatsApp && order.customerPhone) {
            const cleanPhone = order.customerPhone.replace(/\D/g, '');
            const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
            const statusActionText = order.destination === 'entrega' ? 'já está A CAMINHO' : 'já está PRONTO';
            
            const message = encodeURIComponent(
                `Olá ${order.customerName || 'Cliente'}! 👋\n\nBoas notícias: Seu pedido #${displayOrderNumber} no *${restaurantName}* ${statusActionText}! 🚀\n\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}\n\nAgradecemos a preferência! ✨`
            );
            
            window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
        }

        onStatusChange(order.id, nextStatus, isFinalizing ? { paymentMethod } : {});
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

                        {(order.customerName || order.customerPhone || order.deliveryAddress) && (
                            <div className="bg-primary/5 p-4 rounded-xl border-2 border-dashed border-primary/20 space-y-3">
                                <p className="text-[10px] font-black uppercase text-primary">Dados do Cliente</p>
                                {order.customerName && (
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase">
                                        <User className="h-3 w-3 text-primary" /> {order.customerName}
                                    </div>
                                )}
                                {order.customerPhone && (
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase">
                                        <Phone className="h-3 w-3 text-primary" /> {order.customerPhone}
                                    </div>
                                )}
                                {order.deliveryAddress && (
                                    <div className="flex items-start gap-2 text-xs font-bold uppercase">
                                        <MapPin className="h-3 w-3 text-primary mt-0.5 shrink-0" /> {order.deliveryAddress}
                                    </div>
                                )}
                            </div>
                        )}

                        <Separator />
                        
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
                                                {item.notes && <p className="text-[9px] text-primary italic font-bold mt-1">OBS: {item.notes}</p>}
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
                            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Separator />
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
                                                paymentMethod === method.id 
                                                    ? "border-primary bg-primary/5 shadow-sm" 
                                                    : "border-muted bg-background hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <method.icon className={cn("h-4 w-4", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")} />
                                            <span className={cn("text-[10px] font-black uppercase", paymentMethod === method.id ? "text-primary" : "text-muted-foreground")}>
                                                {method.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="p-6 bg-muted/20 border-t mt-auto">
                    <div className="flex justify-between items-center text-lg font-black uppercase mb-4">
                        <span>Total</span>
                        <span className="text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</span>
                    </div>

                    {nextStatus === 'pronto' && order.customerPhone && (
                        <div className="flex items-center justify-between bg-background p-3 rounded-lg border-2 border-primary/20 mb-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-green-600" />
                                <Label htmlFor="wa-notify" className="text-[10px] font-black uppercase cursor-pointer">Avisar cliente no WhatsApp</Label>
                            </div>
                            <Switch 
                                id="wa-notify" 
                                checked={notifyWhatsApp} 
                                onCheckedChange={setNotifyWhatsApp} 
                            />
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
                                disabled={isFinalizing && !paymentMethod}
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

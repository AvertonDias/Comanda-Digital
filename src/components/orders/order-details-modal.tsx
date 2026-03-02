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
import type { Order, OrderStatus } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ChefHat, Bike, ShoppingBag, Trash2 } from "lucide-react";

type OrderDetailsModalProps = {
    order: Order | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
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

const destinationText = {
    'local': 'Consumo no Local',
    'retirada': 'Para Retirada',
    'entrega': 'Para Entrega',
};

export function OrderDetailsModal({ order, isOpen, onOpenChange, onStatusChange }: OrderDetailsModalProps) {
    if (!order) return null;

    const currentStatus = order.status;
    const canCancel = currentStatus === 'aberto';
    const nextStatus: OrderStatus | null =
        currentStatus === 'aberto' ? 'preparando' :
        currentStatus === 'preparando' ? 'pronto' :
        currentStatus === 'pronto' ? 'finalizado' :
        null;

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


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Detalhes do Pedido #{order.id.slice(-4)}</DialogTitle>
                    <DialogDescription>
                        {order.tableName || `Pedido de ${originText[order.origin]}`}
                    </DialogDescription>
                </DialogHeader>
                <Separator />
                <div className="grid gap-4 py-4 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className={`${STATUS_CONFIG[order.status].color} hover:${STATUS_CONFIG[order.status].color} text-white`}>
                            {STATUS_CONFIG[order.status].title}
                        </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Horário</span>
                        <span>{format(new Date(order.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Origem / Destino</span>
                        <span className="font-medium text-right">{originText[order.origin]} / {destinationText[order.destination]}</span>
                    </div>
                </div>
                <Separator />
                <p className="font-medium text-sm">Itens do Pedido</p>
                <ScrollArea className="max-h-48 -mx-6 px-6">
                    <ul className="space-y-3 py-2 text-sm">
                        {order.items.map(item => (
                            <li key={item.id} className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{item.quantity}</span>
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                                    </div>
                                </div>
                                <span className="font-mono">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceAtOrder * item.quantity)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
                <Separator />
                <div className="flex justify-between items-center text-lg font-bold py-2">
                    <span>Total</span>
                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</span>
                </div>
                <DialogFooter className="sm:justify-between gap-2 pt-4">
                    {canCancel && (
                        <Button variant="destructive" className="sm:mr-auto" onClick={() => onStatusChange(order.id, 'cancelado')}>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Cancelar
                        </Button>
                    )}
                    {nextStatus && (
                        <Button className="w-full" onClick={() => onStatusChange(order.id, nextStatus)}>
                            {nextStatusIcon}
                            {nextStatusText}
                            <ArrowRight className="ml-auto h-4 w-4"/>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

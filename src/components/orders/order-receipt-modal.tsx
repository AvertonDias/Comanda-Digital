'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, CheckCircle2, MessageCircle } from "lucide-react";
import type { Order, Restaurant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

/**
 * Agrupa itens idênticos para o recibo.
 */
function consolidateItems(items: any[]) {
    if (!items) return [];
    const groups: Record<string, any> = {};
    items.forEach(item => {
        const addonsKey = item.addons?.map((a: any) => a.name).sort().join(',') || '';
        const key = `${item.menuItemId}-${addonsKey}-${item.notes || ''}`;
        if (groups[key]) {
            groups[key].quantity += item.quantity;
        } else {
            groups[key] = { ...item };
        }
    });
    return Object.values(groups);
}

export function OrderReceiptModal({ 
    order, 
    restaurant,
    pixPayload,
    isOpen, 
    onClose 
}: { 
    order: Order | null; 
    restaurant?: Restaurant | null;
    pixPayload?: string | null;
    isOpen: boolean; 
    onClose: () => void 
}) {
    const { toast } = useToast();

    if (!order) return null;

    const orderNum = order.orderNumber?.toString().padStart(3, '0') || order.id?.slice(-4).toUpperCase() || '---';
    const groupedItems = consolidateItems(order.items);
    const isFinished = order.status === 'finalizado';

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
            onClose(); 
        }, 150);
    };

    const getReceiptText = () => {
        let text = `
🧾 *${restaurant?.name || 'Recibo de Venda'}*
📌 Pedido #${orderNum}
📅 ${format(new Date(), "dd/MM/yy HH:mm")}
---
${groupedItems.map(i => {
    return `${i.quantity}x ${i.name} - R$ ${(i.priceAtOrder * i.quantity).toFixed(2)}`;
}).join('\n')}
---`;

        if (order.destination === 'entrega') {
            text += `\n📍 *ENTREGA:* ${order.deliveryAddress || 'Não informado'}`;
        }

        text += `
💰 *Total: R$ ${order.total.toFixed(2)}*
Status: ${isFinished ? 'CONCLUÍDO' : 'PENDENTE'}

Obrigado pela preferência!
        `.trim();
        return text;
    };

    const handleWhatsApp = () => {
        const text = getReceiptText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handleGenericShare = async () => {
        const text = getReceiptText();
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Recibo Pedido #${orderNum}`,
                    text: text,
                });
            } catch (err) {
                console.log('Compartilhamento cancelado', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(text);
                toast({ title: "Texto copiado!" });
            } catch (err) {
                toast({ variant: "destructive", title: "Erro ao copiar" });
            }
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md no-print border-none sm:border shadow-2xl">
                    <DialogHeader className="flex flex-col items-center gap-2">
                        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
                            {isFinished ? <CheckCircle2 className="h-10 w-10 text-green-600" /> : <Printer className="h-10 w-10 text-primary" />}
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase text-center tracking-tighter">
                            {isFinished ? 'Pedido Finalizado!' : 'Recibo do Pedido'}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground text-center font-medium">O que deseja fazer com o cupom do pedido #{orderNum}?</p>
                    </DialogHeader>

                    <div className="py-6 space-y-3">
                        <Button 
                            className="w-full h-14 justify-start gap-4 font-black uppercase text-xs border-2 bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all active:scale-95" 
                            onClick={handleWhatsApp}
                        >
                            <MessageCircle className="h-6 w-6" />
                            Enviar p/ WhatsApp
                        </Button>

                        <Button 
                            variant="outline" 
                            className="w-full h-14 justify-start gap-4 font-black uppercase text-xs border-2 border-primary/20 hover:bg-primary/5 hover:border-primary transition-all active:scale-95" 
                            onClick={handlePrint}
                        >
                            <Printer className="h-6 w-6 text-primary" />
                            Imprimir Cupom (80mm)
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            className="w-full h-14 justify-start gap-4 font-black uppercase text-xs border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-500 transition-all active:scale-95" 
                            onClick={handleGenericShare}
                        >
                            <Share2 className="h-6 w-6 text-blue-500" />
                            Outras Opções / Copiar
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" className="w-full font-black uppercase text-[10px] text-muted-foreground" onClick={onClose}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ÁREA DE IMPRESSÃO CLIENTE (RECIBO DETALHADO) */}
            <div id="print-receipt-area" className="hidden print:block bg-white text-black p-2 font-mono">
                <div className="text-center space-y-1 mb-4 border-b-2 border-black pb-2">
                    <h1 className="text-base font-bold uppercase">{restaurant?.name || 'RECIBO DE VENDA'}</h1>
                    {restaurant?.phone && <p className="text-[10px] font-bold">TEL: {restaurant.phone}</p>}
                    <p className="text-[9px] font-bold">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
                
                <div className="text-xs space-y-1 mb-4 font-bold">
                    <p className="text-xs font-black uppercase">PEDIDO: #{orderNum}</p>
                    
                    {/* Informações Específicas por Tipo */}
                    {order.destination === 'entrega' ? (
                        <div className="mt-2 p-1 border-2 border-black space-y-1">
                            <p className="bg-black text-white px-2 py-0.5 inline-block font-black text-xs">ENTREGA</p>
                            <p className="text-xs mt-1">CLIENTE: {order.customerName?.toUpperCase()}</p>
                            <p className="text-xs">TEL: {order.customerPhone}</p>
                            <p className="leading-tight text-xs border-t border-black pt-1 mt-1">ENDEREÇO: {order.deliveryAddress?.toUpperCase()}</p>
                        </div>
                    ) : order.destination === 'retirada' ? (
                        <div className="mt-2 p-1 border border-black space-y-1">
                            <p className="bg-black text-white px-1 inline-block">RETIRADA</p>
                            <p>CLIENTE: {order.customerName?.toUpperCase()}</p>
                            <p>TEL: {order.customerPhone}</p>
                        </div>
                    ) : order.origin === 'balcao' ? (
                        <div className="mt-2 p-1 border border-black space-y-1">
                            <p className="bg-black text-white px-1 inline-block">BALCÃO</p>
                            {order.customerName && <p>CLIENTE: {order.customerName?.toUpperCase()}</p>}
                        </div>
                    ) : (
                        <div className="mt-2 p-1 border border-black">
                            <p className="text-base font-black text-center">MESA: {order.tableName?.replace(/\D/g, '') || order.tableName || '---'}</p>
                        </div>
                    )}
                </div>

                <div className="border-t border-black border-dashed my-2" />

                <table className="w-full text-[9px] mb-4 font-bold">
                    <thead>
                        <tr className="border-b border-black border-dashed">
                            <th className="text-left py-1">DESCRIÇÃO</th>
                            <th className="text-right py-1">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedItems.map((item, idx) => {
                            return (
                                <tr key={idx} className="border-b border-gray-100 last:border-0">
                                    <td className="py-2 pr-2">
                                        <span className="font-bold">{item.quantity}x</span> 
                                        <span className="ml-1">{item.name.toUpperCase()}</span>
                                        {item.addons?.map((a: any, ai: number) => (
                                            <div key={ai} className="text-[8px] font-bold ml-2">+ {a.name.toUpperCase()}</div>
                                        ))}
                                    </td>
                                    <td className="text-right py-2 whitespace-nowrap">
                                        {(item.priceAtOrder * item.quantity).toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <div className="border-t border-black border-dashed my-2" />

                <div className="space-y-1 text-right">
                    {order.deliveryFee > 0 && (
                        <p className="text-[9px] font-bold">TAXA ENTREGA: R$ {order.deliveryFee.toFixed(2)}</p>
                    )}
                    <p className="text-base font-black">TOTAL: R$ {order.total.toFixed(2)}</p>
                </div>

                {!isFinished && pixPayload && (
                    <div className="mt-6 flex flex-col items-center border-t-2 border-black border-dashed pt-4">
                        <p className="text-[9px] font-black uppercase mb-2">Pague com Pix:</p>
                        <div className="bg-white p-2 border border-black">
                             <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`}
                                alt="Pix QR Code"
                                className="w-24 h-24"
                            />
                        </div>
                    </div>
                )}

                <div className="mt-8 text-center text-[8px] uppercase font-black space-y-1 border-t border-black pt-4">
                    <p>Obrigado pela preferência!</p>
                    <p>Sistema Comanda Digital</p>
                </div>
            </div>
        </>
    );
}

'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, CheckCircle2, MessageCircle, CreditCard, Wallet } from "lucide-react";
import type { Order, Restaurant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
    const hasSplits = order.splitPayments && order.splitPayments.length > 0;

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

        if (order.deliveryFee && order.deliveryFee > 0) {
            text += `\nTaxa Entrega: R$ ${order.deliveryFee.toFixed(2)}`;
        }

        text += `\n*TOTAL: R$ ${order.total.toFixed(2)}*`;

        if (hasSplits) {
            text += `\n\n*PAGAMENTOS:*`;
            order.splitPayments?.forEach(p => {
                text += `\n- Parte ${p.part}: R$ ${p.amount.toFixed(2)} (${p.method.toUpperCase()})`;
            });
        } else if (order.paymentMethod) {
            text += `\n\nPagamento: ${order.paymentMethod.toUpperCase()}`;
        }

        return text.trim();
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

            {/* ÁREA DE IMPRESSÃO CLIENTE (RECIBO FINAL DETALHADO) */}
            {isOpen && (
                <div id="print-receipt-area" className="hidden print:block bg-white text-black p-2 font-mono">
                    <div className="text-center space-y-1 mb-4 border-b-2 border-black pb-2">
                        <h1 className="text-base font-bold uppercase">{restaurant?.name || 'RECIBO DE VENDA'}</h1>
                        {restaurant?.phone && <p className="text-[10px] font-bold">TEL: {restaurant.phone}</p>}
                        <p className="text-[9px] font-bold">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    
                    <div className="text-xs space-y-1 mb-4 font-bold">
                        <p className="text-xs font-black uppercase">
                            {order.origin === 'mesa' ? `MESA: ${order.tableName?.replace(/\D/g, '') || order.tableName}` : `PEDIDO: #${orderNum}`}
                        </p>
                        {order.customerName && <p className="text-[10px] uppercase">CLIENTE: {order.customerName}</p>}
                    </div>

                    <div className="border-t border-black border-dashed my-2" />

                    <table className="w-full text-[9px] mb-4 font-bold">
                        <thead>
                            <tr className="border-b border-black border-dashed">
                                <th className="text-left py-1">DESCRIÇÃO</th>
                                <th className="text-right py-1">VALOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedItems.map((item, idx) => {
                                const itemTotal = (item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * item.quantity;
                                return (
                                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                                        <td className="py-2 pr-2">
                                            <span className="font-bold">{item.quantity}x</span> 
                                            <span className="ml-1">{item.name.toUpperCase()}</span>
                                            {item.addons?.map((a: any, ai: number) => (
                                                <div key={ai} className="text-[8px] font-bold ml-2 text-gray-700">+ {a.name.toUpperCase()}</div>
                                            ))}
                                            {item.notes && <div className="text-[8px] italic ml-2">* {item.notes.toUpperCase()}</div>}
                                        </td>
                                        <td className="text-right py-2 whitespace-nowrap">
                                            {itemTotal.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="border-t border-black border-dashed my-2" />

                    <div className="space-y-1 text-right">
                        <div className="flex justify-between text-[10px]">
                            <span>SUBTOTAL:</span>
                            <span>R$ {(order.total - (order.deliveryFee || 0)).toFixed(2)}</span>
                        </div>
                        {order.deliveryFee && order.deliveryFee > 0 && (
                            <div className="flex justify-between text-[10px]">
                                <span>TAXA ENTREGA:</span>
                                <span>R$ {order.deliveryFee.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-black border-t border-black pt-1 mt-1">
                            <span>TOTAL:</span>
                            <span>R$ {order.total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* SEÇÃO DE PAGAMENTO / DIVISÃO */}
                    <div className="mt-4 pt-2 border-t-2 border-black border-double">
                        <h2 className="text-[10px] font-black uppercase mb-2 text-center">Informaçōes de Pagamento</h2>
                        
                        {hasSplits ? (
                            <div className="space-y-1">
                                {order.splitPayments?.map((p, idx) => (
                                    <div key={idx} className="flex justify-between text-[9px] font-bold">
                                        <span>PARTE {p.part} ({p.method.toUpperCase()}):</span>
                                        <span>R$ {p.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="text-center mt-2 bg-black text-white py-1 font-black text-[9px] uppercase">
                                    CONTA DIVIDIDA EM {order.splitPayments?.length} PARTES
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between text-[10px] font-bold">
                                <span>MÉTODO:</span>
                                <span>{(order.paymentMethod || 'A DEFINIR').toUpperCase()}</span>
                            </div>
                        )}
                    </div>

                    {!isFinished && pixPayload && (
                        <div className="mt-6 flex flex-col items-center border-t-2 border-black border-dashed pt-4">
                            <p className="text-[9px] font-black uppercase mb-2">Pague com Pix aqui:</p>
                            <div className="bg-white p-2 border border-black">
                                 <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`}
                                    alt="Pix QR Code"
                                    className="w-28 h-28"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

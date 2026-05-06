
'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, CheckCircle2, X, ReceiptText } from "lucide-react";
import type { Order, Restaurant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "../ui/separator";

export function OrderReceiptModal({ 
    order, 
    restaurant,
    isOpen, 
    onClose 
}: { 
    order: Order | null; 
    restaurant?: Restaurant | null;
    isOpen: boolean; 
    onClose: () => void 
}) {
    const { toast } = useToast();
    if (!order) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleShare = async () => {
        const orderNum = order.orderNumber?.toString().padStart(3, '0') || order.id.slice(-4).toUpperCase();
        const text = `
🧾 *${restaurant?.name || 'Recibo'}*
📌 Pedido #${orderNum}
📅 ${format(new Date(), "dd/MM/yy HH:mm")}
---
${order.items.map(i => `${i.quantity}x ${i.name} - R$ ${(i.priceAtOrder * i.quantity).toFixed(2)}`).join('\n')}
---
💰 *Total: R$ ${order.total.toFixed(2)}*
💳 Pagamento: ${order.paymentMethod?.toUpperCase() || 'N/A'}
        `.trim();

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Recibo Pedido #${orderNum}`,
                    text: text,
                });
            } catch (err) {
                // Erro ou cancelamento
            }
        } else {
            navigator.clipboard.writeText(text);
            toast({ title: "Texto copiado!", description: "O resumo do recibo foi copiado para sua área de transferência." });
        }
    };

    const orderNum = order.orderNumber?.toString().padStart(3, '0') || order.id.slice(-4).toUpperCase();

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md no-print">
                    <DialogHeader className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <DialogTitle className="text-xl font-black uppercase text-center">Pedido Finalizado!</DialogTitle>
                        <p className="text-sm text-muted-foreground text-center">Deseja emitir o recibo do pedido #{orderNum}?</p>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        <Button variant="outline" className="w-full h-14 justify-start gap-4 font-bold uppercase text-xs border-2 hover:bg-primary/5 hover:border-primary transition-all" onClick={handlePrint}>
                            <Printer className="h-5 w-5 text-primary" />
                            Imprimir Recibo
                        </Button>
                        <Button variant="outline" className="w-full h-14 justify-start gap-4 font-bold uppercase text-xs border-2 hover:bg-blue-50 hover:border-blue-500 transition-all" onClick={handleShare}>
                            <Share2 className="h-5 w-5 text-blue-500" />
                            Compartilhar Resumo
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" className="w-full font-bold uppercase text-[10px]" onClick={onClose}>
                            <X className="mr-2 h-3 w-3" />
                            Fechar sem emitir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ÁREA DE IMPRESSÃO (ESCONDIDA NA TELA) */}
            <div id="print-receipt-area" className="hidden print:block">
                <div className="text-center space-y-2 mb-6">
                    <h1 className="text-xl font-bold uppercase">{restaurant?.name || 'RECIBO DE VENDA'}</h1>
                    {restaurant?.phone && <p className="text-sm">Tel: {restaurant.phone}</p>}
                    <p className="text-xs">{format(new Date(), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>

                <Separator className="border-black border-dashed mb-4" />
                
                <div className="space-y-1 mb-4">
                    <p className="font-bold">PEDIDO: #{orderNum}</p>
                    {order.tableName && <p>MESA: {order.tableName}</p>}
                    {order.customerName && <p>CLIENTE: {order.customerName}</p>}
                </div>

                <Separator className="border-black border-dashed mb-4" />

                <table className="w-full text-sm mb-4">
                    <thead>
                        <tr className="border-b border-black border-dashed">
                            <th className="text-left py-1">ITEM</th>
                            <th className="text-right py-1">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="py-1">
                                    {item.quantity}x {item.name}
                                    {item.addons?.map((a, ai) => (
                                        <div key={ai} className="text-[10px] ml-2">+ {a.name}</div>
                                    ))}
                                </td>
                                <td className="text-right py-1">
                                    R$ {(item.priceAtOrder * item.quantity).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <Separator className="border-black border-dashed mb-4" />

                <div className="space-y-1 text-right">
                    <p className="text-lg font-bold">TOTAL: R$ {order.total.toFixed(2)}</p>
                    <p className="text-xs uppercase">PAGAMENTO: {order.paymentMethod || 'N/A'}</p>
                </div>

                <div className="mt-10 text-center text-[10px] uppercase">
                    <p>Obrigado pela preferência!</p>
                    <p>Volte sempre</p>
                </div>
            </div>
        </>
    );
}

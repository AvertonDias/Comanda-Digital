'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, CheckCircle2, X, MessageCircle, Info, MapPin, Phone, User } from "lucide-react";
import type { Order, Restaurant, MenuItem, MenuItemCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "../ui/badge";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";

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
    const firestore = useFirestore();
    const { toast } = useToast();

    const categoriesQuery = useMemoFirebase(() => {
        if (!order?.restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${order.restaurantId}/menuItemCategories`));
    }, [order?.restaurantId, firestore]);

    const itemsQuery = useMemoFirebase(() => {
        if (!order?.restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${order.restaurantId}/menuItems`));
    }, [order?.restaurantId, firestore]);

    const { data: categories } = useCollection<MenuItemCategory>(categoriesQuery);
    const { data: menuItems } = useCollection<MenuItem>(itemsQuery);

    if (!order) return null;

    const getCategoryName = (menuItemId: string) => {
        const menuItem = menuItems?.find(i => i.id === menuItemId);
        if (!menuItem) return '';
        const category = categories?.find(c => c.id === menuItem.categoryId);
        return category?.name || '';
    };

    const orderNum = order.orderNumber?.toString().padStart(3, '0') || order.id?.slice(-4).toUpperCase() || '---';
    const groupedItems = consolidateItems(order.items);
    const isFinished = order.status === 'finalizado';

    const getReceiptText = () => {
        let text = `
🧾 *${restaurant?.name || 'Recibo de Venda'}*
📌 Pedido #${orderNum}
📅 ${format(new Date(), "dd/MM/yy HH:mm")}
---
${groupedItems.map(i => {
    const cat = getCategoryName(i.menuItemId);
    return `${i.quantity}x [${cat.toUpperCase()}] ${i.name} - R$ ${(i.priceAtOrder * i.quantity).toFixed(2)}`;
}).join('\n')}
---`;

        if (order.destination === 'entrega') {
            text += `\n📍 *ENTREGA:* ${order.deliveryAddress || 'Não informado'}`;
        }

        if (order.splitPayments && order.splitPayments.length > 0) {
            text += `\n📊 *RESUMO DA DIVISÃO:*`;
            order.splitPayments.forEach(p => {
                text += `\n👤 *Parte ${p.part}: R$ ${p.amount.toFixed(2)}* (${p.method.toUpperCase()})`;
            });
            text += `\n---`;
        }

        text += `
💰 *Total: R$ ${order.total.toFixed(2)}*
💳 Status: ${order.paymentMethod?.toUpperCase() || (isFinished ? 'PAGO' : 'PAGAMENTO PENDENTE')}

Obrigado pela preferência!
        `.trim();
        return text;
    };

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
            onClose(); 
        }, 150);
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
                console.log('Compartilhamento cancelado ou falhou', err);
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
                        <div className="mt-2 p-1 border border-black space-y-1">
                            <p className="bg-black text-white px-1 inline-block">MÉTODO: ENTREGA</p>
                            <p>CLIENTE: {order.customerName?.toUpperCase()}</p>
                            <p>TEL: {order.customerPhone}</p>
                            <p className="leading-tight">ENDEREÇO: {order.deliveryAddress?.toUpperCase()}</p>
                        </div>
                    ) : order.destination === 'retirada' ? (
                        <div className="mt-2 p-1 border border-black space-y-1">
                            <p className="bg-black text-white px-1 inline-block">MÉTODO: RETIRADA</p>
                            <p>CLIENTE: {order.customerName?.toUpperCase()}</p>
                            <p>TEL: {order.customerPhone}</p>
                        </div>
                    ) : order.origin === 'balcao' ? (
                        <div className="mt-2 p-1 border border-black space-y-1">
                            <p className="bg-black text-white px-1 inline-block">MÉTODO: BALCÃO</p>
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
                        {groupedItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 pr-2">
                                    <span className="font-bold">{item.quantity}x</span> 
                                    {item.name.toUpperCase()}
                                    {item.addons?.map((a: any, ai: number) => (
                                        <div key={ai} className="text-[8px] font-bold ml-2">+ {a.name.toUpperCase()}</div>
                                    ))}
                                </td>
                                <td className="text-right py-2 whitespace-nowrap">
                                    {(item.priceAtOrder * item.quantity).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="border-t border-black border-dashed my-2" />

                <div className="space-y-1 text-right">
                    {order.deliveryFee > 0 && (
                        <p className="text-[9px] font-bold">TAXA ENTREGA: R$ {order.deliveryFee.toFixed(2)}</p>
                    )}
                    <p className="text-base font-black">TOTAL: R$ {order.total.toFixed(2)}</p>
                    <p className="text-[10px] uppercase font-bold bg-gray-100 p-1 inline-block">
                        PAGAMENTO: {order.paymentMethod?.toUpperCase() || (isFinished ? 'PAGO' : 'PENDENTE')}
                    </p>
                </div>

                {order.splitPayments && order.splitPayments.length > 0 && (
                    <div className="mt-4 border-t border-black border-dashed pt-2">
                        <p className="text-[8px] font-black uppercase mb-1">DETALHES DA DIVISÃO:</p>
                        {order.splitPayments.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-[8px] font-bold border-l-2 border-black pl-1 mb-1">
                                <span>PARTE {p.part} ({p.method.toUpperCase()}):</span>
                                <span>R$ {p.amount.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {!isFinished && pixPayload && (
                    <div className="mt-6 flex flex-col items-center border-t-2 border-black border-dashed pt-4">
                        <p className="text-[9px] font-black uppercase mb-2">Pague com Pix:</p>
                        <div className="bg-white p-2">
                             <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixPayload)}`}
                                alt="Pix QR Code"
                                className="w-24 h-24"
                            />
                        </div>
                        <p className="text-[7px] mt-2 max-w-[180px] text-center break-all font-bold">CHAVE: {restaurant?.pixKey}</p>
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
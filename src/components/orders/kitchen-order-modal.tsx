
'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ChefHat, MapPin, Clock } from "lucide-react";
import type { Restaurant, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, doc, updateDoc } from "firebase/firestore";

export function KitchenOrderModal({ 
    order, 
    restaurant,
    isOpen, 
    onClose 
}: { 
    order: any | null; 
    restaurant?: Restaurant | null;
    isOpen: boolean; 
    onClose: () => void 
}) {
    const firestore = useFirestore();

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

    const orderNum = order.orderNumber?.toString().padStart(3, '0') || '---';
    const isDelivery = order.destination === 'entrega';
    const isTakeaway = order.destination === 'retirada';
    const isCounter = order.origin === 'balcao' && order.destination === 'local';

    const handlePrint = async () => {
        // Marca o pedido como impresso no banco de dados para parar de piscar
        if (order.id && order.restaurantId) {
            // Se for um ID composto (agrupado), precisamos tratar ou marcar apenas o principal
            // No caso de grupos, o KanbanBoard já trata isso, mas garantimos aqui também.
            const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, order.id);
            await updateDoc(orderRef, { isPrinted: true }).catch(() => {});
        }

        // Pequeno delay para garantir que o DOM de impressão esteja pronto
        setTimeout(() => {
            window.print();
            onClose();
        }, 150);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md no-print border-none sm:border shadow-2xl">
                    <DialogHeader className="flex flex-col items-center gap-2">
                        <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center animate-pulse">
                            <ChefHat className="h-10 w-10 text-orange-600" />
                        </div>
                        <DialogTitle className="text-2xl font-black uppercase text-center tracking-tighter">
                            Enviar para Produção?
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground text-center font-medium">
                            O pedido #{orderNum} da {order.tableName || 'Mesa'} foi registrado.
                        </p>
                    </DialogHeader>

                    <div className="py-6 space-y-3">
                        <Button 
                            className="w-full h-16 justify-center gap-4 font-black uppercase text-lg border-2 bg-black hover:bg-zinc-800 text-white shadow-lg transition-all active:scale-95" 
                            onClick={handlePrint}
                        >
                            <Printer className="h-6 w-6" />
                            Imprimir para Cozinha
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="w-full font-black uppercase text-[10px] text-muted-foreground" 
                            onClick={onClose}
                        >
                            Apenas Salvar (Sem Imprimir)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ÁREA DE IMPRESSÃO DA COZINHA (VISÍVEL APENAS NA IMPRESSORA) */}
            <div id="print-receipt-area" className="hidden print:block bg-white text-black p-2">
                <div className="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 className="text-4xl font-black uppercase leading-none">
                        {order.tableName || (isDelivery ? 'ENTREGA' : isTakeaway ? 'RETIRADA' : isCounter ? 'BALCÃO' : 'PEDIDO')}
                    </h1>
                    <div className="flex justify-between items-center mt-2 px-1">
                        <span className="text-xl font-bold">ORDEM #{orderNum}</span>
                        <span className="text-sm font-bold">{format(new Date(), "HH:mm:ss")}</span>
                    </div>
                </div>

                {isDelivery && (
                    <div className="border-b-2 border-black pb-2 mb-2 space-y-1">
                        <p className="text-sm font-black uppercase">📍 ENTREGA:</p>
                        <p className="text-base font-bold leading-tight">{order.deliveryAddress}</p>
                        <p className="text-sm font-bold">CLI: {order.customerName} - {order.customerPhone}</p>
                    </div>
                )}

                <div className="space-y-4 pt-2">
                    <p className="text-xs font-black border-b border-black uppercase text-center">LISTA DE PRODUÇÃO</p>
                    {order.items?.map((item: any, idx: number) => {
                        const categoryName = getCategoryName(item.menuItemId);
                        return (
                            <div key={idx} className="border-b border-gray-300 pb-3">
                                <div className="flex items-start gap-3">
                                    <span className="text-3xl font-black shrink-0">{item.quantity}x</span>
                                    <div className="flex-1">
                                        <p className="text-xl font-black uppercase leading-tight">
                                            {categoryName && <span className="text-sm block opacity-70">[{categoryName.toUpperCase()}]</span>}
                                            {item.name}
                                        </p>
                                        
                                        {item.addons?.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                                {item.addons.map((a: any, ai: number) => (
                                                    <p key={ai} className="text-base font-bold uppercase">+ {a.name}</p>
                                                ))}
                                            </div>
                                        )}

                                        {item.notes && (
                                            <div className="mt-2 p-2 bg-gray-100 border-l-8 border-black">
                                                <p className="text-base font-black uppercase leading-tight italic">
                                                    ATENÇÃO: {item.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 border-t-2 border-black pt-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-bold">Início: {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="text-xs font-bold uppercase">Sistema Comanda Digital • Cozinha</p>
                </div>
            </div>
        </>
    );
}

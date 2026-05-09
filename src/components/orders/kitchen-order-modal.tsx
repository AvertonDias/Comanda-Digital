
'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ChefHat } from "lucide-react";
import type { Restaurant, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, doc, updateDoc } from "firebase/firestore";

export function KitchenOrderModal({ 
    order, 
    restaurant,
    isOpen, 
    onClose,
    orderIds // Recebe lista de IDs para marcar todos como impressos
}: { 
    order: any | null; 
    restaurant?: Restaurant | null;
    isOpen: boolean; 
    onClose: () => void;
    orderIds?: string[];
}) {
    const firestore = useFirestore();
    const { user } = useUser();

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

    const orderNum = order.orderNumber?.toString() || '---';
    const waiterName = user?.displayName || user?.email?.split('@')[0] || 'SISTEMA';

    const handlePrint = async () => {
        // Marca todos os pedidos do grupo como impressos
        const idsToUpdate = orderIds && orderIds.length > 0 ? orderIds : (order.id ? [order.id] : []);
        
        const promises = idsToUpdate.map(id => {
            const orderRef = doc(firestore, `restaurants/${order.restaurantId}/orders`, id);
            return updateDoc(orderRef, { isPrinted: true }).catch(() => {});
        });

        await Promise.all(promises);

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
                            O pedido #{orderNum.padStart(3, '0')} da {order.tableName || 'Mesa'} está pronto para a cozinha.
                        </p>
                    </DialogHeader>

                    <div className="py-6 space-y-3">
                        <Button 
                            className="w-full h-16 justify-center gap-4 font-black uppercase text-lg border-2 bg-black hover:bg-zinc-800 text-white shadow-lg transition-all active:scale-95" 
                            onClick={handlePrint}
                        >
                            <Printer className="h-6 w-6" />
                            Imprimir Comanda
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

            <div id="print-receipt-area" className="hidden print:block bg-white text-black font-mono">
                <div className="space-y-0.5 mb-2">
                    <div className="flex justify-between items-start font-bold">
                        <span className="text-base text-black">COMANDA No {orderNum}</span>
                        <span className="text-[10px] text-black">{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="text-sm font-bold uppercase text-black">MESA / COMANDA: {order.tableName || 'BALCAO'}</p>
                    <p className="text-xl font-black uppercase text-black">Local: {order.tableName?.replace(/\D/g, '') || order.tableName || '---'}</p>
                    <p className="text-sm font-bold uppercase text-black">GARÇOM: {waiterName.toUpperCase()}</p>
                </div>

                <div className="border-b border-black border-dashed my-2" />

                <div className="grid grid-cols-[2.5rem_1fr] font-bold text-xs mb-1 text-black">
                    <span>QTD</span>
                    <span>DESCRICAO</span>
                </div>

                <div className="space-y-2">
                    {order.items?.map((item: any, idx: number) => {
                        const categoryName = getCategoryName(item.menuItemId);
                        return (
                            <div key={idx} className="grid grid-cols-[2.5rem_1fr] items-start text-black">
                                <span className="text-lg font-black">{item.quantity}x</span>
                                <div className="space-y-0.5">
                                    <p className="text-base font-black uppercase leading-none">
                                        {categoryName ? `[${categoryName.toUpperCase()}] ` : ''}{item.name} [UN]
                                    </p>
                                    
                                    {item.addons?.length > 0 && (
                                        <div className="ml-1 space-y-0 text-xs font-bold uppercase">
                                            {item.addons.map((a: any, ai: number) => (
                                                <p key={ai}>+ {a.name}</p>
                                            ))}
                                        </div>
                                    )}

                                    {item.notes && (
                                        <div className="mt-1 p-1 bg-gray-100 border-l-4 border-black">
                                            <p className="text-xs font-black uppercase leading-tight italic">
                                                OBS: {item.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t border-black border-dashed my-3" />
                
                <div className="text-center text-[9px] font-bold uppercase text-black">
                    <p>Sistema Comanda Digital • Produção</p>
                </div>
            </div>
        </>
    );
}

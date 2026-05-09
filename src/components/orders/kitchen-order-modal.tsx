
'use client';
import type { Restaurant, MenuItem, MenuItemCategory } from "@/lib/types";
import { format } from "date-fns";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query } from "firebase/firestore";

/**
 * Componente que renderiza apenas a área de impressão para a cozinha.
 * Não possui interface visual (Dialog), servindo apenas para o comando window.print().
 */
export function KitchenOrderModal({ 
    order, 
    restaurant,
}: { 
    order: any | null; 
    restaurant?: Restaurant | null;
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

    return (
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
    );
}

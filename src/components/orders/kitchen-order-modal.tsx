
'use client';
import type { Restaurant, MenuItem, MenuItemCategory, Order } from "@/lib/types";
import { format } from "date-fns";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query } from "firebase/firestore";

/**
 * Componente que renderiza apenas a área de impressão para a cozinha.
 * Focado exclusivamente no preparo, sem informações financeiras.
 */
export function KitchenOrderModal({ 
    order, 
    restaurant,
}: { 
    order: Order | any | null; 
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

    // Identificação do tipo de pedido para a cozinha
    const getDestinationLabel = () => {
        if (order.destination === 'entrega') return 'DELIVERY / ENTREGA';
        if (order.destination === 'retirada') return 'RETIRADA';
        if (order.origin === 'balcao') return 'BALCÃO';
        return `MESA: ${order.tableName?.replace(/\D/g, '') || order.tableName || '---'}`;
    };

    return (
        <div id="print-receipt-area" className="hidden print:block bg-white text-black font-mono">
            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-xl font-black uppercase">ORDEM DE PRODUÇÃO</h1>
                <p className="text-sm font-bold">#{orderNum} • {format(new Date(), "dd/MM/yy HH:mm")}</p>
            </div>

            <div className="space-y-1 mb-3">
                <p className="text-lg font-black bg-black text-white px-2 py-1 text-center">
                    {getDestinationLabel()}
                </p>
                {order.customerName && (
                    <p className="text-sm font-bold uppercase">CLIENTE: {order.customerName}</p>
                )}
                <p className="text-[10px] font-bold uppercase">ATENDENTE: {waiterName.toUpperCase()}</p>
            </div>

            <div className="border-b border-black border-dashed my-2" />

            <div className="grid grid-cols-[3rem_1fr] font-bold text-xs mb-1">
                <span>QTD</span>
                <span>ITEM / ESPECIFICAÇÕES</span>
            </div>

            <div className="space-y-3">
                {order.items?.map((item: any, idx: number) => {
                    const categoryName = getCategoryName(item.menuItemId);
                    return (
                        <div key={idx} className="grid grid-cols-[3rem_1fr] items-start">
                            <span className="text-2xl font-black">{item.quantity}x</span>
                            <div className="space-y-1">
                                <p className="text-lg font-black uppercase leading-none">
                                    {item.name}
                                </p>
                                {categoryName && (
                                    <p className="text-[10px] font-bold text-gray-700">CATEGORIA: {categoryName.toUpperCase()}</p>
                                )}
                                
                                {item.addons?.length > 0 && (
                                    <div className="ml-1 space-y-0 text-xs font-bold uppercase">
                                        {item.addons.map((a: any, ai: number) => (
                                            <p key={ai}>[+] {a.name}</p>
                                        ))}
                                    </div>
                                )}

                                {item.notes && (
                                    <div className="mt-1 p-1 bg-gray-100 border-l-4 border-black">
                                        <p className="text-sm font-black uppercase leading-tight italic">
                                            OBS: {item.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="border-t-2 border-black border-dashed mt-6 pt-2">
                <p className="text-center text-[10px] font-black uppercase">
                    Fim da Comanda de Produção
                </p>
            </div>
        </div>
    );
}

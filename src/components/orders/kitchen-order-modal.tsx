
'use client';
import type { Restaurant, MenuItem, MenuItemCategory, Order } from "@/lib/types";
import { format } from "date-fns";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query } from "firebase/firestore";

/**
 * Componente que renderiza a comanda de produção customizada.
 * Otimizado para visualização clara na cozinha/balcão.
 */
export function KitchenOrderModal({ 
    order, 
    restaurant,
    pixPayload
}: { 
    order: Order | any | null; 
    restaurant?: Restaurant | null;
    pixPayload?: string | null;
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
        const category = categories?.find(c => c.id === menuItem?.categoryId);
        return category?.name || '';
    };

    const orderNum = order.orderNumber?.toString() || '---';
    const waiterName = user?.displayName || user?.email?.split('@')[0] || 'SISTEMA';

    const isDelivery = order.destination === 'entrega';

    return (
        <div id="print-receipt-area" className="hidden print:block bg-white text-black font-mono p-2">
            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-xl font-black uppercase">ORDEM DE PRODUÇÃO</h1>
                <p className="text-sm font-bold">#{orderNum} • {format(new Date(), "dd/MM/yy HH:mm")}</p>
            </div>

            {/* Banner de Identificação - Ajustado para garantir visibilidade do texto */}
            <div className="mb-3">
                <div className="border-4 border-black px-2 py-2 text-center mb-2">
                    <p className="text-2xl font-black uppercase">
                        {isDelivery ? 'ENTREGA' : order.destination === 'retirada' ? 'RETIRADA' : `MESA: ${order.tableName?.replace(/\D/g, '') || order.tableName}`}
                    </p>
                </div>
                
                {/* Dados de Entrega (Se for delivery) */}
                {isDelivery && (
                    <div className="border-2 border-black p-2 mb-2 space-y-1">
                        <p className="text-xs font-black uppercase">CLIENTE: {order.customerName}</p>
                        <p className="text-xs font-black uppercase">TEL: {order.customerPhone}</p>
                        <p className="text-xs font-black uppercase leading-tight">ENDEREÇO: {order.deliveryAddress}</p>
                    </div>
                )}

                {!isDelivery && order.customerName && (
                    <p className="text-sm font-bold uppercase">CLIENTE: {order.customerName}</p>
                )}
                <p className="text-[10px] font-bold uppercase">ATENDENTE: {waiterName.toUpperCase()}</p>
            </div>

            <div className="border-b border-black border-dashed my-2" />

            <div className="grid grid-cols-[2.5rem_1fr_5rem] font-bold text-[10px] mb-1">
                <span>QTD</span>
                <span>ITEM / CATEGORIA</span>
                <span className="text-right">VALOR</span>
            </div>

            <div className="space-y-3">
                {order.items?.map((item: any, idx: number) => {
                    const categoryName = getCategoryName(item.menuItemId);
                    const itemTotal = (item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * item.quantity;
                    
                    return (
                        <div key={idx} className="grid grid-cols-[2.5rem_1fr_5rem] items-start border-b border-gray-100 pb-1">
                            <span className="text-xl font-black">{item.quantity}x</span>
                            <div className="space-y-0.5">
                                <p className="text-sm font-black uppercase leading-tight">
                                    {categoryName && <span className="text-[10px] mr-1">[{categoryName.toUpperCase()}]</span>}
                                    {item.name}
                                </p>
                                
                                {item.addons?.length > 0 && (
                                    <div className="ml-1 text-[9px] font-bold uppercase text-gray-700">
                                        {item.addons.map((a: any, ai: number) => (
                                            <p key={ai}>+ {a.name}</p>
                                        ))}
                                    </div>
                                )}

                                {item.notes && (
                                    <div className="mt-1 p-1 bg-gray-50 border-l-2 border-black">
                                        <p className="text-[10px] font-bold uppercase leading-tight italic">
                                            OBS: {item.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <span className="text-right text-xs font-black">
                                {itemTotal.toFixed(2)}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="border-t-2 border-black border-dashed mt-4 pt-2 mb-4">
                <p className="text-center text-[10px] font-black uppercase">
                    Fim da Comanda de Produção
                </p>
            </div>

            {/* Seção Financeira */}
            <div className="space-y-1 text-right">
                {order.deliveryFee > 0 && (
                    <p className="text-xs font-bold uppercase">TAXA ENTREGA: R$ {order.deliveryFee.toFixed(2)}</p>
                )}
                <p className="text-xl font-black uppercase">TOTAL: R$ {order.total.toFixed(2)}</p>
            </div>

            {/* QR Code Pix (Abaixo do valor, conforme solicitado) */}
            {pixPayload && (
                <div className="mt-6 flex flex-col items-center border-t-2 border-black border-dashed pt-4">
                    <p className="text-[10px] font-black uppercase mb-2">PAGUE COM PIX:</p>
                    <div className="bg-white p-1 border-2 border-black">
                         <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(pixPayload)}`}
                            alt="Pix QR Code"
                            className="w-32 h-32"
                        />
                    </div>
                </div>
            )}

            <div className="mt-8 text-center text-[10px] uppercase font-black space-y-1 border-t border-black pt-4">
                <p>Obrigado pela preferência!</p>
                <p>Sistema Comanda Digital</p>
            </div>
        </div>
    );
}

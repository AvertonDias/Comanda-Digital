'use client';
import type { Restaurant, MenuItem, MenuItemCategory, Order } from "@/lib/types";
import { format } from "date-fns";
import { useUser } from "@/firebase";
import { cn } from "@/lib/utils";

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
    const { user } = useUser();

    if (!order) return null;

    const orderNum = order.orderNumber?.toString() || '---';
    const waiterName = user?.displayName || user?.email?.split('@')[0] || 'SISTEMA';

    const isDelivery = order.destination === 'entrega';
    const isTableOrder = order.origin === 'mesa' || !!order.tableId;

    return (
        <div id="print-receipt-area" className="hidden print:block bg-white text-black font-mono p-2">
            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-lg font-black uppercase tracking-tighter">ORDEM DE PRODUÇÃO</h1>
                <p className="text-xs font-bold">#{orderNum} • {format(new Date(), "dd/MM/yy HH:mm")}</p>
            </div>

            {/* Cabeçalho de Identificação */}
            <div className="mb-3">
                {isDelivery ? (
                    <div className="border-[4px] border-black p-2 text-center mb-3">
                        <p className="text-2xl font-black uppercase leading-none">MÉTODO: ENTREGA</p>
                    </div>
                ) : (
                    <div className="border-2 border-black px-2 py-2 text-center mb-2">
                        <p className="text-lg font-black uppercase">
                            {order.destination === 'retirada' ? 'RETIRADA' : isTableOrder ? `MESA: ${order.tableName?.replace(/\D/g, '') || order.tableName}` : 'BALCÃO'}
                        </p>
                    </div>
                )}
                
                {/* Dados do Cliente / Entrega */}
                {(order.customerName || order.customerPhone || isDelivery) && (
                    <div className="border-2 border-black p-2 mb-2 space-y-1">
                        {order.customerName && <p className="text-xs font-black uppercase">CLIENTE: {order.customerName}</p>}
                        {order.customerPhone && <p className="text-[10px] font-black uppercase">TEL: {order.customerPhone}</p>}
                        {isDelivery && order.deliveryAddress && (
                            <p className="text-[10px] font-black uppercase leading-tight mt-1 border-t border-black pt-1">
                                ENDEREÇO: {order.deliveryAddress}
                            </p>
                        )}
                    </div>
                )}

                <p className="text-[8px] font-bold uppercase">ATENDENTE: {waiterName.toUpperCase()}</p>
            </div>

            <div className="border-b border-black border-dashed my-2" />

            {/* Cabeçalho da Lista - OCULTAR VALOR APENAS PARA MESAS SE NÃO HOUVER EXTRA */}
            <div className={cn(
                "grid font-bold text-[8px] mb-1 px-1",
                isTableOrder ? "grid-cols-[2.5rem_1fr]" : "grid-cols-[2.5rem_1fr_4.5rem]"
            )}>
                <span>QTD</span>
                <span>DESCRIÇÃO</span>
                {!isTableOrder && <span className="text-right">VALOR</span>}
            </div>

            {/* Lista de Itens */}
            <div className="space-y-3">
                {order.items?.map((item: any, idx: number) => {
                    const itemTotal = (item.priceAtOrder + (item.ingredientExtrasPrice || 0)) * item.quantity;
                    
                    return (
                        <div key={idx} className={cn(
                            "grid items-start border-b border-gray-200 pb-2",
                            isTableOrder ? "grid-cols-[2.5rem_1fr]" : "grid-cols-[2.5rem_1fr_4.5rem]"
                        )}>
                            <span className="text-xl font-black leading-none">{item.quantity}x</span>
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase leading-tight">
                                    {item.name}
                                </p>
                                
                                {item.addons?.length > 0 && (
                                    <div className="ml-1 text-[8px] font-bold uppercase text-gray-800">
                                        {item.addons.map((a: any, ai: number) => (
                                            <p key={ai}>+ {a.name}</p>
                                        ))}
                                    </div>
                                )}

                                {item.ingredientExtrasPrice > 0 && (
                                    <p className="text-[8px] font-bold text-primary ml-1">+ EXTRA (+R$ {item.ingredientExtrasPrice.toFixed(2)})</p>
                                )}

                                {item.notes && (
                                    <div className="mt-1 p-1 bg-gray-50 border-l-2 border-black">
                                        <p className="text-[9px] font-bold uppercase leading-tight italic">
                                            OBS: {item.notes}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {!isTableOrder && (
                                <span className="text-right text-[10px] font-black">
                                    {itemTotal.toFixed(2)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Resumo Financeiro - OCULTAR PARA MESAS */}
            {!isTableOrder && (
                <div className="mt-4 border-t-2 border-black pt-2 space-y-1">
                    {order.deliveryFee > 0 && (
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                            <span>TAXA ENTREGA:</span>
                            <span>R$ {order.deliveryFee.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-lg font-black uppercase">
                        <span>TOTAL:</span>
                        <span>R$ {order.total.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {/* QR Code Pix - EXIBIR APENAS EM ENTREGAS E RETIRADAS */}
            {pixPayload && !isTableOrder && (
                <div className="mt-6 flex flex-col items-center border-t-2 border-black border-dashed pt-4">
                    <div className="bg-white p-2 border-2 border-black">
                         <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`}
                            alt="Pix QR Code"
                            className="w-32 h-32"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

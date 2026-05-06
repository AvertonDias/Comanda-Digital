
'use client';
import { useState, useMemo } from 'react';
import type { Order, OrderStatus, Restaurant } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { OrderDetailsModal } from './order-details-modal';
import { OrderReceiptModal } from './order-receipt-modal';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Abertos', color: 'bg-blue-500' },
    'preparando': { title: 'Preparando', color: 'bg-yellow-500' },
    'pronto': { title: 'Prontos', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizados', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelados', color: 'bg-red-500' },
};

const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];

const OrderCard = ({ order, onDetailsClick }: { order: Order, onDetailsClick: (order: Order) => void }) => {
    const displayOrderNumber = order.orderNumber 
        ? order.orderNumber.toString().padStart(3, '0') 
        : order.id.slice(-4).toUpperCase();

    return (
        <Card className="active:scale-[0.98] transition-transform shadow-sm hover:shadow-md">
            <CardHeader className='p-4 pb-2'>
                <CardTitle className="text-sm flex justify-between items-start gap-2">
                    <span className="font-black uppercase leading-tight flex-1">
                        {order.tableName || `Pedido #${displayOrderNumber}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">#{displayOrderNumber}</Badge>
                </CardTitle>
                <CardDescription className="text-[10px] flex items-center gap-1">
                    {order.createdAt?.seconds ? formatDistanceToNow(new Date(order.createdAt.seconds * 1000), { addSuffix: true, locale: ptBR }) : 'Agora'}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 py-2">
                <ul className="space-y-1 text-xs">
                    {order.items.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="flex justify-between items-center text-muted-foreground">
                            <span className="truncate">{item.quantity}x {item.name}</span>
                        </li>
                    ))}
                    {order.items.length > 3 && (
                        <li className="text-[10px] text-primary font-bold">+ {order.items.length - 3} itens</li>
                    )}
                </ul>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center">
                 <span className="text-base font-black">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                 </span>
                 <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={() => onDetailsClick(order)}>Ver</Button>
            </CardFooter>
        </Card>
    )
};

export function OrderKanbanBoard({ restaurantId, tableId }: { restaurantId: string, tableId?: string }) {
  const firestore = useFirestore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lastFinalizedOrder, setLastFinalizedOrder] = useState<Order | null>(null);

  const restaurantRef = useMemoFirebase(() => 
    restaurantId ? doc(firestore, 'restaurants', restaurantId) : null,
    [firestore, restaurantId]
  );
  const { data: restaurant } = useDoc<Restaurant>(restaurantRef);

  const ordersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    let q = collection(firestore, `restaurants/${restaurantId}/orders`);
    
    if (tableId) {
        return query(q, where('tableId', '==', tableId), orderBy('createdAt', 'desc'));
    }
    return query(q, orderBy('createdAt', 'desc'));
  }, [restaurantId, firestore, tableId]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  // AGRUPAMENTO: Transforma múltiplos pedidos da mesma mesa em um único cartão visual por status
  const groupedOrdersByStatus = useMemo(() => {
    const result: Record<OrderStatus, Order[]> = {
        'aberto': [],
        'preparando': [],
        'pronto': [],
        'finalizado': [],
        'cancelado': []
    };
    
    if (!orders) return result;

    statusesToShow.forEach(status => {
        const statusOrders = orders.filter(o => o.status === status);
        const groups: Record<string, Order> = {};
        
        statusOrders.forEach(order => {
            // Agrupa por tableId (se houver), senão mantém individual (pedidos avulsos)
            const key = order.tableId || order.id;
            
            if (!groups[key]) {
                groups[key] = { ...order };
            } else {
                // Consolida dados para exibição no cartão
                groups[key].total += order.total;
                groups[key].items = [...groups[key].items, ...order.items];
                
                // Mantém o número do pedido mais recente como referência
                if (order.orderNumber && (!groups[key].orderNumber || order.orderNumber > groups[key].orderNumber)) {
                    groups[key].orderNumber = order.orderNumber;
                }

                // Mantém a data do pedido mais antigo para mostrar há quanto tempo a mesa está ativa
                const currentCreated = groups[key].createdAt?.seconds || Infinity;
                const newCreated = order.createdAt?.seconds || Infinity;
                if (newCreated < currentCreated) {
                    groups[key].createdAt = order.createdAt;
                }
            }
        });
        
        result[status] = Object.values(groups);
    });

    return result;
  }, [orders]);

  const handleStatusChange = (orderIds: string | string[], newStatus: OrderStatus, extraData: any = {}) => {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    
    // Captura os dados para o recibo antes da atualização
    let mergedOrderForReceipt: any = null;
    if (newStatus === 'finalizado') {
        const selectedOrders = orders?.filter(o => ids.includes(o.id)) || [];
        if (selectedOrders.length > 0) {
            mergedOrderForReceipt = {
                ...selectedOrders[0],
                id: ids.join('_'),
                items: selectedOrders.flatMap(o => o.items),
                total: selectedOrders.reduce((acc, o) => acc + o.total, 0),
                status: 'finalizado',
                paymentMethod: extraData.paymentMethod,
                splitPayments: extraData.splitPayments,
                closedAt: serverTimestamp()
            };
        }
    }

    const batchPromises = ids.map(id => {
        const orderRef = doc(firestore, `restaurants/${restaurantId}/orders/${id}`);
        const updatePayload = { 
            status: newStatus, 
            ...extraData 
        };
        if (newStatus === 'finalizado') {
            updatePayload.closedAt = serverTimestamp();
        }
        return updateDoc(orderRef, updatePayload);
    });

    Promise.all(batchPromises).then(() => {
        if (newStatus === 'finalizado' && mergedOrderForReceipt) {
            setLastFinalizedOrder(mergedOrderForReceipt);
        }
    }).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `restaurants/${restaurantId}/orders`,
            operation: 'update',
        }));
    });
    
    setSelectedOrder(null);
  };

  const getOrdersCount = (status: OrderStatus) => {
    return groupedOrdersByStatus[status].length;
  }
  
  if (isLoading) return <Skeleton className="h-full w-full" />;

  return (
    <div className="flex flex-col h-full -mx-4 md:mx-0">
      <Tabs defaultValue={statusesToShow[0]} className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-none h-12 sticky top-0 z-10 px-4">
              {statusesToShow.map(status => (
                   <TabsTrigger key={status} value={status} className="flex items-center gap-1.5 data-[state=active]:bg-background text-[10px] uppercase font-bold tracking-tight">
                      {STATUS_CONFIG[status].title}
                      <Badge className={`${STATUS_CONFIG[status].color} hover:${STATUS_CONFIG[status].color} text-[8px] h-4 w-4 p-0 flex items-center justify-center text-white border-none`}>
                          {getOrdersCount(status)}
                      </Badge>
                   </TabsTrigger>
              ))}
          </TabsList>
          {statusesToShow.map(status => (
              <TabsContent key={status} value={status} className="mt-0 flex-1 min-h-0">
                   <ScrollArea className="h-full px-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 py-4">
                          {groupedOrdersByStatus[status].map(order => (
                              <OrderCard key={order.id} order={order} onDetailsClick={setSelectedOrder} />
                          ))}
                          {getOrdersCount(status) === 0 && (
                             <div className="col-span-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <p className="text-sm font-black uppercase">Nenhum pedido {status}</p>
                             </div>
                          )}
                      </div>
                   </ScrollArea>
              </TabsContent>
          ))}
      </Tabs>
      
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onOpenChange={(isOpen) => { if (!isOpen) setSelectedOrder(null) }}
        onStatusChange={handleStatusChange}
      />

      <OrderReceiptModal
        order={lastFinalizedOrder}
        restaurant={restaurant}
        isOpen={!!lastFinalizedOrder}
        onClose={() => setLastFinalizedOrder(null)}
      />
    </div>
  );
}

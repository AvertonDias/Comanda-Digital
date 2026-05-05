
'use client';
import { useState } from 'react';
import type { Order, OrderStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { OrderDetailsModal } from './order-details-modal';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Abertos', color: 'bg-blue-500' },
    'preparando': { title: 'Em Preparação', color: 'bg-yellow-500' },
    'pronto': { title: 'Pronto', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizados', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelados', color: 'bg-red-500' },
};

const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];

const OrderCard = ({ order, onDetailsClick }: { order: Order, onDetailsClick: (order: Order) => void }) => {
    return (
        <Card>
            <CardHeader className='pb-4'>
                <CardTitle className="text-base flex justify-between items-center">
                    <span>{order.tableName || `Pedido #${order.id.slice(-4)}`}</span>
                    <span className="text-sm font-normal text-muted-foreground">#{order.id.slice(-4)}</span>
                </CardTitle>
                <CardDescription>
                    {order.createdAt ? formatDistanceToNow(new Date(order.createdAt.seconds * 1000), { addSuffix: true, locale: ptBR }) : 'Agora mesmo'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-1 text-sm">
                    {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.name}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <span className="text-lg font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                 </span>
                 <Button variant="secondary" size="sm" onClick={() => onDetailsClick(order)}>Detalhes</Button>
            </CardFooter>
        </Card>
    )
};

export function OrderKanbanBoard({ restaurantId }: { restaurantId: string }) {
  const firestore = useFirestore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const ordersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/orders`), orderBy('createdAt', 'desc'));
  }, [restaurantId, firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
        const orderRef = doc(firestore, `restaurants/${restaurantId}/orders/${orderId}`);
        await updateDoc(orderRef, { status: newStatus });
        setSelectedOrder(null);
    } catch (error) {
        console.error(error);
    }
  };

  const getOrdersCount = (status: OrderStatus) => {
    return orders?.filter(order => order.status === status).length || 0;
  }
  
  if (isLoading) return <Skeleton className="h-full w-full" />;

  return (
    <>
      <Tabs defaultValue={statusesToShow[0]} className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
              {statusesToShow.map(status => (
                   <TabsTrigger key={status} value={status} className="flex items-center gap-2">
                      <span className="hidden sm:inline">{STATUS_CONFIG[status].title}</span>
                      <span className="sm:hidden capitalize">{status}</span>
                      <Badge className={`${STATUS_CONFIG[status].color} hover:${STATUS_CONFIG[status].color} text-white`}>
                          {getOrdersCount(status)}
                      </Badge>
                   </TabsTrigger>
              ))}
          </TabsList>
          {statusesToShow.map(status => (
              <TabsContent key={status} value={status} className="mt-4 flex-1 min-h-0">
                   <ScrollArea className="h-full">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                          {orders?.filter(o => o.status === status).map(order => (
                              <OrderCard key={order.id} order={order} onDetailsClick={setSelectedOrder} />
                          ))}
                          {getOrdersCount(status) === 0 && (
                             <p className="col-span-full text-center text-muted-foreground py-12">Nenhum pedido neste status.</p>
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
    </>
  );
}

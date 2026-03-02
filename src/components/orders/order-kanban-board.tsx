'use client';
import { DUMMY_ORDERS } from '@/lib/placeholder-data';
import type { Order, OrderStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '../ui/scroll-area';

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Abertos', color: 'bg-blue-500' },
    'preparando': { title: 'Em Preparação', color: 'bg-yellow-500' },
    'pronto': { title: 'Prontos', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizados', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelados', color: 'bg-red-500' },
};

const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];


const OrderCard = ({ order }: { order: Order }) => {
    return (
        <Card>
            <CardHeader className='pb-4'>
                <CardTitle className="text-base flex justify-between items-center">
                    <span>{order.tableName || `Pedido #${order.id.slice(-4)}`}</span>
                    <span className="text-sm font-normal text-muted-foreground">#{order.id.slice(-4)}</span>
                </CardTitle>
                <CardDescription>
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: ptBR })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-1 text-sm">
                    {order.items.map(item => (
                        <li key={item.id} className="flex justify-between">
                            <span>{item.quantity}x {item.name}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <span className="text-lg font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                 </span>
                 <Button variant="secondary" size="sm">Detalhes</Button>
            </CardFooter>
        </Card>
    )
};

const OrderList = ({ orders, status }: { orders: Order[], status: OrderStatus }) => {
    const filteredOrders = orders.filter(order => order.status === status);
    
    if (filteredOrders.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground py-16 text-center">
                Nenhum pedido neste status.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => <OrderCard key={order.id} order={order} />)}
        </div>
    )
}


export function OrderKanbanBoard() {
  
  const getOrdersCount = (status: OrderStatus) => {
    return DUMMY_ORDERS.filter(order => order.status === status).length;
  }
  
  return (
    <Tabs defaultValue={statusesToShow[0]} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
            {statusesToShow.map(status => (
                 <TabsTrigger key={status} value={status} className="flex items-center gap-2">
                    {STATUS_CONFIG[status].title}
                    <Badge className={`${STATUS_CONFIG[status].color} hover:${STATUS_CONFIG[status].color} text-white`}>
                        {getOrdersCount(status)}
                    </Badge>
                 </TabsTrigger>
            ))}
        </TabsList>
        {statusesToShow.map(status => (
            <TabsContent key={status} value={status} className="mt-4 flex-1 min-h-0">
                 <ScrollArea className="h-full">
                    <div className="p-1">
                        <OrderList orders={DUMMY_ORDERS} status={status} />
                    </div>
                 </ScrollArea>
            </TabsContent>
        ))}
    </Tabs>
  );
}

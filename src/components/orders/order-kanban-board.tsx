'use client';
import { DUMMY_ORDERS } from '@/lib/placeholder-data';
import type { Order, OrderStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Abertos', color: 'bg-blue-500' },
    'preparando': { title: 'Em Preparação', color: 'bg-yellow-500' },
    'pronto': { title: 'Prontos para Entrega', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizados', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelados', color: 'bg-red-500' },
};

const OrderCard = ({ order }: { order: Order }) => {
    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="text-base flex justify-between items-center">
                    <span>{order.tableName}</span>
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


const KanbanColumn = ({ title, orders, status, color }: { title: string, orders: Order[], status: OrderStatus, color: string }) => {
    const filteredOrders = orders.filter(order => order.status === status);
    return (
        <div className="flex flex-col w-80 min-w-80">
            <div className="p-2 font-semibold text-foreground flex items-center gap-2">
                <Badge className={`${color} hover:${color} text-white`}>{filteredOrders.length}</Badge>
                <h3>{title}</h3>
            </div>
            <div className="flex-1 bg-muted/50 rounded-lg p-2 overflow-y-auto">
                {filteredOrders.length > 0 ? (
                    filteredOrders.map(order => <OrderCard key={order.id} order={order} />)
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        Nenhum pedido aqui.
                    </div>
                )}
            </div>
        </div>
    )
}

export function OrderKanbanBoard() {
  const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];
  
  return (
    <div className="flex space-x-4 h-full">
        {statusesToShow.map(status => (
            <KanbanColumn
                key={status}
                title={STATUS_CONFIG[status].title}
                orders={DUMMY_ORDERS}
                status={status}
                color={STATUS_CONFIG[status].color}
            />
        ))}
    </div>
  );
}

    
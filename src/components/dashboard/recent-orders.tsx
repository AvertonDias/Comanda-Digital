
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Order } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function RecentOrders() {
  const { restaurantId } = useRestaurant();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(
        collection(firestore, `restaurants/${restaurantId}/orders`), 
        orderBy('createdAt', 'desc'),
        limit(5)
    );
  }, [restaurantId, firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  return (
    <Card className="lg:col-span-1">
        <CardHeader>
            <CardTitle>Últimos Pedidos</CardTitle>
            <CardDescription>Movimentações recentes no restaurante.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {orders?.map((order) => {
                    const displayOrderNumber = order.orderNumber 
                        ? order.orderNumber.toString().padStart(3, '0') 
                        : order.id.slice(-4).toUpperCase();

                    return (
                        <div key={order.id} className="flex items-center gap-4 border-b pb-3 last:border-0">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-black text-primary">#{displayOrderNumber}</span>
                            </div>
                            <div className="flex-1 space-y-1 min-w-0">
                                <p className="text-sm font-medium leading-none truncate">
                                    {order.tableName || `Balcão #${displayOrderNumber}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {order.createdAt?.seconds 
                                        ? formatDistanceToNow(new Date(order.createdAt.seconds * 1000), { addSuffix: true, locale: ptBR })
                                        : 'Agora mesmo'}
                                </p>
                            </div>
                            <div className="text-sm font-bold shrink-0">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                            </div>
                        </div>
                    );
                })}
                
                {orders?.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Nenhum pedido</p>
                            <p className="text-xs text-muted-foreground">Os pedidos aparecerão aqui assim que realizados.</p>
                        </div>
                    </div>
                )}
            </div>
        </CardContent>
    </Card>
  );
}

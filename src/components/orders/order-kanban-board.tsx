
'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
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
import { KitchenOrderModal } from './kitchen-order-modal';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { Printer, Bell, BellRing } from 'lucide-react';

const STATUS_CONFIG: Record<OrderStatus, { title: string; color: string }> = {
    'aberto': { title: 'Abertos', color: 'bg-blue-500' },
    'preparando': { title: 'Preparando', color: 'bg-yellow-500' },
    'pronto': { title: 'Prontos', color: 'bg-green-500' },
    'finalizado': { title: 'Finalizados', color: 'bg-gray-500' },
    'cancelado': { title: 'Cancelados', color: 'bg-red-500' },
};

const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];

function consolidateItems(items: any[]) {
    const groups: Record<string, any> = {};
    items.forEach(item => {
        const addonsKey = item.addons?.map((a: any) => a.name).sort().join(',') || '';
        const key = `${item.menuItemId}-${addonsKey}-${item.notes || ''}`;
        if (groups[key]) {
            groups[key].quantity += item.quantity;
        } else {
            groups[key] = { ...item };
        }
    });
    return Object.values(groups);
}

const OrderCard = ({ 
    order, 
    onDetailsClick, 
    onQuickPrint 
}: { 
    order: Order, 
    onDetailsClick: (order: Order) => void,
    onQuickPrint: (order: Order) => void
}) => {
    const displayOrderNumber = order.orderNumber 
        ? order.orderNumber.toString().padStart(3, '0') 
        : order.id.slice(-4).toUpperCase();

    const previewItems = useMemo(() => consolidateItems(order.items), [order.items]);

    return (
        <Card className={`active:scale-[0.98] transition-all shadow-sm hover:shadow-md border-2 ${order.status === 'aberto' ? 'border-blue-100 animate-in fade-in duration-500' : 'border-transparent'}`}>
            <CardHeader className='p-4 pb-2'>
                <CardTitle className="text-sm flex justify-between items-start gap-2">
                    <span className="font-black uppercase leading-tight flex-1">
                        {order.tableName || `Pedido #${displayOrderNumber}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">#{displayOrderNumber}</Badge>
                </CardTitle>
                <CardDescription className="text-[10px] flex items-center gap-1">
                    {order.createdAt?.seconds ? formatDistanceToNow(new Date(order.createdAt.seconds * 1000), { addSuffix: true, locale: ptBR }) : 'Agora'}
                    {order.status === 'aberto' && <span className="ml-2 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 py-2">
                <ul className="space-y-1 text-xs">
                    {previewItems.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="flex justify-between items-center text-muted-foreground">
                            <span className="truncate">{item.quantity}x {item.name}</span>
                        </li>
                    ))}
                    {previewItems.length > 3 && (
                        <li className="text-[10px] text-primary font-bold">+ {previewItems.length - 3} itens</li>
                    )}
                </ul>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between items-center gap-2">
                 <span className="text-base font-black">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                 </span>
                 <div className="flex gap-1">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-orange-600 border-orange-200 hover:bg-orange-50" 
                        onClick={(e) => { e.stopPropagation(); onQuickPrint(order); }}
                        title="Imprimir para Cozinha"
                    >
                        <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={() => onDetailsClick(order)}>Ver</Button>
                 </div>
            </CardFooter>
        </Card>
    )
};

export function OrderKanbanBoard({ restaurantId, tableId }: { restaurantId: string, tableId?: string }) {
  const firestore = useFirestore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lastFinalizedOrder, setLastFinalizedOrder] = useState<Order | null>(null);
  const [orderToQuickPrint, setOrderToQuickPrint] = useState<Order | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [soundEnabled, setSoundAlertEnabled] = useState(true);
  
  const lastOrderCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Sistema de alerta sonoro para novos pedidos (útil para o PC do balcão)
  useEffect(() => {
    if (orders) {
        const currentCount = orders.filter(o => o.status === 'aberto').length;
        if (currentCount > lastOrderCount.current && !isLoading) {
            if (soundEnabled && audioRef.current) {
                audioRef.current.play().catch(e => console.log('Áudio bloqueado pelo navegador'));
            }
        }
        lastOrderCount.current = currentCount;
    }
  }, [orders, soundEnabled, isLoading]);

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
            const key = order.tableId || order.id;
            
            if (!groups[key]) {
                groups[key] = { ...order };
            } else {
                groups[key].total += order.total;
                groups[key].items = consolidateItems([...groups[key].items, ...order.items]);
                
                if (order.orderNumber && (!groups[key].orderNumber || order.orderNumber > groups[key].orderNumber)) {
                    groups[key].orderNumber = order.orderNumber;
                }

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

  useEffect(() => {
    if (tableId && !autoOpened && orders && orders.length > 0) {
        for (const status of statusesToShow) {
            const orderForTable = groupedOrdersByStatus[status].find(o => o.tableId === tableId);
            if (orderForTable) {
                setSelectedOrder(orderForTable);
                setAutoOpened(true);
                break;
            }
        }
    }
  }, [tableId, orders, groupedOrdersByStatus, autoOpened]);

  const handleStatusChange = (orderIds: string | string[], newStatus: OrderStatus, extraData: any = {}) => {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    
    let mergedOrderForReceipt: any = null;
    if (newStatus === 'finalizado') {
        const selectedOrders = orders?.filter(o => ids.includes(o.id)) || [];
        if (selectedOrders.length > 0) {
            mergedOrderForReceipt = {
                ...selectedOrders[0],
                id: ids.join('_'),
                items: consolidateItems(selectedOrders.flatMap(o => o.items)),
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
        const updatePayload: any = { 
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
      {/* Alerta de som invisível */}
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      <div className="flex items-center justify-between px-4 mb-2 bg-muted/20 py-2 border-b md:rounded-t-lg">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-black uppercase text-muted-foreground">Alertas de Balcão</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-7 px-3 gap-2 text-[9px] font-black uppercase transition-all ${soundEnabled ? 'text-green-600' : 'text-muted-foreground'}`}
            onClick={() => setSoundAlertEnabled(!soundEnabled)}
          >
            {soundEnabled ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
            {soundEnabled ? 'Som Ativado' : 'Som Mudo'}
          </Button>
      </div>

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
                              <OrderCard 
                                key={order.id} 
                                order={order} 
                                onDetailsClick={setSelectedOrder} 
                                onQuickPrint={setOrderToQuickPrint}
                              />
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

      <KitchenOrderModal 
        order={orderToQuickPrint}
        restaurant={restaurant}
        isOpen={!!orderToQuickPrint}
        onClose={() => setOrderToQuickPrint(null)}
      />
    </div>
  );
}

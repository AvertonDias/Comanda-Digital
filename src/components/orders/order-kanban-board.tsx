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
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { Bell, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRestaurant } from '@/hooks/use-restaurant';

const statusesToShow: OrderStatus[] = ['aberto', 'preparando', 'pronto'];

function consolidateItems(items: any[]) {
    if (!items) return [];
    const groups: Record<string, any> = {};
    items.forEach(item => {
        const addonsKey = item.addons?.map((a: any) => a.name).sort().join(',') || '';
        const notesKey = item.notes?.trim() || '';
        const key = `${item.menuItemId}-${addonsKey}-${notesKey}`;
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
    role 
}: { 
    order: Order & { allOrderIds?: string[] }, 
    onDetailsClick: (order: Order & { allOrderIds?: string[] }) => void,
    role: string | null
}) => {
    const displayOrderNumber = order.orderNumber 
        ? order.orderNumber.toString().padStart(3, '0') 
        : order.id.slice(-4).toUpperCase();

    const previewItems = useMemo(() => consolidateItems(order.items), [order.items]);
    
    // O pulso só aparece para ADMIN se o pedido for novo (aberto e não impresso/visto)
    const isNew = role === 'admin' && order.status === 'aberto' && !order.isPrinted;

    return (
        <Card 
            className={cn(
                "active:scale-[0.98] transition-all shadow-sm hover:shadow-md border-2 cursor-pointer relative overflow-hidden",
                order.status === 'aberto' ? 'border-blue-100' : 'border-transparent',
                isNew && "animate-pulse border-blue-500 bg-blue-50/30"
            )}
            onClick={() => onDetailsClick(order)}
        >
            {isNew && (
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
            )}
            <CardHeader className='p-4 pb-2'>
                <CardTitle className="text-sm flex justify-between items-start gap-2">
                    <span className="font-black uppercase leading-tight flex-1">
                        {order.tableName || `Pedido #${displayOrderNumber}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">#{displayOrderNumber}</Badge>
                </CardTitle>
                <CardDescription className="text-[10px] flex items-center gap-1">
                    {order.createdAt?.seconds ? formatDistanceToNow(new Date(order.createdAt.seconds * 1000), { addSuffix: true, locale: ptBR }) : 'Agora'}
                    {isNew && <span className="ml-2 h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping" />}
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
            </CardFooter>
        </Card>
    )
};

export function OrderKanbanBoard({ restaurantId, tableId }: { restaurantId: string, tableId?: string }) {
  const firestore = useFirestore();
  const { role } = useRestaurant();
  const [selectedOrder, setSelectedOrder] = useState<(Order & { allOrderIds?: string[] }) | null>(null);
  const [lastFinalizedOrder, setLastFinalizedOrder] = useState<Order | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [soundEnabled, setSoundAlertEnabled] = useState(true);
  
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
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

  useEffect(() => {
    if (orders && !isLoading && role === 'admin') {
        const currentAbertoOrders = orders.filter(o => o.status === 'aberto');
        
        if (!initialLoadDone.current) {
            currentAbertoOrders.forEach(o => knownOrderIds.current.add(o.id));
            initialLoadDone.current = true;
            return;
        }

        let hasNewOrder = false;
        currentAbertoOrders.forEach(o => {
            if (!knownOrderIds.current.has(o.id)) {
                hasNewOrder = true;
                knownOrderIds.current.add(o.id);
            }
        });

        if (hasNewOrder && soundEnabled && audioRef.current) {
            audioRef.current.play().catch(e => console.log('Áudio bloqueado pelo navegador'));
        }
    }
  }, [orders, soundEnabled, isLoading, role]);

  const groupedOrdersByStatus = useMemo(() => {
    const result: Record<string, (Order & { allOrderIds?: string[] })[]> = {
        'aberto': [],
        'preparando': [],
        'pronto': [],
        'finalizado': [],
        'cancelado': []
    };
    
    if (!orders) return result;

    statusesToShow.forEach(status => {
        const statusOrders = orders.filter(o => o.status === status);
        const groups: Record<string, Order & { allOrderIds: string[] }> = {};
        
        statusOrders.forEach(order => {
            const key = order.tableId || order.id;
            
            if (!groups[key]) {
                groups[key] = { ...order, allOrderIds: [order.id] };
            } else {
                groups[key].allOrderIds.push(order.id);
                groups[key].total += order.total;
                groups[key].items = [...groups[key].items, ...order.items];
                
                if (order.orderNumber && (!groups[key].orderNumber || order.orderNumber > groups[key].orderNumber)) {
                    groups[key].orderNumber = order.orderNumber;
                }

                const currentCreated = groups[key].createdAt?.seconds || Infinity;
                const newCreated = order.createdAt?.seconds || Infinity;
                if (newCreated < currentCreated) {
                    groups[key].createdAt = order.createdAt;
                }
                
                // Se algum pedido do grupo não foi impresso/visto, o grupo todo é marcado como não visto
                if (order.status === 'aberto' && !order.isPrinted) {
                    groups[key].isPrinted = false;
                }
            }
        });
        
        // Consolida itens após o agrupamento
        result[status] = Object.values(groups).map(g => ({
            ...g,
            items: consolidateItems(g.items)
        }));
    });

    return result;
  }, [orders]);

  useEffect(() => {
    if (tableId && !autoOpened && orders && orders.length > 0) {
        for (const status of statusesToShow) {
            const orderForTable = groupedOrdersByStatus[status].find(o => o.tableId === tableId);
            if (orderForTable) {
                handleDetailsClick(orderForTable);
                setAutoOpened(true);
                break;
            }
        }
    }
  }, [tableId, orders, groupedOrdersByStatus, autoOpened]);

  const handleDetailsClick = (order: Order & { allOrderIds?: string[] }) => {
    setSelectedOrder(order);
    
    // SE FOR ADMIN: Ao clicar em um pedido novo (piscando), marca como "visto" no servidor
    if (role === 'admin' && order.status === 'aberto' && !order.isPrinted) {
        const idsToUpdate = order.allOrderIds || [order.id];
        idsToUpdate.forEach(id => {
            const orderRef = doc(firestore, `restaurants/${restaurantId}/orders/${id}`);
            updateDoc(orderRef, { isPrinted: true }).catch(() => {});
        });
    }
  };

  const handleStatusChange = (orderIds: string | string[], newStatus: OrderStatus, extraData: any = {}) => {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    
    let mergedOrderForReceipt: any = null;
    let targetTableId: string | null = null;

    if (orders) {
        const selectedOrders = orders.filter(o => ids.includes(o.id));
        if (selectedOrders.length > 0) {
            targetTableId = selectedOrders[0].tableId || null;
            if (newStatus === 'finalizado') {
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
    }

    const batchPromises: Promise<any>[] = ids.map(id => {
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

    if (newStatus === 'finalizado' && targetTableId) {
        const tableRef = doc(firestore, `restaurants/${restaurantId}/tables/${targetTableId}`);
        batchPromises.push(updateDoc(tableRef, { status: 'livre' }));
    }

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

  if (isLoading) return <Skeleton className="h-full w-full" />;

  return (
    <div className="flex flex-col h-full -mx-4 md:mx-0">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />

      {role === 'admin' && (
        <div className="flex items-center justify-between px-4 mb-2 bg-muted/20 py-2 border-b md:rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase text-muted-foreground">Alertas de Balcão</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                  "h-7 px-3 gap-2 text-[9px] font-black uppercase transition-all",
                  soundEnabled ? 'text-green-600' : 'text-muted-foreground'
              )}
              onClick={() => setSoundAlertEnabled(!soundEnabled)}
            >
              {soundEnabled ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
              {soundEnabled ? 'Som Ativado' : 'Som Mudo'}
            </Button>
        </div>
      )}

      <Tabs defaultValue={statusesToShow[0]} className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 rounded-none h-12 sticky top-0 z-10 px-4">
              {statusesToShow.map(status => (
                   <TabsTrigger key={status} value={status} className="flex items-center gap-1.5 data-[state=active]:bg-background text-[10px] uppercase font-bold tracking-tight">
                      {status === 'aberto' ? 'Abertos' : status === 'preparando' ? 'Preparando' : 'Prontos'}
                      <Badge className={cn(
                          "hover:opacity-90 text-[8px] h-4 w-4 p-0 flex items-center justify-center text-white border-none",
                          status === 'aberto' ? 'bg-blue-500' : status === 'preparando' ? 'bg-yellow-500' : 'bg-green-500'
                      )}>
                          {groupedOrdersByStatus[status].length}
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
                                onDetailsClick={handleDetailsClick}
                                role={role}
                              />
                          ))}
                          {groupedOrdersByStatus[status].length === 0 && (
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

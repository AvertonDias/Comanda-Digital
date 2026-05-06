
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CreditCard, Activity } from 'lucide-react';
import { useRestaurant } from '@/hooks/use-restaurant';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Table, Customer } from '@/lib/types';
import { useMemo } from 'react';

export function StatsCards() {
  const { restaurantId } = useRestaurant();
  const firestore = useFirestore();

  // Consultas reais para estatísticas do dashboard
  const ordersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/orders`));
  }, [restaurantId, firestore]);

  const tablesQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/tables`), where('status', '==', 'ocupada'));
  }, [restaurantId, firestore]);

  const customersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/customers`));
  }, [restaurantId, firestore]);

  const { data: orders } = useCollection<Order>(ordersQuery);
  const { data: activeTables } = useCollection<Table>(tablesQuery);
  const { data: customers } = useCollection<Customer>(customersQuery);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders?.filter(o => {
        const orderDate = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date();
        return orderDate >= today;
    }) || [];

    // Faturamento apenas de pedidos finalizados hoje
    const revenueToday = todayOrders.reduce((acc, curr) => acc + (curr.status === 'finalizado' ? curr.total : 0), 0);
    const newOrdersToday = todayOrders.length;

    return [
        {
            title: "Faturamento Hoje",
            value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenueToday),
            change: "Vendas finalizadas",
            icon: DollarSign,
        },
        {
            title: "Clientes",
            value: (customers?.length || 0).toString(),
            change: "Base cadastrada",
            icon: Users,
        },
        {
            title: "Novos Pedidos",
            value: newOrdersToday.toString(),
            change: "Pedidos hoje",
            icon: CreditCard,
        },
        {
            title: "Mesas Ativas",
            value: (activeTables?.length || 0).toString(),
            change: "Em atendimento",
            icon: Activity,
        },
    ];
  }, [orders, activeTables, customers]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
        </Card>
      ))}
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CreditCard, Activity } from 'lucide-react';

const stats = [
    {
        title: "Faturamento Hoje",
        value: "R$ 0,00",
        change: "Sem vendas hoje",
        icon: DollarSign,
    },
    {
        title: "Clientes Hoje",
        value: "0",
        change: "Aguardando clientes",
        icon: Users,
    },
    {
        title: "Novos Pedidos",
        value: "0",
        change: "Sem novos pedidos",
        icon: CreditCard,
    },
    {
        title: "Mesas Ativas",
        value: "0",
        change: "Todas as mesas livres",
        icon: Activity,
    },
]

export function StatsCards() {
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

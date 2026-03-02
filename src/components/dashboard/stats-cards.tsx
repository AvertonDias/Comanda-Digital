import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CreditCard, Activity } from 'lucide-react';

const stats = [
    {
        title: "Faturamento Hoje",
        value: "R$ 4,231.89",
        change: "+20.1% do último mês",
        icon: DollarSign,
    },
    {
        title: "Clientes Hoje",
        value: "+235",
        change: "+180.1% do último mês",
        icon: Users,
    },
    {
        title: "Novos Pedidos",
        value: "+12,234",
        change: "+19% do último mês",
        icon: CreditCard,
    },
    {
        title: "Mesas Ativas",
        value: "8",
        change: "+2 desde a última hora",
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

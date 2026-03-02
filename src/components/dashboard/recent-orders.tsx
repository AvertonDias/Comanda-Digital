import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const recentSales = [
    {
        name: "Olivia Martin",
        email: "olivia.martin@email.com",
        amount: "+R$1,999.00",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d"
    },
    {
        name: "Jackson Lee",
        email: "jackson.lee@email.com",
        amount: "+R$39.00",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704e"
    },
    {
        name: "Isabella Nguyen",
        email: "isabella.nguyen@email.com",
        amount: "+R$299.00",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704f"
    },
    {
        name: "William Kim",
        email: "will@email.com",
        amount: "+R$99.00",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704a"
    },
    {
        name: "Sofia Davis",
        email: "sofia.davis@email.com",
        amount: "+R$39.00",
        avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704b"
    },
]

export function RecentOrders() {
  return (
    <Card className="lg:col-span-1">
        <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
            <CardDescription>Você teve 265 pedidos este mês.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-8">
                {recentSales.map((sale) => (
                    <div key={sale.email} className="flex items-center">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={sale.avatar} alt="Avatar" />
                            <AvatarFallback>{sale.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{sale.name}</p>
                            <p className="text-sm text-muted-foreground">{sale.email}</p>
                        </div>
                        <div className="ml-auto font-medium">{sale.amount}</div>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
  );
}

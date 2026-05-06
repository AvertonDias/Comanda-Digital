import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

export function RecentOrders() {
  return (
    <Card className="lg:col-span-1">
        <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
            <CardDescription>Últimas movimentações do seu restaurante.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium">Nenhum pedido encontrado</p>
                    <p className="text-xs text-muted-foreground">Os pedidos aparecerão aqui assim que forem realizados.</p>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}

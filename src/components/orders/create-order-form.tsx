'use client';
import { useState } from 'react';
import { DUMMY_CATEGORIES, DUMMY_MENU_ITEMS, DUMMY_TABLES } from '@/lib/placeholder-data';
import type { MenuItem, OrderItem, Table, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '../ui/label';

// Simplified OrderItem for local state
type NewOrderItem = Omit<OrderItem, 'id' | 'priceAtOrder' | 'orderId' | 'printSectorId' | 'notes'> & { price: number };

export function CreateOrderForm() {
    const [origin, setOrigin] = useState<Order['origin']>('mesa');
    const [destination, setDestination] = useState<Order['destination']>('local');
    const [tableId, setTableId] = useState<string | undefined>(undefined);
    const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);

    const handleAddItem = (item: MenuItem) => {
        setOrderItems(prevItems => {
            const existingItem = prevItems.find(i => i.menuItemId === item.id);
            if (existingItem) {
                return prevItems.map(i =>
                    i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
                );
            }
            return [...prevItems, { menuItemId: item.id, name: item.name, quantity: 1, price: item.price }];
        });
    };

    const handleUpdateQuantity = (menuItemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            // Remove item if quantity is 0 or less
            setOrderItems(prevItems => prevItems.filter(i => i.menuItemId !== menuItemId));
        } else {
            setOrderItems(prevItems =>
                prevItems.map(i =>
                    i.menuItemId === menuItemId ? { ...i, quantity: newQuantity } : i
                )
            );
        }
    };

    const total = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[70vh]">
            {/* Left Column: Menu Selection */}
            <div className="flex flex-col">
                <Tabs defaultValue={DUMMY_CATEGORIES[0].id} className="flex-1 flex flex-col">
                    <TabsList className="w-full justify-start">
                        {DUMMY_CATEGORIES.map(category => (
                            <TabsTrigger key={category.id} value={category.id}>
                                {category.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <ScrollArea className="flex-1 mt-4">
                        {DUMMY_CATEGORIES.map(category => (
                            <TabsContent key={category.id} value={category.id}>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                    {DUMMY_MENU_ITEMS
                                        .filter(item => item.categoryId === category.id && item.isAvailable)
                                        .map(item => (
                                            <Card key={item.id} className="flex flex-col">
                                                <CardHeader className="p-3 flex-1">
                                                    <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-3 pt-0 flex justify-between items-center">
                                                    <span className="text-sm font-semibold">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                                    </span>
                                                    <Button size="sm" onClick={() => handleAddItem(item)}>
                                                        <Plus className="h-4 w-4" />
                                                        Adicionar
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                </div>
                            </TabsContent>
                        ))}
                    </ScrollArea>
                </Tabs>
            </div>

            {/* Right Column: Order Summary */}
            <div className="flex flex-col">
                <Card className="flex-1 flex flex-col">
                    <CardHeader>
                        <CardTitle>Comanda</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label>Origem</Label>
                                <Select value={origin} onValueChange={(v) => setOrigin(v as Order['origin'])}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mesa">Mesa</SelectItem>
                                        <SelectItem value="balcao">Balcão</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="telefone">Telefone</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>
                             <div>
                                <Label>Destino</Label>
                                <Select value={destination} onValueChange={(v) => setDestination(v as Order['destination'])}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="local">Local</SelectItem>
                                        <SelectItem value="retirada">Retirada</SelectItem>
                                        <SelectItem value="entrega">Entrega</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>
                        </div>

                        {origin === 'mesa' && (
                            <div>
                                <Label>Mesa</Label>
                                <Select value={tableId} onValueChange={setTableId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione uma mesa" /></SelectTrigger>
                                    <SelectContent>
                                        {DUMMY_TABLES.filter(t => t.status === 'livre').map(table => (
                                            <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        
                        <Separator />

                        <ScrollArea className="flex-1 -mx-6 px-6">
                            {orderItems.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-center text-muted-foreground py-8">Nenhum item adicionado.</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {orderItems.map(item => (
                                        <li key={item.menuItemId} className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.menuItemId, item.quantity - 1)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="w-6 text-center font-medium">{item.quantity}</span>
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.menuItemId, item.quantity + 1)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </ScrollArea>

                        <div className="mt-auto pt-4 border-t">
                            <div className="flex justify-between items-center font-bold text-lg">
                                <span>Total</span>
                                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                 <Button className="w-full mt-4" size="lg" disabled={orderItems.length === 0}>
                    Criar Pedido
                </Button>
            </div>
        </div>
    );
}

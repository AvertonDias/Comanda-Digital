import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { DUMMY_MENU_ITEMS } from '@/lib/placeholder-data';
import type { MenuItemCategory } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemForm } from '@/components/menu/menu-item-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SidebarTrigger } from '@/components/ui/sidebar';

const categories: MenuItemCategory[] = ['Lanches', 'Pizzas', 'Saladas', 'Sobremesas', 'Bebidas'];

export default function MenuPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Cardápio</h1>
        <div className="ml-auto">
          <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Item
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Adicionar novo item ao cardápio</DialogTitle>
                </DialogHeader>
                <MenuItemForm />
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Tabs defaultValue="Lanches" className="w-full">
          <TabsList>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {DUMMY_MENU_ITEMS.filter((item) => item.category === category).map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

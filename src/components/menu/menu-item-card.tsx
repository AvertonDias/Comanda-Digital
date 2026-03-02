import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/lib/types';
import { Badge } from '../ui/badge';

type MenuItemCardProps = {
  item: MenuItem & { categoryName: string };
};

export function MenuItemCard({ item }: MenuItemCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="p-0 relative">
        <div className="absolute top-2 right-2 z-10">
          <Badge variant={item.isAvailable ? 'default' : 'destructive'} className={item.isAvailable ? 'bg-green-500' : ''}>
            {item.isAvailable ? 'Disponível' : 'Indisponível'}
          </Badge>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
            <Image
                src={item.imageUrl}
                alt={item.name}
                data-ai-hint={item.imageHint}
                fill
                className="object-cover"
            />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <CardTitle className="text-lg font-semibold mb-1">{item.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground mb-2">{item.categoryName}</CardDescription>
        <CardDescription className="text-sm line-clamp-3">{item.description}</CardDescription>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4 pt-0">
        <span className="text-lg font-bold text-primary">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
        </span>
        <Button variant="outline">Editar</Button>
      </CardFooter>
    </Card>
  );
}

    
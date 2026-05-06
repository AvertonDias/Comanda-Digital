
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Trash2, Edit } from 'lucide-react';
import { useState } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/hooks/use-restaurant';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type MenuItemCardProps = {
  item: MenuItem & { categoryName: string };
};

export function MenuItemCard({ item }: MenuItemCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { role } = useRestaurant();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const isAdmin = role === 'admin';

  const handleDelete = () => {
    const docRef = doc(firestore, `restaurants/${item.restaurantId}/menuItems`, item.id);
    deleteDoc(docRef).then(() => {
        toast({ title: "Item excluído com sucesso." });
    }).catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete'
        }));
    });
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
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
            {isAdmin && (
              <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
            )}
          </CardFooter>
        </Card>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir item do cardápio?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Deseja realmente excluir "{item.name}"? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">Excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}

'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MenuItem, MenuItemCategory } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Trash2, Edit, MoreHorizontal, Plus, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/hooks/use-restaurant';
import { MenuItemForm } from './menu-item-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MenuItemCardProps = {
  item: MenuItem & { categoryName: string };
  categories: MenuItemCategory[];
};

export function MenuItemCard({ item, categories }: MenuItemCardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { role } = useRestaurant();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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
        <Card className="flex p-3 gap-4 hover:shadow-md transition-shadow cursor-pointer relative group">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
                src={item.imageUrl}
                alt={item.name}
                data-ai-hint={item.imageHint}
                fill
                className="object-cover"
            />
          </div>

          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2">
                <h4 className="font-bold text-base truncate">{item.name}</h4>
                {!item.isAvailable && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Indisponível</Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-tight">
                {item.description}
            </p>
            <div className="flex items-center justify-between pt-1">
                <span className="text-primary font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                </span>
                
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          </div>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-full w-full h-[100dvh] sm:h-[90vh] sm:max-w-[800px] p-0 overflow-hidden flex flex-col gap-0 border-none sm:border">
                <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10 sm:static flex flex-row items-center gap-2 space-y-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsEditDialogOpen(false)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <DialogTitle>Editar Item: {item.name}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                  <MenuItemForm 
                      restaurantId={item.restaurantId}
                      categories={categories}
                      initialData={item}
                      onSuccess={() => setIsEditDialogOpen(false)}
                  />
                </div>
            </DialogContent>
        </Dialog>

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

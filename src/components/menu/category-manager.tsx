'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2, Plus, GripVertical, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { MenuItemCategory } from '@/lib/types';

export function CategoryManager({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState<MenuItemCategory | null>(null);

    const categoriesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`), orderBy('order', 'asc'));
    }, [restaurantId, firestore]);

    const { data: categories, isLoading } = useCollection<MenuItemCategory>(categoriesQuery);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        const colRef = collection(firestore, `restaurants/${restaurantId}/menuItemCategories`);
        const order = (categories?.length || 0) + 1;
        
        const data = {
            name: newName,
            order,
            restaurantId,
            createdAt: serverTimestamp()
        };

        try {
            await addDoc(colRef, data);
            setNewName('');
            toast({ title: "Categoria adicionada!" });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: data
            }));
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return;
        const docRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories`, id);
        try {
            await updateDoc(docRef, { name: editName });
            setEditingId(null);
            toast({ title: "Categoria atualizada!" });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update'
            }));
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        const docRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories`, categoryToDelete.id);
        try {
            await deleteDoc(docRef);
            toast({ title: "Categoria removida." });
            setCategoryToDelete(null);
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete'
            }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input 
                    placeholder="Ex: Pizzas, Bebidas..." 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd} size="icon">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories?.map((cat) => (
                            <TableRow key={cat.id}>
                                <TableCell>
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </TableCell>
                                <TableCell>
                                    {editingId === cat.id ? (
                                        <Input 
                                            value={editName} 
                                            onChange={e => setEditName(e.target.value)} 
                                            className="h-8"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="font-medium">{cat.name}</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {editingId === cat.id ? (
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleUpdate(cat.id)}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setCategoryToDelete(cat)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!categories || categories.length === 0) && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Nenhuma categoria cadastrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!categoryToDelete} onOpenChange={open => !open && setCategoryToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso removerá a categoria "{categoryToDelete?.name}". 
                            Os itens vinculados a ela não serão excluídos, mas ficarão sem categoria.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


'use client';

import type { Table } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { QrCodeModal } from "./qr-code-modal";
import { Button } from "../ui/button";
import { Edit2, Trash2, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TableCardProps = {
    table: Table;
};

const statusConfig = {
    'livre': { text: 'Livre', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
    'ocupada': { text: 'Ocupada', variant: 'destructive', className: '' },
    'fechando': { text: 'Fechando', variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
} as const;

export function TableCard({ table }: TableCardProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [newName, setNewName] = useState(table.name);
    const config = statusConfig[table.status];

    const handleUpdateName = () => {
        if (!newName || newName === table.name) {
            setIsEditDialogOpen(false);
            return;
        }

        const docRef = doc(firestore, `restaurants/${table.restaurantId}/tables`, table.id);
        updateDoc(docRef, { name: newName }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: { name: newName }
            }));
        });
        
        toast({ title: "Mesa atualizada!" });
        setIsEditDialogOpen(false);
    };

    const handleDelete = () => {
        const docRef = doc(firestore, `restaurants/${table.restaurantId}/tables`, table.id);
        deleteDoc(docRef).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete'
            }));
        });
        
        toast({ title: "Mesa removida." });
        setIsDeleteDialogOpen(false);
    };

    return (
        <>
            <Card className="relative hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-medium">{table.name}</CardTitle>
                    <div className="flex items-center gap-1">
                        <Badge variant={config.variant} className={config.className}>
                            {config.text}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">QR Code da Mesa</p>
                    <QrCodeModal table={table} />
                </CardContent>
            </Card>

            {/* Modal de Edição */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar Mesa</DialogTitle>
                        <DialogDescription>
                            Altere o nome ou número de identificação da mesa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Nome
                            </Label>
                            <Input
                                id="name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateName}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Alerta de Exclusão */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente a <strong>{table.name}</strong> e todos os vínculos associados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir Mesa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

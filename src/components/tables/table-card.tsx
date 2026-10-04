'use client';

import type { Table } from "@/lib/types";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { QrCodeModal } from "./qr-code-modal";
import { Button } from "../ui/button";
import { 
    Edit2, 
    Trash2, 
    MoreVertical, 
    PlusCircle, 
    Receipt, 
    CheckCircle2, 
    Clock, 
    ExternalLink,
    Users
} from "lucide-react";
import { useState } from "react";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRestaurant } from "@/hooks/use-restaurant";
import Link from "next/link";
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
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TableCardProps = {
    table: Table;
};

const statusConfig = {
    'livre': { 
        text: 'Livre', 
        subtext: 'Mesa pronta para uso', 
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        badgeBg: 'bg-emerald-600 text-white',
        icon: CheckCircle2 
    },
    'ocupada': { 
        text: 'Ocupada', 
        subtext: 'Clientes consumindo', 
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        badgeBg: 'bg-red-600 text-white',
        icon: Users 
    },
    'fechando': { 
        text: 'Pediu a Conta', 
        subtext: 'Aguardando pagamento', 
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        badgeBg: 'bg-amber-600 text-white',
        icon: Clock 
    },
} as const;

export function TableCard({ table }: TableCardProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { role } = useRestaurant();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [newName, setNewName] = useState(table.name);

    const config = statusConfig[table.status] || statusConfig['livre'];
    const StatusIcon = config.icon;
    const isAdmin = role === 'admin';

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
        
        toast({ title: "Nome da mesa atualizado!" });
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
        
        toast({ title: "Mesa removida com sucesso." });
        setIsDeleteDialogOpen(false);
    };

    const handleStatusUpdate = (status: Table['status']) => {
        const docRef = doc(firestore, `restaurants/${table.restaurantId}/tables`, table.id);
        updateDoc(docRef, { status });
        const labels = { libre: 'Livre', ocupada: 'Ocupada', fechando: 'Pediu a Conta' };
        toast({ title: `Mesa marcada como ${status}` });
    };

    return (
        <>
            <Card className={cn(
                "relative transition-all border-2 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between",
                config.borderColor,
                config.bgColor
            )}>
                {/* Cabeçalho do Card */}
                <div className="p-4 pb-3 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-foreground">
                            {table.name}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Badge className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1", config.badgeBg)}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {config.text}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <QrCodeModal table={table} />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-10 w-10 rounded-full hover:bg-black/10 active:scale-95"
                                    aria-label="Mais opções da mesa"
                                >
                                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => handleStatusUpdate('livre')} className="text-emerald-700 font-medium">
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Marcar como Livre
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusUpdate('ocupada')} className="text-red-700 font-medium">
                                    <Users className="mr-2 h-4 w-4" />
                                    Marcar como Ocupada
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusUpdate('fechando')} className="text-amber-700 font-medium">
                                    <Clock className="mr-2 h-4 w-4" />
                                    Marcar como Pediu Conta
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <a href={`/${table.restaurantId}/${table.id}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Abrir Cardápio Digital
                                    </a>
                                </DropdownMenuItem>

                                {isAdmin && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                                            <Edit2 className="mr-2 h-4 w-4" />
                                            Renomear Mesa
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive font-semibold">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Excluir Mesa
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Corpo do Card com botões fáceis de tocar (Tamanho grande) */}
                <CardContent className="p-4 pt-1 flex flex-col gap-2">
                    {table.status === 'livre' ? (
                        <>
                            <Button 
                                size="lg" 
                                className="w-full h-12 text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm active:scale-98 transition-transform flex items-center justify-center gap-2" 
                                asChild
                            >
                                <Link href={`/orders?tableId=${table.id}`}>
                                    <PlusCircle className="h-5 w-5" />
                                    Abrir Pedido
                                </Link>
                            </Button>
                            
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-9 text-xs font-semibold rounded-xl bg-background/80"
                                onClick={() => handleStatusUpdate('ocupada')}
                            >
                                Ocupar mesa sem pedido
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button 
                                size="lg" 
                                className="w-full h-12 text-sm font-black bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm active:scale-98 transition-transform flex items-center justify-center gap-2" 
                                asChild
                            >
                                <Link href={`/orders?tableId=${table.id}`}>
                                    <Receipt className="h-5 w-5" />
                                    Ver Comanda / Conta
                                </Link>
                            </Button>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    variant="outline"
                                    size="sm" 
                                    className="h-10 text-xs font-bold rounded-xl bg-background/80" 
                                    asChild
                                >
                                    <Link href={`/orders?tableId=${table.id}`}>
                                        <PlusCircle className="mr-1.5 h-4 w-4 text-primary" />
                                        + Itens
                                    </Link>
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 text-xs font-bold rounded-xl bg-background/80 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                    onClick={() => handleStatusUpdate('livre')}
                                >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600" />
                                    Liberar
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Modal para editar nome da mesa */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">Mudar Nome da Mesa</DialogTitle>
                        <DialogDescription>
                            Exemplo: "Mesa 01", "Mesa VIP", "Varanda 03"
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="name" className="text-sm font-bold block mb-2">Nome ou Número</Label>
                        <Input 
                            id="name" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)} 
                            className="h-12 text-base font-bold"
                            placeholder="Mesa 01"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="lg" className="h-12 flex-1" onClick={() => setIsEditDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button size="lg" className="h-12 flex-1 font-bold" onClick={handleUpdateName}>
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmação de exclusão */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {table.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar esta mesa? Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-12 flex-1">Não, voltar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            className="h-12 flex-1 bg-destructive hover:bg-destructive/90 font-bold"
                        >
                            Sim, excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

'use client';

import { AppHeader } from "@/components/layout/app-header";
import { TableCard } from "@/components/tables/table-card";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PlusCircle, CheckCircle2, Users, LayoutGrid, Trash2, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from "firebase/firestore";
import type { Table } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TablesPage() {
    const { restaurantId, isLoading, role } = useRestaurant();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [statusFilter, setStatusFilter] = useState<'all' | 'livre' | 'ocupada'>('all');
    const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isNewTableDialogOpen, setIsNewTableDialogOpen] = useState(false);
    const [newTableName, setNewTableName] = useState('');

    const isAdmin = role === 'admin';

    const tablesQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${restaurantId}/tables`),
            orderBy('name', 'asc')
        );
    }, [restaurantId, firestore]);

    const { data: rawTables, isLoading: isTablesLoading } = useCollection<Table>(
        tablesQuery ?? undefined
    );

    // Deduplicação em memória para a interface nunca exibir duplicadas
    const { uniqueTables, duplicateDocIds } = useMemo(() => {
        if (!rawTables) return { uniqueTables: [], duplicateDocIds: [] };
        
        const map = new Map<string, Table>();
        const dupes: string[] = [];

        rawTables.forEach(table => {
            const normalizedName = (table.name || '').trim().toLowerCase();
            if (!map.has(normalizedName)) {
                map.set(normalizedName, table);
            } else {
                const current = map.get(normalizedName)!;
                // Se a mesa atual for ocupada e a anterior for livre, mantém a ocupada
                if (current.status === 'livre' && (table.status === 'ocupada' || table.status === 'fechando')) {
                    dupes.push(current.id);
                    map.set(normalizedName, table);
                } else {
                    dupes.push(table.id);
                }
            }
        });

        // Ordenar naturalmente pelo nome da mesa (Mesa 01, Mesa 02, etc.)
        const sorted = Array.from(map.values()).sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        return { uniqueTables: sorted, duplicateDocIds: dupes };
    }, [rawTables]);

    // Limpa mesas duplicadas no Firestore mantendo apenas uma de cada nome
    const handleCleanDuplicates = async () => {
        if (!restaurantId || !firestore || duplicateDocIds.length === 0) return;
        setIsCleaningDuplicates(true);
        try {
            const deletePromises = duplicateDocIds.map(id => 
                deleteDoc(doc(firestore, `restaurants/${restaurantId}/tables`, id))
            );
            await Promise.all(deletePromises);
            toast({
                title: "Mesas duplicadas removidas!",
                description: `${duplicateDocIds.length} mesas duplicadas foram apagadas do banco de dados.`
            });
        } catch (error: any) {
            console.error("Erro ao limpar mesas duplicadas:", error);
            toast({
                variant: "destructive",
                title: "Erro ao limpar",
                description: "Não foi possível remover algumas mesas duplicadas."
            });
        } finally {
            setIsCleaningDuplicates(false);
        }
    };

    // Apaga todas as mesas para o usuário começar com mesas zeradas
    const handleResetAllTables = async () => {
        if (!restaurantId || !firestore || !rawTables) return;
        setIsCleaningDuplicates(true);
        try {
            const deletePromises = rawTables.map(t => 
                deleteDoc(doc(firestore, `restaurants/${restaurantId}/tables`, t.id))
            );
            await Promise.all(deletePromises);
            toast({
                title: "Mesas zeradas com sucesso!",
                description: "Todas as mesas foram removidas. Agora você pode cadastrar suas próprias mesas."
            });
            setIsResetDialogOpen(false);
        } catch (error: any) {
            console.error("Erro ao zerar mesas:", error);
            toast({
                variant: "destructive",
                title: "Erro ao zerar mesas",
                description: "Ocorreu um erro ao excluir as mesas."
            });
        } finally {
            setIsCleaningDuplicates(false);
        }
    };

    const handleCreateCustomTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId || !firestore) return;
        const nameToUse = newTableName.trim() || `Mesa ${(uniqueTables.length + 1).toString().padStart(2, '0')}`;

        try {
            await addDoc(collection(firestore, `restaurants/${restaurantId}/tables`), {
                name: nameToUse,
                status: 'livre',
                restaurantId,
                qrCodeUrl: '',
                createdAt: serverTimestamp()
            });
            toast({ title: `Mesa "${nameToUse}" criada!` });
            setNewTableName('');
            setIsNewTableDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao criar mesa" });
        }
    };

    if (isLoading || isTablesLoading) return <Skeleton className="h-screen w-full" />;

    const totalCount = uniqueTables.length;
    const freeCount = uniqueTables.filter(t => t.status === 'livre').length;
    const occupiedCount = uniqueTables.filter(t => t.status === 'ocupada' || t.status === 'fechando').length;

    const filteredTables = uniqueTables.filter(t => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'livre') return t.status === 'livre';
        if (statusFilter === 'ocupada') return t.status === 'ocupada' || t.status === 'fechando';
        return true;
    });

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl overflow-hidden shadow-xs ring-1 ring-primary/20 shrink-0 bg-primary/10 flex items-center justify-center">
                        <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <h1 className="text-xl font-black">Mesas do Salão</h1>
                </div>
                {isAdmin && (
                    <div className="ml-auto flex items-center gap-2">
                        <Button 
                            onClick={() => {
                                setNewTableName(`Mesa ${(uniqueTables.length + 1).toString().padStart(2, '0')}`);
                                setIsNewTableDialogOpen(true);
                            }} 
                            className="font-bold gap-1.5 h-9 sm:h-10 px-3 sm:px-4"
                        >
                            <PlusCircle className="h-4 w-4" /> 
                            <span>Nova Mesa</span>
                        </Button>
                    </div>
                )}
            </AppHeader>

            {/* Aviso de duplicados caso existam no banco com ação rápida */}
            {duplicateDocIds.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>
                            Foram detectadas <strong>{duplicateDocIds.length} mesas duplicadas</strong> no banco de dados. Na visualização abaixo elas já foram unificadas.
                        </span>
                    </div>
                    <Button 
                        size="sm" 
                        variant="link" 
                        onClick={handleCleanDuplicates}
                        disabled={isCleaningDuplicates}
                        className="text-xs font-bold text-amber-900 underline p-0 h-auto"
                    >
                        Remover do Banco
                    </Button>
                </div>
            )}

            {/* Barra de filtros rápidos */}
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 overflow-x-auto">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'all'
                            ? "bg-foreground text-background border-foreground shadow-xs"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                >
                    <LayoutGrid className="h-4 w-4" />
                    Todas ({totalCount})
                </button>

                <button
                    onClick={() => setStatusFilter('livre')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'livre'
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-background text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    )}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Livres ({freeCount})
                </button>

                <button
                    onClick={() => setStatusFilter('ocupada')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                        statusFilter === 'ocupada'
                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                            : "bg-background text-red-700 border-red-200 hover:bg-red-50"
                    )}
                >
                    <Users className="h-4 w-4" />
                    Ocupadas ({occupiedCount})
                </button>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {uniqueTables.length === 0 ? (
                    <div className="max-w-md mx-auto my-12 text-center p-8 border-2 border-dashed rounded-3xl bg-muted/20">
                        <div className="size-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
                            <PlusCircle className="size-8" />
                        </div>
                        <h3 className="text-xl font-bold mb-1">Nenhuma mesa cadastrada</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            As mesas agora iniciam zeradas. Adicione suas próprias mesas com o número ou nome desejado (ex: Mesa 01, Varanda 02, Balcão).
                        </p>
                        <Button 
                            onClick={() => {
                                setNewTableName('Mesa 01');
                                setIsNewTableDialogOpen(true);
                            }}
                            className="font-bold gap-2 px-6"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Cadastrar Primeira Mesa
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredTables.map((table) => (
                            <TableCard key={table.id} table={table} />
                        ))}
                        {filteredTables.length === 0 && (
                            <div className="col-span-full text-center py-16 text-muted-foreground">
                                <p className="text-base font-semibold">Nenhuma mesa encontrada neste filtro.</p>
                                <Button 
                                    variant="outline" 
                                    className="mt-3 font-bold" 
                                    onClick={() => setStatusFilter('all')}
                                >
                                    Mostrar Todas as Mesas
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal para Adicionar Mesa com Nome Personalizado */}
            <Dialog open={isNewTableDialogOpen} onOpenChange={setIsNewTableDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleCreateCustomTable}>
                        <DialogHeader>
                            <DialogTitle>Adicionar Nova Mesa</DialogTitle>
                            <DialogDescription>
                                Digite a identificação da mesa (ex: Mesa 01, Salão 05, Varanda 02).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label htmlFor="tableName">Nome da Mesa</Label>
                            <Input
                                id="tableName"
                                value={newTableName}
                                onChange={(e) => setNewTableName(e.target.value)}
                                placeholder="Ex: Mesa 01"
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsNewTableDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="font-bold">
                                Salvar Mesa
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog de Confirmação para Zerar Mesas */}
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Zerar todas as mesas?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso removerá todas as mesas cadastradas no restaurante para que você possa recomeçar do zero. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCleaningDuplicates}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleResetAllTables}
                            disabled={isCleaningDuplicates}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                        >
                            {isCleaningDuplicates ? "Zerando..." : "Sim, Zerar Mesas"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

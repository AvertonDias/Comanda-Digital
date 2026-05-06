'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User as UserIcon, PlusCircle, Trash2, Printer as PrinterIcon, Wifi, Usb, Bluetooth, AlertCircle, Info, Edit2, HelpCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, doc, query, where, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import type { UserProfile, RestaurantUserRole, PrintSector, Printer, PrinterConnectionType } from "@/lib/types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const profileSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

function formatPhone(value: string) {
    const v = value.replace(/\D/g, '');
    if (v.length <= 2) return v;
    if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
    if (v.length <= 11) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)} ${v.slice(7)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)} ${v.slice(7, 11)}`;
}

/* ================= PROFILE ================= */

function ProfileTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const restaurantRef = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return doc(firestore, "restaurants", restaurantId);
    }, [firestore, restaurantId]);

    const { data, isLoading } = useDoc(restaurantRef ?? undefined);

    const { register, handleSubmit, reset, setValue } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
    });

    useEffect(() => {
        if (data) {
            reset({
                name: data.name || '',
                phone: data.phone || '',
            });
        }
    }, [data, reset]);

    const onSubmit = (form: ProfileFormData) => {
        if (!restaurantRef) return;
        updateDoc(restaurantRef, form).catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: restaurantRef.path,
                operation: 'update',
            }));
        });
        toast({ title: "Perfil atualizado!" });
    };

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    return (
        <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Perfil do Restaurante</CardTitle>
                    <CardDescription>Informações básicas que aparecem para seus clientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome do Estabelecimento</Label>
                        <Input {...register("name")} placeholder="Ex: Pizzaria do Zé" />
                    </div>
                    <div className="space-y-2">
                        <Label>Telefone de Contato</Label>
                        <Input
                            {...register("phone")}
                            placeholder="(xx) x xxxx xxxx"
                            onChange={(e) => {
                                const formatted = formatPhone(e.target.value);
                                setValue("phone", formatted);
                            }}
                        />
                    </div>
                    <Button type="submit">Salvar Alterações</Button>
                </CardContent>
            </form>
        </Card>
    );
}

/* ================= USERS ================= */

function UsersTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [editingUser, setEditingUser] = useState<any>(null);
    const [deletingUser, setDeletingUser] = useState<any>(null);

    // Consulta protegida na subcoleção de roles do restaurante
    const usersQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        // Nota: as regras permitem ler os papéis se você for admin do restaurante
        return query(collection(firestore, `restaurants/${restaurantId}/roles`));
    }, [firestore, restaurantId]);

    // Fallback: se a consulta acima falhar por regras, usamos o método blindado de busca de equipe
    const { data: users, isLoading } = useCollection(usersQuery ?? undefined);

    const handleUpdateRole = async (userId: string, newRole: 'admin' | 'waiter') => {
        const docRef = doc(firestore, `users/${userId}/restaurantRoles/${restaurantId}`);
        await updateDoc(docRef, { role: newRole });
        toast({ title: "Função atualizada!" });
        setEditingUser(null);
    };

    const handleDeleteMember = async () => {
        if (!deletingUser) return;
        const docRef = doc(firestore, `users/${deletingUser.userId}/restaurantRoles/${restaurantId}`);
        await deleteDoc(docRef);
        toast({ title: "Membro removido da equipe." });
        setDeletingUser(null);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestão de Equipe</CardTitle>
                <CardDescription>Gerencie quem tem acesso ao sistema e suas permissões.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-32" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users?.map((u: any) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.email || u.userId}</TableCell>
                                    <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                                    <TableCell><Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "Ativo" : "Inativo"}</Badge></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingUser(u)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum membro cadastrado.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Membro</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <Label>Nova Função</Label>
                        <Select defaultValue={editingUser?.role} onValueChange={(val) => handleUpdateRole(editingUser.userId, val as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="waiter">Garçom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                        <AlertDialogDescription>O usuário perderá o acesso a este restaurante imediatamente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-white">Remover</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

/* ================= PRINTING ================= */

function PrintingTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSectorDialogOpen, setIsSectorDialogOpen] = useState(false);
    const [isPrinterDialogOpen, setIsPrinterDialogOpen] = useState(false);
    const [newSectorName, setNewSectorName] = useState("");
    const [editingSector, setEditingSector] = useState<any>(null);
    const [editingPrinter, setEditingPrinter] = useState<any>(null);
    const [deletingSector, setDeletingSector] = useState<any>(null);
    const [deletingPrinter, setDeletingPrinter] = useState<any>(null);

    const sectorsQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printSectors`));
    }, [firestore, restaurantId]);

    const printersQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printers`));
    }, [firestore, restaurantId]);

    const { data: sectors } = useCollection(sectorsQuery ?? undefined);
    const { data: printers } = useCollection(printersQuery ?? undefined);

    const handleSaveSector = async () => {
        if (!newSectorName) return;
        if (editingSector) {
            await updateDoc(doc(firestore, `restaurants/${restaurantId}/printSectors`, editingSector.id), { name: newSectorName });
            toast({ title: "Setor atualizado!" });
        } else {
            await addDoc(collection(firestore, `restaurants/${restaurantId}/printSectors`), { name: newSectorName, restaurantId });
            toast({ title: "Setor adicionado!" });
        }
        setNewSectorName("");
        setIsSectorDialogOpen(false);
        setEditingSector(null);
    };

    const handleDeleteSector = async () => {
        if (!deletingSector) return;
        await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printSectors`, deletingSector.id));
        toast({ title: "Setor removido." });
        setDeletingSector(null);
    };

    const handleDeletePrinter = async () => {
        if (!deletingPrinter) return;
        await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printers`, deletingPrinter.id));
        toast({ title: "Impressora removida." });
        setDeletingPrinter(null);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Setores de Impressão</CardTitle>
                        <CardDescription>Cozinha, Bar, Copa, etc.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingSector(null); setNewSectorName(""); setIsSectorDialogOpen(true); }} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Novo Setor</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {sectors?.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingSector(s); setNewSectorName(s.name); setIsSectorDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingSector(s)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Impressoras</CardTitle>
                        <CardDescription>Dispositivos físicos vinculados aos setores.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingPrinter(null); setIsPrinterDialogOpen(true); }} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Nova Impressora</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Conexão</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers?.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="capitalize">{p.connectionType}</TableCell>
                                    <TableCell className="font-mono text-xs">{p.address}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingPrinter(p); setIsPrinterDialogOpen(true); }}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingPrinter(p)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* DIALOGS */}
            <Dialog open={isSectorDialogOpen} onOpenChange={setIsSectorDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSector ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <Label>Nome do Setor</Label>
                        <Input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} placeholder="Ex: Cozinha" />
                    </div>
                    <DialogFooter><Button onClick={handleSaveSector}>{editingSector ? "Atualizar" : "Adicionar"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* TODO: Implementar Modal de Edição de Impressora similar ao de setor */}

            <AlertDialog open={!!deletingSector} onOpenChange={() => setDeletingSector(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
                        <AlertDialogDescription>Itens vinculados a este setor deixarão de ser impressos corretamente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSector} className="bg-destructive text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deletingPrinter} onOpenChange={() => setDeletingPrinter(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir impressora?</AlertDialogTitle>
                        <AlertDialogDescription>Esta impressora parará de receber pedidos de produção.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePrinter} className="bg-destructive text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function SettingsPage() {
    const { restaurantId, isLoading, hasRestaurant } = useRestaurant();

    if (isLoading) return <Skeleton className="h-screen w-full" />;
    if (!hasRestaurant || !restaurantId) return <div className="p-8 text-center">Restaurante não configurado.</div>;

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger />
                <h1 className="text-xl font-semibold">Configurações</h1>
            </AppHeader>
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="users">Equipe</TabsTrigger>
                        <TabsTrigger value="printing">Impressão</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile"><ProfileTab restaurantId={restaurantId} /></TabsContent>
                    <TabsContent value="users"><UsersTab restaurantId={restaurantId} /></TabsContent>
                    <TabsContent value="printing"><PrintingTab restaurantId={restaurantId} /></TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
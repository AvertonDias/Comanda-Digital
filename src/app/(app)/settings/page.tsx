
'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Edit2, Trash2, PlusCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const profileSchema = z.object({
    name: z.string().min(1, "Obrigatório"),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

function formatPhone(value: string) {
    if (!value) return "";
    const v = value.replace(/\D/g, '');
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
    if (v.length <= 11) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)} ${v.slice(7)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)} ${v.slice(7, 11)}`;
}

/* ================= PROFILE ================= */

function ProfileTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const restaurantRef = useMemoFirebase(() => doc(firestore, "restaurants", restaurantId), [firestore, restaurantId]);
    const { data, isLoading } = useDoc(restaurantRef);
    const { register, handleSubmit, reset, setValue } = useForm<ProfileFormData>({ resolver: zodResolver(profileSchema) });

    useEffect(() => {
        if (data) reset({ name: data.name || '', phone: data.phone || '' });
    }, [data, reset]);

    const onSubmit = (form: ProfileFormData) => {
        updateDoc(restaurantRef, form);
        toast({ title: "Perfil atualizado!" });
    };

    if (isLoading) return <Skeleton className="h-64" />;

    return (
        <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Perfil</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome do Estabelecimento</Label>
                        <Input {...register("name")} />
                    </div>
                    <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input 
                            {...register("phone")} 
                            placeholder="(xx) x xxxx xxxx"
                            onChange={(e) => setValue("phone", formatPhone(e.target.value))} 
                        />
                    </div>
                    <Button type="submit">Salvar</Button>
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

    const teamQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/roles`));
    }, [firestore, restaurantId]);

    const { data: users, isLoading } = useCollection(teamQuery);

    const handleUpdateRole = async (userId: string, newRole: string) => {
        const docRef = doc(firestore, `users/${userId}/restaurantRoles/${restaurantId}`);
        await updateDoc(docRef, { role: newRole });
        toast({ title: "Função atualizada!" });
        setEditingUser(null);
    };

    const handleDelete = async () => {
        if (!deletingUser) return;
        await deleteDoc(doc(firestore, `users/${deletingUser.userId}/restaurantRoles/${restaurantId}`));
        toast({ title: "Removido." });
        setDeletingUser(null);
    };

    return (
        <Card>
            <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-32" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users?.map((u: any) => (
                                <TableRow key={u.id}>
                                    <TableCell>{u.email || u.userId}</TableCell>
                                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingUser(u)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Função</DialogTitle></DialogHeader>
                    {editingUser && (
                        <Select defaultValue={editingUser.role} onValueChange={(val) => handleUpdateRole(editingUser.userId, val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="waiter">Garçom</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remover?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover o acesso deste membro?</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">Sim, Remover</AlertDialogAction>
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
    const [isSecModal, setIsSecModal] = useState(false);
    const [isPriModal, setIsPriModal] = useState(false);
    const [editingSec, setEditingSec] = useState<any>(null);
    const [editingPri, setEditingPri] = useState<any>(null);
    const [delSec, setDelSec] = useState<any>(null);
    const [delPri, setDelPri] = useState<any>(null);
    const [secName, setSecName] = useState("");
    
    const [priName, setPriName] = useState("");
    const [priAddr, setPriAddr] = useState("");
    const [priType, setPriType] = useState<any>("network");

    const sectorsQ = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printSectors`));
    }, [restaurantId, firestore]);

    const printersQ = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printers`));
    }, [restaurantId, firestore]);

    const { data: sectors } = useCollection(sectorsQ);
    const { data: printers } = useCollection(printersQ);

    const handleSaveSec = async () => {
        if (!secName) return;
        const colRef = collection(firestore, `restaurants/${restaurantId}/printSectors`);
        if (editingSec) {
            await updateDoc(doc(colRef, editingSec.id), { name: secName });
        } else {
            await addDoc(colRef, { name: secName, restaurantId });
        }
        setIsSecModal(false);
        setSecName("");
        setEditingSec(null);
        toast({ title: "Setor salvo!" });
    };

    const handleSavePri = async () => {
        if (!priName || !priAddr) return;
        const colRef = collection(firestore, `restaurants/${restaurantId}/printers`);
        const data = {
            name: priName,
            address: priAddr,
            connectionType: priType,
            restaurantId,
            isActive: true,
            printSectors: editingPri?.printSectors || []
        };
        if (editingPri) {
            await updateDoc(doc(colRef, editingPri.id), data);
        } else {
            await addDoc(colRef, data);
        }
        setIsPriModal(false);
        setPriName("");
        setPriAddr("");
        setEditingPri(null);
        toast({ title: "Impressora salva!" });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Setores</CardTitle>
                    <Button onClick={() => { setEditingSec(null); setSecName(""); setIsSecModal(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Novo</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {sectors?.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingSec(s); setSecName(s.name); setIsSecModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDelSec(s)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle>Impressoras</CardTitle>
                        <Popover>
                            <PopoverTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></PopoverTrigger>
                            <PopoverContent className="text-xs">
                                No Windows: Vá em Configurações {'->'} Dispositivos {'->'} Impressoras. O IP ou Nome de Rede aparece nas propriedades do dispositivo.
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={() => { setEditingPri(null); setPriName(""); setPriAddr(""); setIsPriModal(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Nova</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers?.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{p.address}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingPri(p); setPriName(p.name); setPriAddr(p.address); setPriType(p.connectionType); setIsPriModal(true); }}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDelPri(p)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isSecModal} onOpenChange={setIsSecModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSec ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
                    <Input value={secName} onChange={e => setSecName(e.target.value)} placeholder="Ex: Cozinha" />
                    <DialogFooter><Button onClick={handleSaveSec}>Salvar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPriModal} onOpenChange={setIsPriModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingPri ? "Editar Impressora" : "Nova Impressora"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input value={priName} onChange={e => setPriName(e.target.value)} placeholder="Impressora Térmica" />
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={priType} onValueChange={setPriType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="network">Rede (IP)</SelectItem>
                                    <SelectItem value="usb">USB</SelectItem>
                                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Endereço (IP ou Porta)</Label>
                            <Input value={priAddr} onChange={e => setPriAddr(e.target.value)} placeholder="192.168.1.100" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSavePri}>Salvar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!delSec} onOpenChange={() => setDelSec(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Setor?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover este setor de impressão?</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printSectors`, delSec.id)); setDelSec(null); toast({ title: "Setor removido" }); }}>Sim</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!delPri} onOpenChange={() => setDelPri(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Impressora?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover esta impressora do sistema?</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printers`, delPri.id)); setDelPri(null); toast({ title: "Impressora removida" }); }}>Sim</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function SettingsPage() {
    const { restaurantId, isLoading } = useRestaurant();
    if (isLoading) return <Skeleton className="h-screen w-full" />;
    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader><SidebarTrigger /><h1 className="text-xl font-semibold">Configurações</h1></AppHeader>
            <main className="flex-1 p-6 overflow-y-auto">
                <Tabs defaultValue="profile">
                    <TabsList><TabsTrigger value="profile">Perfil</TabsTrigger><TabsTrigger value="users">Equipe</TabsTrigger><TabsTrigger value="printing">Impressão</TabsTrigger></TabsList>
                    <TabsContent value="profile">{restaurantId && <ProfileTab restaurantId={restaurantId} />}</TabsContent>
                    <TabsContent value="users">{restaurantId && <UsersTab restaurantId={restaurantId} />}</TabsContent>
                    <TabsContent value="printing">{restaurantId && <PrintingTab restaurantId={restaurantId} />}</TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

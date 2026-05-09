
'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Edit2, Trash2, PlusCircle, UserPlus, Copy, Link as LinkIcon, Info, Clock, Bike } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const profileSchema = z.object({
    name: z.string().min(1, "Obrigatório"),
    phone: z.string().optional(),
    city: z.string().optional(),
    pixKey: z.string().optional(),
    openingHours: z.string().optional(),
    deliveryFee: z.coerce.number().min(0, "Mínimo 0"),
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

function ProfileTab({ restaurantId, onDirtyChange }: { restaurantId: string, onDirtyChange: (dirty: boolean) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const restaurantRef = useMemoFirebase(() => doc(firestore, "restaurants", restaurantId), [firestore, restaurantId]);
    const { data, isLoading } = useDoc(restaurantRef);
    const { register, handleSubmit, reset, setValue, formState: { isDirty } } = useForm<ProfileFormData>({ 
        resolver: zodResolver(profileSchema),
        defaultValues: { 
            name: '', 
            phone: '', 
            city: '', 
            pixKey: '',
            openingHours: '',
            deliveryFee: 0 
        }
    });

    useEffect(() => {
        onDirtyChange(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        if (data) {
            const initialValues = { 
                name: data.name || '', 
                phone: data.phone || '', 
                city: data.city || '',
                pixKey: data.pixKey || '',
                openingHours: data.openingHours || '',
                deliveryFee: data.deliveryFee || 0
            };
            reset(initialValues);
        }
    }, [data, reset]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const onSubmit = (form: ProfileFormData) => {
        updateDoc(restaurantRef, form);
        toast({ title: "Perfil atualizado!" });
        reset(form);
    };

    if (isLoading) return <Skeleton className="h-64" />;

    return (
        <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Perfil do Estabelecimento</CardTitle>
                    <CardDescription>Gerencie as informações públicas e operacionais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome do Estabelecimento</Label>
                                <Input {...register("name")} placeholder="Ex: Pizzaria do Zé" />
                            </div>
                            <div className="space-y-2">
                                <Label>Telefone de Contato</Label>
                                <Input 
                                    {...register("phone")} 
                                    placeholder="(xx) x xxxx xxxx"
                                    onChange={(e) => setValue("phone", formatPhone(e.target.value), { shouldDirty: true })} 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    Horário de Funcionamento
                                </Label>
                                <Input 
                                    {...register("openingHours")} 
                                    placeholder="Ex: Seg-Sex: 18h às 23h"
                                />
                                <p className="text-[9px] text-muted-foreground uppercase font-bold">
                                    Será exibido no topo do seu cardápio digital.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Bike className="h-3 w-3 text-muted-foreground" />
                                    Taxa de Entrega Padrão (R$)
                                </Label>
                                <Input 
                                    type="number"
                                    step="0.01"
                                    {...register("deliveryFee")} 
                                    placeholder="0,00"
                                />
                                <p className="text-[9px] text-muted-foreground uppercase font-bold">
                                    Somada automaticamente em pedidos de "Entrega".
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 border-t pt-6">
                        <div className="flex items-center gap-2">
                            <Label className="text-primary font-black uppercase text-xs">Dados de Pagamento (Pix)</Label>
                        </div>
                        
                        <Alert variant="default" className="bg-primary/5 border-primary/20">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-[10px] font-black uppercase">Como funciona?</AlertTitle>
                            <AlertDescription className="text-[10px] text-muted-foreground uppercase leading-tight">
                                Cadastre sua chave Pix e cidade abaixo para que o sistema gere automaticamente o QR Code de pagamento ao finalizar pedidos.
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Cidade do Estabelecimento</Label>
                                <Input 
                                    {...register("city")} 
                                    placeholder="Ex: São Paulo"
                                />
                                <p className="text-[9px] text-muted-foreground uppercase font-bold">
                                    Campo obrigatório para o padrão Pix.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Sua Chave Pix</Label>
                                <Input 
                                    {...register("pixKey")} 
                                    placeholder="E-mail, CPF, Celular ou Chave Aleatória"
                                />
                                <p className="text-[9px] text-muted-foreground uppercase font-bold">
                                    Certifique-se de que a chave está correta.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {isDirty && (
                            <p className="text-[10px] text-destructive font-bold uppercase animate-pulse">
                                Você tem alterações não salvas! Clique no botão abaixo.
                            </p>
                        )}
                        <Button type="submit" className="w-full sm:w-auto" disabled={!isDirty}>
                            Salvar Alterações
                        </Button>
                    </div>
                </CardContent>
            </form>
        </Card>
    );
}

function UsersTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [editingUser, setEditingUser] = useState<any>(null);
    const [deletingUser, setDeletingUser] = useState<any>(null);
    const [isInviteModal, setIsInviteModal] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [inviteRole, setInviteRole] = useState("waiter");

    const teamQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/team`));
    }, [firestore, restaurantId]);

    const { data: users, isLoading } = useCollection(teamQuery);

    const handleUpdateRole = async (userId: string, role: string) => {
        const docRef = doc(firestore, `restaurants/${restaurantId}/team/${userId}`);
        await updateDoc(docRef, { role });
        toast({ title: "Função atualizada!" });
        setEditingUser(null);
    };

    const handleGenerateInvite = async () => {
        const colRef = collection(firestore, `restaurants/${restaurantId}/invitations`);
        const inviteDoc = await addDoc(colRef, {
            restaurantId,
            role: inviteRole,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const link = `${origin}/register?invite=${inviteDoc.id}&rest=${restaurantId}`;
        setInviteLink(link);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteLink);
        toast({ title: "Link copiado!" });
    };

    const handleDelete = async () => {
        if (!deletingUser) return;
        const docRef = doc(firestore, `restaurants/${restaurantId}/team/${deletingUser.id}`);
        await deleteDoc(docRef);
        toast({ title: "Membro removido." });
        setDeletingUser(null);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Equipe</CardTitle>
                <Button onClick={() => { setInviteLink(""); setIsInviteModal(true); }} size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Novo Membro
                </Button>
            </CardHeader>
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
                                    <TableCell>
                                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                                            {u.role === 'admin' ? 'Administrador' : 'Garçom'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(u)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingUser(u)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={isInviteModal} onOpenChange={setIsInviteModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Convidar para Equipe</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        {!inviteLink ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Função do novo membro</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Administrador</SelectItem>
                                            <SelectItem value="waiter">Garçom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button className="w-full" onClick={handleGenerateInvite}>
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Gerar Link Único
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Label>Link Gerado (Envie para o colaborador)</Label>
                                <div className="flex gap-2">
                                    <Input value={inviteLink} readOnly />
                                    <Button size="icon" onClick={copyToClipboard}><Copy className="h-4 w-4" /></Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Este link permite que o colaborador se registre como {inviteRole === 'admin' ? 'Administrador' : 'Garçom'}.
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Editar Função</DialogTitle></DialogHeader>
                    {editingUser && (
                        <div className="space-y-4 py-4">
                            <Label>Função para {editingUser.email}</Label>
                            <Select defaultValue={editingUser.role} onValueChange={(val) => handleUpdateRole(editingUser.userId, val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="waiter">Garçom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remover Membro?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover o acesso de "{deletingUser?.email}"? Esta ação é imediata.</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">Sim, Remover</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

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
        if (!restaurantId || !firestore) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printSectors`));
    }, [restaurantId, firestore]);

    const printersQ = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
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
                    <div className="flex flex-col gap-1">
                        <CardTitle>Setores de Impressão</CardTitle>
                        <CardDescription>Cozinha, Bar, Churrasqueira, etc.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingSec(null); setSecName(""); setIsSecModal(true); }} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Novo Setor
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {sectors?.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-bold uppercase text-xs">{s.name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingSec(s); setSecName(s.name); setIsSecModal(true); }}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDelSec(s)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sectors?.length === 0 && <TableRow><TableCell className="text-center py-6 text-muted-foreground text-xs uppercase font-bold">Nenhum setor cadastrado</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle>Impressoras</CardTitle>
                            <CardDescription>Rede (IP) ou USB (Nativo).</CardDescription>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><HelpCircle className="h-4 w-4 text-primary" /></Button></PopoverTrigger>
                            <PopoverContent className="w-80 space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-black uppercase text-xs">Impressora USB (Como a sua)</h4>
                                    <p className="text-[10px] text-muted-foreground leading-tight uppercase font-bold">
                                        Para impressoras conectadas via USB ao computador (como a 80mm Series), não é necessário configurar IP. 
                                        Ao finalizar um pedido, o botão "Imprimir Cupom" abrirá a janela do sistema e você selecionará ela lá.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-black uppercase text-xs">Impressora de Rede (IP)</h4>
                                    <p className="text-[10px] text-muted-foreground leading-tight uppercase font-bold">
                                        Se a impressora estiver ligada no cabo de rede, coloque o IP dela abaixo. O sistema tentará enviar o comando diretamente.
                                    </p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={() => { setEditingPri(null); setPriName(""); setPriAddr(""); setIsPriModal(true); }} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Nova Impressora
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase">Nome</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Endereço/Porta</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers?.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-bold uppercase text-xs">{p.name}</TableCell>
                                    <TableCell className="font-mono text-xs">{p.address}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingPri(p); setPriName(p.name); setPriAddr(p.address); setPriType(p.connectionType); setIsPriModal(true); }}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDelPri(p)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {printers?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-xs uppercase font-bold">Nenhuma impressora configurada</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isSecModal} onOpenChange={setIsSecModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingSec ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Nome do Setor</Label>
                            <Input value={secName} onChange={e => setSecName(e.target.value)} placeholder="Ex: Cozinha" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveSec} className="w-full font-black uppercase">Salvar Setor</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPriModal} onOpenChange={setIsPriModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingPri ? "Editar Impressora" : "Nova Impressora"}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Nome Identificador</Label>
                            <Input value={priName} onChange={e => setPriName(e.target.value)} placeholder="Ex: Impressora do Balcão" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Tipo de Conexão</Label>
                            <Select value={priType} onValueChange={setPriType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="network">Rede (IP)</SelectItem>
                                    <SelectItem value="usb">USB (Sistema Windows)</SelectItem>
                                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase">Endereço (IP ou 'USB')</Label>
                            <Input value={priAddr} onChange={e => setPriAddr(e.target.value)} placeholder="192.168.1.100 ou USB" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSavePri} className="w-full font-black uppercase">Configurar Impressora</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!delSec} onOpenChange={() => setDelSec(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Setor?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover este setor de impressão? Itens vinculados a ele podem precisar de reconfiguração.</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printSectors`, delSec.id)); setDelSec(null); toast({ title: "Setor removido" }); }} className="bg-destructive">Sim, Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!delPri} onOpenChange={() => setDelPri(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir Impressora?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>Deseja remover esta impressora do sistema?</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { await deleteDoc(doc(firestore, `restaurants/${restaurantId}/printers`, delPri.id)); setDelPri(null); toast({ title: "Impressora removida" }); }} className="bg-destructive">Sim, Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function SettingsPage() {
    const { restaurantId, isLoading, role } = useRestaurant();
    const [activeTab, setActiveTab] = useState("profile");
    const [isProfileDirty, setIsProfileDirty] = useState(false);
    const [pendingTab, setPendingTab] = useState<string | null>(null);

    const handleTabChange = (value: string) => {
        if (activeTab === "profile" && isProfileDirty && value !== "profile") {
            setPendingTab(value);
        } else {
            setActiveTab(value);
        }
    };

    if (isLoading) return <Skeleton className="h-screen w-full" />;
    
    if (role === 'waiter') {
        return (
            <div className="flex flex-col h-screen bg-background items-center justify-center">
                <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader><SidebarTrigger /><h1 className="text-xl font-semibold">Configurações</h1></AppHeader>
            <main className="flex-1 p-6 overflow-y-auto">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="users">Equipe</TabsTrigger>
                        <TabsTrigger value="printing">Impressão</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="profile" className="mt-6">
                        {restaurantId && <ProfileTab restaurantId={restaurantId} onDirtyChange={setIsProfileDirty} />}
                    </TabsContent>
                    
                    <TabsContent value="users" className="mt-6">
                        {restaurantId && <UsersTab restaurantId={restaurantId} />}
                    </TabsContent>
                    
                    <TabsContent value="printing" className="mt-6">
                        {restaurantId && <PrintingTab restaurantId={restaurantId} />}
                    </TabsContent>
                </Tabs>

                <AlertDialog open={!!pendingTab} onOpenChange={() => setPendingTab(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você tem alterações pendentes no perfil do estabelecimento. 
                                Se mudar de aba agora, as edições serão perdidas.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Voltar e Salvar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => {
                                    setIsProfileDirty(false);
                                    if (pendingTab) setActiveTab(pendingTab);
                                    setPendingTab(null);
                                }}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Descartar e Mudar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>
        </div>
    );
}

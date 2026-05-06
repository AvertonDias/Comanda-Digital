
'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User as UserIcon, PlusCircle, Trash2, Printer as PrinterIcon, Wifi, Usb, Bluetooth, Check, Settings2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, doc, query, where, updateDoc, collectionGroup, addDoc, deleteDoc } from "firebase/firestore";
import type { UserProfile, RestaurantUserRole, PrintSector, Printer, PrinterConnectionType } from "@/lib/types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const profileSchema = z.object({
    name: z.string().min(1, "O nome do restaurante é obrigatório."),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

function ProfileTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const restaurantRef = useMemoFirebase(() => doc(firestore, "restaurants", restaurantId), [firestore, restaurantId]);
    const { data: restaurantData, isLoading } = useDoc(restaurantRef);

    const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
    });

    useEffect(() => {
        if (restaurantData) {
            reset({
                name: restaurantData.name || '',
                phone: restaurantData.phone || '',
            });
        }
    }, [restaurantData, reset]);

    const onSubmit = (data: ProfileFormData) => {
        updateDoc(restaurantRef, data).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: restaurantRef.path,
                operation: 'update',
                requestResourceData: data
            }));
        });
        toast({ title: "Sucesso!", description: "Perfil do restaurante atualizado." });
    };

    if (isLoading) return <Skeleton className="h-64 w-full" />;

    return (
        <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Perfil do Restaurante</CardTitle>
                    <CardDescription>Atualize as informações do seu estabelecimento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="restaurantName">Nome do Restaurante</Label>
                        <Input id="restaurantName" {...register("name")} />
                        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="restaurantPhone">Telefone de Contato</Label>
                        <Input id="restaurantPhone" {...register("phone")} />
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar Alterações"}</Button>
                    </div>
                </CardContent>
            </form>
        </Card>
    );
}

function UserRow({ userRole }: { userRole: RestaurantUserRole }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const userProfileRef = useMemoFirebase(() => doc(firestore, 'users', userRole.userId), [firestore, userRole.userId]);
    const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

    const handleStatusChange = (isActive: boolean) => {
        const userRoleRef = doc(firestore, `users/${userRole.userId}/restaurantRoles/${userRole.restaurantId}`);
        updateDoc(userRoleRef, { isActive }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRoleRef.path,
                operation: 'update',
                requestResourceData: { isActive }
            }));
        });
        toast({ title: isActive ? "Usuário ativado." : "Usuário inativado." });
    };

    if (isLoading) {
        return (
            <TableRow>
                <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow>
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={userProfile?.avatarUrl} />
                        <AvatarFallback>{userProfile?.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{userProfile?.name || 'Usuário'}</p>
                        <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    {userRole.role === 'admin' ? <Shield className="h-3 w-3 text-primary" /> : <UserIcon className="h-3 w-3" />}
                    <Badge variant="outline" className="capitalize">{userRole.role}</Badge>
                </div>
            </TableCell>
            <TableCell className="text-center">
                <Switch checked={userRole.isActive} onCheckedChange={handleStatusChange} />
            </TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDoc(doc(firestore, `users/${userRole.userId}/restaurantRoles/${userRole.restaurantId}`))}>Remover</Button>
            </TableCell>
        </TableRow>
    );
}

function UsersTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() =>
        query(collectionGroup(firestore, 'restaurantRoles'), where('restaurantId', '==', restaurantId)), 
    [firestore, restaurantId]);

    const { data: userRoles, isLoading } = useCollection<RestaurantUserRole>(usersQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestão de Equipe</CardTitle>
                <CardDescription>Gerencie quem tem acesso ao painel do seu restaurante.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-32 w-full" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead className="text-center">Status Ativo</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userRoles?.map((role) => <UserRow key={`${role.userId}-${role.restaurantId}`} userRole={role} />)}
                            {userRoles?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function PrintingTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newSector, setNewSector] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    // Estados para o formulário de impressora real
    const [printerName, setPrinterName] = useState('');
    const [printerType, setPrinterType] = useState<PrinterConnectionType>('network');
    const [printerAddress, setPrinterAddress] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    
    const sectorsQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printSectors`)), [firestore, restaurantId]);
    const printersQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printers`)), [firestore, restaurantId]);
    
    const { data: sectors, isLoading: isSectorsLoading } = useCollection<PrintSector>(sectorsQuery);
    const { data: printers, isLoading: isPrintersLoading } = useCollection<Printer>(printersQuery);

    const handleAddSector = () => {
        if (!newSector) return;
        const colRef = collection(firestore, `restaurants/${restaurantId}/printSectors`);
        addDoc(colRef, { name: newSector, restaurantId }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: colRef.path, operation: 'create' }));
        });
        setNewSector('');
        toast({ title: "Setor adicionado." });
    };

    const handleDeleteSector = (id: string) => {
        const docRef = doc(firestore, `restaurants/${restaurantId}/printSectors`, id);
        deleteDoc(docRef).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        });
        toast({ title: "Setor removido." });
    };

    const handleSavePrinter = () => {
        if (!printerName || !printerAddress || !restaurantId) {
            toast({ variant: "destructive", title: "Dados incompletos", description: "Preencha o nome e o endereço da impressora." });
            return;
        }

        const colRef = collection(firestore, `restaurants/${restaurantId}/printers`);
        const printerData = {
            name: printerName,
            connectionType: printerType,
            address: printerAddress,
            restaurantId,
            printSectors: selectedSectors,
            isActive: true,
        };

        addDoc(colRef, printerData).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: colRef.path, operation: 'create', requestResourceData: printerData }));
        });

        toast({ title: "Impressora cadastrada!" });
        setIsDialogOpen(false);
        resetPrinterForm();
    };

    const resetPrinterForm = () => {
        setPrinterName('');
        setPrinterType('network');
        setPrinterAddress('');
        setSelectedSectors([]);
    };

    const toggleSector = (id: string) => {
        setSelectedSectors(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const getConnectionIcon = (type: PrinterConnectionType) => {
        switch (type) {
            case 'network': return <Wifi className="h-4 w-4" />;
            case 'usb': return <Usb className="h-4 w-4" />;
            case 'bluetooth': return <Bluetooth className="h-4 w-4" />;
            default: return <PrinterIcon className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Setores de Impressão</CardTitle>
                    <CardDescription>Crie setores para direcionar pedidos (ex: Cozinha, Bar, Pizzaria).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nome do Setor" value={newSector} onChange={e => setNewSector(e.target.value)} />
                        <Button onClick={handleAddSector}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sectors?.map(s => (
                            <Badge key={s.id} variant="secondary" className="px-3 py-1 flex items-center gap-2">
                                {s.name}
                                <button onClick={() => handleDeleteSector(s.id)} className="hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {sectors?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Impressoras</CardTitle>
                        <CardDescription>Gerencie as impressoras térmicas vinculadas aos seus setores.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Cadastrar Impressora
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Conexão</TableHead>
                                <TableHead>Endereço / ID</TableHead>
                                <TableHead>Setores</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers?.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <PrinterIcon className="h-4 w-4 text-muted-foreground" />
                                        {p.name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-xs capitalize">
                                            {getConnectionIcon(p.connectionType)}
                                            {p.connectionType === 'network' ? 'Rede/IP' : p.connectionType}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{p.address}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {p.printSectors.map(sId => {
                                                const sector = sectors?.find(s => s.id === sId);
                                                return <Badge key={sId} variant="outline" className="text-[10px]">{sector?.name || sId}</Badge>;
                                            })}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "Online" : "Offline"}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => deleteDoc(doc(firestore, `restaurants/${restaurantId}/printers`, p.id))}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {printers?.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma impressora cadastrada.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Nova Impressora</DialogTitle>
                        <DialogDescription>
                            Insira os dados reais do seu dispositivo de impressão.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome da Impressora</Label>
                            <Input placeholder="Ex: Cozinha Principal" value={printerName} onChange={e => setPrinterName(e.target.value)} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Conexão</Label>
                                <Select value={printerType} onValueChange={(v) => setPrinterType(v as PrinterConnectionType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="network">Rede (IP)</SelectItem>
                                        <SelectItem value="usb">USB</SelectItem>
                                        <SelectItem value="bluetooth">Bluetooth</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{printerType === 'network' ? 'Endereço IP' : 'Endereço/ID'}</Label>
                                <Input 
                                    placeholder={printerType === 'network' ? '192.168.1.100' : 'ID do dispositivo'} 
                                    value={printerAddress} 
                                    onChange={e => setPrinterAddress(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm">Vincular aos Setores de Impressão</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {sectors?.map(s => (
                                    <div key={s.id} className="flex items-center space-x-2 border p-2 rounded-md">
                                        <Checkbox 
                                            id={`sector-config-${s.id}`} 
                                            checked={selectedSectors.includes(s.id)} 
                                            onCheckedChange={() => toggleSector(s.id)}
                                        />
                                        <label htmlFor={`sector-config-${s.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                            {s.name}
                                        </label>
                                    </div>
                                ))}
                                {sectors?.length === 0 && (
                                    <p className="text-xs text-muted-foreground col-span-2">Cadastre setores primeiro na aba acima.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetPrinterForm(); }}>Cancelar</Button>
                        <Button onClick={handleSavePrinter} disabled={!printerName || !printerAddress}>
                            Salvar Impressora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function SettingsPage() {
    const { restaurantId, isLoading, hasRestaurant } = useRestaurant();

    if (isLoading) return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;

    if (!hasRestaurant) {
        return (
            <div className="flex flex-col h-screen bg-background">
                <AppHeader><SidebarTrigger className="md:hidden" /><h1 className="text-xl font-semibold">Configurações</h1></AppHeader>
                <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-xl mb-4 text-muted-foreground">Você ainda não possui um restaurante vinculado.</p>
                    <Button asChild><a href="/register">Criar meu Restaurante</a></Button>
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader><SidebarTrigger className="md:hidden" /><h1 className="text-xl font-semibold">Configurações</h1></AppHeader>
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="users">Equipe</TabsTrigger>
                        <TabsTrigger value="printing">Impressão</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile"><ProfileTab restaurantId={restaurantId!} /></TabsContent>
                    <TabsContent value="users"><UsersTab restaurantId={restaurantId!} /></TabsContent>
                    <TabsContent value="printing"><PrintingTab restaurantId={restaurantId!} /></TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

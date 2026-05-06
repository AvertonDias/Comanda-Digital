
'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User as UserIcon, PlusCircle, Trash2, Printer as PrinterIcon, Wifi, Usb, Bluetooth, AlertCircle, Info, Edit2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const profileSchema = z.object({
    name: z.string().min(1, "O nome do restaurante é obrigatório."),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

function formatPhone(value: string) {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, "");
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 3) return phoneNumber;
    if (phoneNumberLength < 7) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2)}`;
    if (phoneNumberLength < 11) return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 6)}-${phoneNumber.slice(6)}`;
    return `(${phoneNumber.slice(0, 2)}) ${phoneNumber.slice(2, 3)} ${phoneNumber.slice(3, 7)} ${phoneNumber.slice(7, 11)}`;
}

function ProfileTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const restaurantRef = useMemoFirebase(() => doc(firestore, "restaurants", restaurantId), [firestore, restaurantId]);
    const { data: restaurantData, isLoading } = useDoc(restaurantRef);

    const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = useForm<ProfileFormData>({
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

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
        setValue("phone", formatted);
    };

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
                        <Input 
                            id="restaurantPhone" 
                            {...register("phone")} 
                            onChange={handlePhoneChange}
                            placeholder="(xx) x xxxx xxxx"
                        />
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
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [newRole, setNewRole] = useState(userRole.role);
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

    const handleUpdateRole = () => {
        const userRoleRef = doc(firestore, `users/${userRole.userId}/restaurantRoles/${userRole.restaurantId}`);
        updateDoc(userRoleRef, { role: newRole }).then(() => {
            toast({ title: "Função atualizada!" });
            setIsEditDialogOpen(false);
        }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRoleRef.path,
                operation: 'update',
                requestResourceData: { role: newRole }
            }));
        });
    };

    const handleDeleteUserRole = () => {
        deleteDoc(doc(firestore, `users/${userRole.userId}/restaurantRoles/${userRole.restaurantId}`)).then(() => {
            toast({ title: "Usuário removido da equipe." });
        });
        setIsDeleteDialogOpen(false);
    };

    if (isLoading) {
        return (
            <TableRow>
                <TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell>
            </TableRow>
        );
    }

    return (
        <>
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
                <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Editar Função</DialogTitle>
                        <DialogDescription>Altere a função de {userProfile?.name} na equipe.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Nova Função</Label>
                        <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrador (Total)</SelectItem>
                                <SelectItem value="waiter">Garçom (Operação)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateRole}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover da Equipe?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação removerá o acesso de {userProfile?.name} a este restaurante.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUserRole} className="bg-destructive hover:bg-destructive/90 text-white">Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function UsersTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collectionGroup(firestore, 'restaurantRoles'), where('restaurantId', '==', restaurantId));
    }, [firestore, restaurantId]);

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
    const [editingSector, setEditingSector] = useState<PrintSector | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
    const [sectorToDelete, setSectorToDelete] = useState<PrintSector | null>(null);
    const [printerToDelete, setPrinterToDelete] = useState<Printer | null>(null);
    
    const [printerName, setPrinterName] = useState('');
    const [printerType, setPrinterType] = useState<PrinterConnectionType>('network');
    const [printerAddress, setPrinterAddress] = useState('');
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    
    const sectorsQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printSectors`));
    }, [firestore, restaurantId]);

    const printersQuery = useMemoFirebase(() => {
        if (!restaurantId) return null;
        return query(collection(firestore, `restaurants/${restaurantId}/printers`));
    }, [firestore, restaurantId]);
    
    const { data: sectors, isLoading: isSectorsLoading } = useCollection<PrintSector>(sectorsQuery);
    const { data: printers, isLoading: isPrintersLoading } = useCollection<Printer>(printersQuery);

    const handleSaveSector = () => {
        if (!newSector) return;
        if (editingSector) {
            const docRef = doc(firestore, `restaurants/${restaurantId}/printSectors`, editingSector.id);
            updateDoc(docRef, { name: newSector }).catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
            });
            toast({ title: "Setor atualizado." });
        } else {
            const colRef = collection(firestore, `restaurants/${restaurantId}/printSectors`);
            addDoc(colRef, { name: newSector, restaurantId }).catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: colRef.path, operation: 'create' }));
            });
            toast({ title: "Setor adicionado." });
        }
        setNewSector('');
        setEditingSector(null);
    };

    const handleDeleteSector = () => {
        if (!sectorToDelete) return;
        const docRef = doc(firestore, `restaurants/${restaurantId}/printSectors`, sectorToDelete.id);
        deleteDoc(docRef).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        });
        toast({ title: "Setor removido." });
        setSectorToDelete(null);
    };

    const handleSavePrinter = () => {
        if (!printerName || !printerAddress || !restaurantId) {
            toast({ variant: "destructive", title: "Dados incompletos", description: "Preencha o nome e o endereço da impressora." });
            return;
        }

        const printerData = {
            name: printerName,
            connectionType: printerType,
            address: printerAddress,
            restaurantId,
            printSectors: selectedSectors,
            isActive: true,
        };

        if (editingPrinterId) {
            const docRef = doc(firestore, `restaurants/${restaurantId}/printers`, editingPrinterId);
            updateDoc(docRef, printerData).catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: printerData }));
            });
            toast({ title: "Impressora atualizada!" });
        } else {
            const colRef = collection(firestore, `restaurants/${restaurantId}/printers`);
            addDoc(colRef, printerData).catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: colRef.path, operation: 'create', requestResourceData: printerData }));
            });
            toast({ title: "Impressora cadastrada!" });
        }

        setIsDialogOpen(false);
        resetPrinterForm();
    };

    const handleEditPrinter = (printer: Printer) => {
        setEditingPrinterId(printer.id);
        setPrinterName(printer.name);
        setPrinterType(printer.connectionType);
        setPrinterAddress(printer.address);
        setSelectedSectors(printer.printSectors);
        setIsDialogOpen(true);
    };

    const handleDeletePrinter = () => {
        if (!printerToDelete) return;
        deleteDoc(doc(firestore, `restaurants/${restaurantId}/printers`, printerToDelete.id)).then(() => {
            toast({ title: "Impressora removida." });
        });
        setPrinterToDelete(null);
    };

    const resetPrinterForm = () => {
        setEditingPrinterId(null);
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
            <Alert variant="default" className="bg-primary/5 border-primary/20">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle>Configuração Profissional</AlertTitle>
                <AlertDescription>
                    Configure suas impressoras reais para imprimir comandos automaticamente em cada setor.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Setores de Impressão</CardTitle>
                    <CardDescription>Defina locais como Cozinha, Bar, Churrasqueira.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Ex: Cozinha" value={newSector} onChange={e => setNewSector(e.target.value)} />
                        <Button onClick={handleSaveSector}>
                            {editingSector ? <><Edit2 className="mr-2 h-4 w-4" /> Atualizar</> : <><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</>}
                        </Button>
                        {editingSector && <Button variant="ghost" onClick={() => {setEditingSector(null); setNewSector('');}}>Cancelar</Button>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sectors?.map(s => (
                            <Badge key={s.id} variant="secondary" className="px-3 py-1 flex items-center gap-2">
                                {s.name}
                                <div className="flex items-center gap-1">
                                    <button onClick={() => {setEditingSector(s); setNewSector(s.name);}} className="hover:text-primary transition-colors">
                                        <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => setSectorToDelete(s)} className="hover:text-destructive transition-colors">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Impressoras Reais</CardTitle>
                        <CardDescription>Dispositivos físicos vinculados ao sistema.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { resetPrinterForm(); setIsDialogOpen(true); }}>
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
                                            {p.connectionType}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{p.address}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {p.printSectors.map(sId => {
                                                const sector = sectors?.find(s => s.id === sId);
                                                return <Badge key={sId} variant="outline" className="text-[10px]">{sector?.name || 'Setor'}</Badge>;
                                            })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => handleEditPrinter(p)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setPrinterToDelete(p)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {printers?.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">Nenhuma impressora configurada.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Setor Deletion Alert */}
            <AlertDialog open={!!sectorToDelete} onOpenChange={(open) => !open && setSectorToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Setor?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação removerá o setor "{sectorToDelete?.name}". Certifique-se de que não há itens vinculados a ele.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSector} className="bg-destructive hover:bg-destructive/90 text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Printer Deletion Alert */}
            <AlertDialog open={!!printerToDelete} onOpenChange={(open) => !open && setPrinterToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Impressora?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação removerá a configuração da impressora "{printerToDelete?.name}".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePrinter} className="bg-destructive hover:bg-destructive/90 text-white">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingPrinterId ? 'Editar Impressora' : 'Configurar Impressora'}</DialogTitle>
                        <DialogDescription>Vincule uma impressora do seu sistema ou rede local.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome da Impressora</Label>
                            <Input placeholder="Ex: Impressora Cozinha" value={printerName} onChange={e => setPrinterName(e.target.value)} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipo de Conexão</Label>
                                <Select value={printerType} onValueChange={(v) => setPrinterType(v as PrinterConnectionType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="network">Rede (IP)</SelectItem>
                                        <SelectItem value="usb">USB (Local)</SelectItem>
                                        <SelectItem value="bluetooth">Bluetooth</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>{printerType === 'network' ? 'IP' : 'ID/Nome'}</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 text-xs">
                                            {printerType === 'network' 
                                                ? 'O IP pode ser encontrado na página de teste da impressora (Self-Test).' 
                                                : 'Para USB, use o nome exato no Painel de Controle do Windows.'}
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Input placeholder={printerType === 'network' ? '192.168.1.100' : 'TM-T20'} value={printerAddress} onChange={e => setPrinterAddress(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm">Vincular a Setores</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {sectors?.map(s => (
                                    <div key={s.id} className="flex items-center space-x-2 border p-2 rounded-md">
                                        <Checkbox id={`s-${s.id}`} checked={selectedSectors.includes(s.id)} onCheckedChange={() => toggleSector(s.id)} />
                                        <label htmlFor={`s-${s.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">{s.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSavePrinter} disabled={!printerName || !printerAddress}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function SettingsPage() {
    const { restaurantId, isLoading, hasRestaurant } = useRestaurant();

    if (isLoading) return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;

    if (!hasRestaurant) return <div className="p-8 text-center">Nenhum restaurante vinculado.</div>;

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

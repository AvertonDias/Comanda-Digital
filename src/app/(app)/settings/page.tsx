'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreVertical, Shield, User as UserIcon, Printer as PrinterIcon, LayoutGrid, PlusCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useFirestore, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, doc, query, where, updateDoc, collectionGroup, addDoc, serverTimestamp } from "firebase/firestore";
import type { UserProfile, RestaurantUserRole, PrintSector, Printer } from "@/lib/types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant } from "@/hooks/use-restaurant";

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
        updateDoc(restaurantRef, data).catch(async (error) => {
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
                        <Label htmlFor="restaurantPhone">Telefone</Label>
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
        const updateData = { isActive };
        
        updateDoc(userRoleRef, updateData).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRoleRef.path,
                operation: 'update',
                requestResourceData: updateData
            }));
        });
        toast({ title: "Status atualizado." });
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>Editar Permissões</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Remover Usuário</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
    
    const sectorsQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printSectors`)), [firestore, restaurantId]);
    const printersQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printers`)), [firestore, restaurantId]);
    
    const { data: sectors, isLoading: isSectorsLoading } = useCollection<PrintSector>(sectorsQuery);
    const { data: printers, isLoading: isPrintersLoading } = useCollection<Printer>(printersQuery);

    const handleAddSector = () => {
        if (!newSector) return;
        const colRef = collection(firestore, `restaurants/${restaurantId}/printSectors`);
        addDoc(colRef, { name: newSector, restaurantId }).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: colRef.path, operation: 'create' }));
        });
        setNewSector('');
        toast({ title: "Setor adicionado." });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Setores de Impressão</CardTitle>
                    <CardDescription>Crie setores para direcionar pedidos (ex: Cozinha, Bar).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nome do Setor" value={newSector} onChange={e => setNewSector(e.target.value)} />
                        <Button onClick={handleAddSector}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {sectors?.map(s => (
                            <Badge key={s.id} variant="secondary" className="px-3 py-1 flex justify-between gap-2">
                                {s.name}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Impressoras</CardTitle>
                    <CardDescription>Gerencie as impressoras físicas da sua rede.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers?.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.ipAddress}</TableCell>
                                    <TableCell><Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "Online" : "Offline"}</Badge></TableCell>
                                </TableRow>
                            ))}
                            {printers?.length === 0 && (
                                <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhuma impressora configurada.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
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
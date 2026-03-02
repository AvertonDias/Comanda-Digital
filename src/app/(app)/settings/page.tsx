'use client';

import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, MoreVertical } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where, updateDoc, collectionGroup } from "firebase/firestore";
import type { UserProfile, RestaurantUserRole, Printer, MenuItemCategory, PrintSector } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

// Hook to get the current user's active restaurant and role
function useUserRestaurant() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/restaurantRoles`));
    }, [user, firestore]);

    const { data: roles, isLoading: areRolesLoading } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        return {
            id: roles[0].restaurantId,
            role: roles[0].role,
        };
    }, [roles]);

    return { restaurantInfo, isLoading: isUserLoading || areRolesLoading };
}

// ============== PROFILE TAB ==============
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

    const onSubmit = async (data: ProfileFormData) => {
        try {
            await updateDoc(restaurantRef, data);
            toast({ title: "Sucesso!", description: "Perfil do restaurante atualizado." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro!", description: "Não foi possível salvar as alterações." });
        }
    };

    if (isLoading) {
        return <Card>
            <CardHeader><CardTitle>Perfil do Restaurante</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    }

    return (
        <Card>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Perfil do Restaurante</CardTitle>
                    <CardDescription>
                        Atualize as informações do seu estabelecimento.
                    </CardDescription>
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


// ============== USERS TAB ==============

function UserRow({ userRole }: { userRole: RestaurantUserRole & { id: string } }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const userProfileRef = useMemoFirebase(() => doc(firestore, 'users', userRole.userId), [firestore, userRole.userId]);
    const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

    const handleStatusChange = async (isActive: boolean) => {
        const userRoleRef = doc(firestore, `users/${userRole.userId}/restaurantRoles/${userRole.restaurantId}`);
        try {
            await updateDoc(userRoleRef, { isActive });
            toast({ title: "Status do usuário atualizado." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao atualizar status." });
        }
    };
    
    const name = userProfile?.name || 'Carregando...';
    const email = userProfile?.email || '...';
    const avatarUrl = userProfile?.avatarUrl;
    const fallback = name ? name.charAt(0).toUpperCase() : 'U';

    if (isLoadingProfile) {
        return (
            <>
                <Card className="md:hidden"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
                <TableRow className="hidden md:table-row">
                    <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
            </>
        );
    }
    
    return (
        <>
            {/* Mobile Card */}
            <Card className="md:hidden">
                <CardHeader className="flex flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{name}</p>
                            <p className="text-sm text-muted-foreground">{email}</p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" disabled>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Função</span>
                        <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>{userRole.role === 'admin' ? 'Admin' : 'Garçom'}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Switch id={`status-${userRole.userId}`} checked={userRole.isActive} onCheckedChange={handleStatusChange} />
                    </div>
                </CardContent>
            </Card>

            {/* Desktop Row */}
            <TableRow className="hidden md:table-row">
                <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{name}</p>
                            <p className="text-sm text-muted-foreground">{email}</p>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>{userRole.role === 'admin' ? 'Admin' : 'Garçom'}</Badge>
                </TableCell>
                <TableCell className="text-center">
                    <Switch id={`status-desktop-${userRole.userId}`} checked={userRole.isActive} onCheckedChange={handleStatusChange} />
                </TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" disabled>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
        </>
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
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Usuários</CardTitle>
                    <CardDescription>Gerencie os garçons e administradores do sistema.</CardDescription>
                </div>
                <Button className="w-full sm:w-auto" disabled>
                    <PlusCircle className="mr-2 h-4 w-4" />Novo Usuário
                </Button>
            </CardHeader>
            <CardContent>
                 {isLoading && <Skeleton className="h-24 w-full" />}
                 {!isLoading && userRoles?.length === 0 && <p className="text-center text-muted-foreground">Nenhum usuário encontrado.</p>}
                
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {userRoles?.map((role) => <UserRow key={role.userId} userRole={role} />)}
                </div>

                {/* Desktop View */}
                <div className="rounded-lg border hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead><span className="sr-only">Ações</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {userRoles?.map((role) => <UserRow key={role.userId} userRole={role} />)}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// ============== PRINTERS TAB ==============

function PrintersTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const printersQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printers`)), [firestore, restaurantId]);
    const { data: printers, isLoading: isLoadingPrinters } = useCollection<Printer>(printersQuery);
    
    const sectorsQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/printSectors`)), [firestore, restaurantId]);
    const { data: sectors, isLoading: isLoadingSectors } = useCollection<PrintSector>(sectorsQuery);

    const getSectorNames = (sectorIds: string[]) => {
        if (!sectors || !sectorIds || sectorIds.length === 0) return 'Nenhum';
        return sectorIds
            .map(id => sectors.find(s => s.id === id)?.name)
            .filter(Boolean)
            .join(', ');
    };

    const handleStatusChange = async (printerId: string, isActive: boolean) => {
        const printerRef = doc(firestore, `restaurants/${restaurantId}/printers/${printerId}`);
        try {
            await updateDoc(printerRef, { isActive });
            toast({ title: "Status da impressora atualizado." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao atualizar status." });
        }
    };
    
    const isLoading = isLoadingPrinters || isLoadingSectors;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Impressoras e Setores</CardTitle>
                    <CardDescription>Configure as impressoras e os setores de produção.</CardDescription>
                </div>
                <Button className="w-full sm:w-auto" disabled>
                    <PlusCircle className="mr-2 h-4 w-4" />Nova Impressora
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading && <Skeleton className="h-24 w-full" />}
                {!isLoading && printers?.length === 0 && <p className="text-center text-muted-foreground">Nenhuma impressora encontrada.</p>}
                
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {printers?.map((printer) => (
                      <Card key={printer.id}>
                        <CardHeader className="flex flex-row items-center justify-between p-4">
                           <div>
                              <p className="font-semibold">{printer.name}</p>
                              <p className="text-sm text-muted-foreground">{printer.ipAddress}</p>
                           </div>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end"><DropdownMenuItem disabled>Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" disabled>Excluir</DropdownMenuItem></DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                           <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Setores</span>
                            <span className="font-medium text-right">{getSectorNames(printer.printSectors)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <Switch checked={printer.isActive} onCheckedChange={(checked) => handleStatusChange(printer.id, checked)} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                {/* Desktop View */}
                <div className="rounded-lg border hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Endereço IP</TableHead>
                        <TableHead>Setores</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead><span className="sr-only">Ações</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {printers?.map((printer) => (
                          <TableRow key={printer.id}>
                            <TableCell className="font-medium">{printer.name}</TableCell>
                            <TableCell>{printer.ipAddress}</TableCell>
                            <TableCell>{getSectorNames(printer.printSectors)}</TableCell>
                            <TableCell className="text-center">
                              <Switch checked={printer.isActive} onCheckedChange={(checked) => handleStatusChange(printer.id, checked)} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end"><DropdownMenuItem disabled>Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" disabled>Excluir</DropdownMenuItem></DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// ============== CATEGORIES TAB ==============

function CategoriesTab({ restaurantId }: { restaurantId: string }) {
    const firestore = useFirestore();
    const categoriesQuery = useMemoFirebase(() => query(collection(firestore, `restaurants/${restaurantId}/menuItemCategories`)), [firestore, restaurantId]);
    const { data: categories, isLoading } = useCollection<MenuItemCategory>(categoriesQuery);

    const sortedCategories = useMemo(() => {
        return categories ? [...categories].sort((a, b) => a.order - b.order) : [];
    }, [categories]);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Categorias do Cardápio</CardTitle>
                    <CardDescription>Organize os itens do seu cardápio em categorias.</CardDescription>
                </div>
                <Button className="w-full sm:w-auto" disabled>
                    <PlusCircle className="mr-2 h-4 w-4" />Nova Categoria
                </Button>
            </CardHeader>
            <CardContent>
                 {isLoading && <Skeleton className="h-24 w-full" />}
                 {!isLoading && sortedCategories.length === 0 && <p className="text-center text-muted-foreground">Nenhuma categoria encontrada.</p>}
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="text-center w-[100px]">Ordem</TableHead>
                                <TableHead className="w-[80px]"><span className="sr-only">Ações</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedCategories.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell className="font-medium">{category.name}</TableCell>
                                    <TableCell className="text-center">{category.order}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end"><DropdownMenuItem disabled>Editar</DropdownMenuItem><DropdownMenuItem className="text-destructive" disabled>Excluir</DropdownMenuItem></DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// ============== MAIN SETTINGS PAGE ==============
export default function SettingsPage() {
    const { restaurantInfo, isLoading } = useUserRestaurant();

    if (isLoading) {
        return (
             <div className="flex flex-col h-screen bg-background">
                <AppHeader>
                    <SidebarTrigger className="md:hidden" />
                    <h1 className="text-xl font-semibold">Configurações</h1>
                </AppHeader>
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                     <Skeleton className="h-screen w-full" />
                </main>
            </div>
        )
    }

    if (!restaurantInfo) {
        return (
             <div className="flex flex-col h-screen bg-background">
                <AppHeader>
                    <SidebarTrigger className="md:hidden" />
                    <h1 className="text-xl font-semibold">Configurações</h1>
                </AppHeader>
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                   <p>Não foi possível carregar as informações do restaurante.</p>
                </main>
            </div>
        )
    }


    return (
        <div className="flex flex-col h-screen bg-background">
            <AppHeader>
                <SidebarTrigger className="md:hidden" />
                <h1 className="text-xl font-semibold">Configurações</h1>
            </AppHeader>
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="users">Usuários</TabsTrigger>
                        <TabsTrigger value="printers">Impressoras</TabsTrigger>
                        <TabsTrigger value="categories">Categorias</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile"><ProfileTab restaurantId={restaurantInfo.id} /></TabsContent>
                    <TabsContent value="users"><UsersTab restaurantId={restaurantInfo.id} /></TabsContent>
                    <TabsContent value="printers"><PrintersTab restaurantId={restaurantInfo.id} /></TabsContent>
                    <TabsContent value="categories"><CategoriesTab restaurantId={restaurantInfo.id} /></TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

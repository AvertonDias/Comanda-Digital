import { AppHeader } from "@/components/layout/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PlusCircle, MoreVertical } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DUMMY_USERS, DUMMY_PRINTERS, DUMMY_CATEGORIES, DUMMY_PRINT_SECTORS } from "@/lib/placeholder-data";

export default function SettingsPage() {
  const getSectorNames = (sectorIds: string[]) => {
    if (!sectorIds || sectorIds.length === 0) return 'Nenhum';
    return sectorIds
      .map(id => DUMMY_PRINT_SECTORS.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

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

          {/* Restaurant Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Perfil do Restaurante</CardTitle>
                <CardDescription>
                  Atualize as informações do seu estabelecimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restaurantName">Nome do Restaurante</Label>
                  <Input id="restaurantName" defaultValue="Pizzaria do Zé" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restaurantPhone">Telefone</Label>
                  <Input id="restaurantPhone" defaultValue="(11) 99999-8888" />
                </div>
                 <div className="flex justify-end pt-2">
                    <Button>Salvar Alterações</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Usuários</CardTitle>
                  <CardDescription>
                    Gerencie os garçons e administradores do sistema.
                  </CardDescription>
                </div>
                 <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Usuário
                </Button>
              </CardHeader>
              <CardContent>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                  {DUMMY_USERS.map((user) => (
                    <Card key={user.id}>
                      <CardHeader className="flex flex-row items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Função</span>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role === 'admin' ? 'Admin' : 'Garçom'}</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Switch id={`status-${user.id}`} checked={user.isActive} />
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
                        <TableHead>Usuário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead><span className="sr-only">Ações</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DUMMY_USERS.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={user.avatarUrl} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                             <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role === 'admin' ? 'Admin' : 'Garçom'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch id={`status-desktop-${user.id}`} checked={user.isActive} />
                          </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Printers Tab */}
          <TabsContent value="printers">
             <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                 <div>
                    <CardTitle>Impressoras e Setores</CardTitle>
                    <CardDescription>
                    Configure as impressoras e os setores de produção.
                    </CardDescription>
                 </div>
                 <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Impressora
                </Button>
              </CardHeader>
              <CardContent>
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden">
                    {DUMMY_PRINTERS.map((printer) => (
                      <Card key={printer.id}>
                        <CardHeader className="flex flex-row items-center justify-between p-4">
                           <div>
                              <p className="font-semibold">{printer.name}</p>
                              <p className="text-sm text-muted-foreground">{printer.ipAddress}</p>
                           </div>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                           <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Setores</span>
                            <span className="font-medium text-right">{getSectorNames(printer.printSectors)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <Switch checked={printer.isActive} />
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
                        {DUMMY_PRINTERS.map((printer) => (
                          <TableRow key={printer.id}>
                            <TableCell className="font-medium">{printer.name}</TableCell>
                            <TableCell>{printer.ipAddress}</TableCell>
                            <TableCell>{getSectorNames(printer.printSectors)}</TableCell>
                            <TableCell className="text-center">
                              <Switch checked={printer.isActive} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Editar</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Categories Tab */}
          <TabsContent value="categories">
             <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                 <div>
                    <CardTitle>Categorias do Cardápio</CardTitle>
                    <CardDescription>
                    Organize os itens do seu cardápio em categorias.
                    </CardDescription>
                 </div>
                 <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Categoria
                </Button>
              </CardHeader>
              <CardContent>
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
                        {DUMMY_CATEGORIES.sort((a, b) => a.order - b.order).map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell className="text-center">{category.order}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Editar</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}

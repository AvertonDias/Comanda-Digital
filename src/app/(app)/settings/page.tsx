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
import { PlusCircle } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold">Configurações</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Perfil do Restaurante</TabsTrigger>
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
                 <Button>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Usuários</CardTitle>
                  <CardDescription>
                    Gerencie os garçons e administradores do sistema.
                  </CardDescription>
                </div>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Usuário
                </Button>
              </CardHeader>
              <CardContent>
                <p>Lista de usuários aqui...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Printers Tab */}
          <TabsContent value="printers">
             <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                 <div>
                    <CardTitle>Impressoras e Setores</CardTitle>
                    <CardDescription>
                    Configure as impressoras e os setores de produção.
                    </CardDescription>
                 </div>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Impressora
                </Button>
              </CardHeader>
              <CardContent>
                <p>Lista de impressoras e setores aqui...</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Categories Tab */}
          <TabsContent value="categories">
             <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                 <div>
                    <CardTitle>Categorias do Cardápio</CardTitle>
                    <CardDescription>
                    Organize os itens do seu cardápio em categorias.
                    </CardDescription>
                 </div>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nova Categoria
                </Button>
              </CardHeader>
              <CardContent>
                <p>Lista de categorias aqui...</p>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}

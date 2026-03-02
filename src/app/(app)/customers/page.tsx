import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DUMMY_CUSTOMERS } from "@/lib/placeholder-data";
import { PlusCircle, Edit } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function AddCustomerForm() {
    return (
        <>
            <DialogHeader>
                <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                <DialogDescription>
                    Insira as informações do novo cliente.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                        Nome
                    </Label>
                    <Input id="name" placeholder="Ex: João da Silva" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">
                        Telefone
                    </Label>
                    <Input id="phone" placeholder="(XX) XXXXX-XXXX" className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button type="submit">Salvar Cliente</Button>
            </DialogFooter>
        </>
    )
}

export default function CustomersPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex-1">
            <h1 className="text-xl font-semibold">Clientes</h1>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Cliente
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <AddCustomerForm />
            </DialogContent>
        </Dialog>
      </AppHeader>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {/* Mobile View - Cards */}
        <div className="grid gap-4 md:hidden">
          {DUMMY_CUSTOMERS.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone:</span>
                  <span>{customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de Pedidos:</span>
                  <span>{customer.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente Desde:</span>
                  <span>{format(new Date(customer.createdAt), "dd/MM/yy", { locale: ptBR })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop View - Table */}
        <div className="rounded-lg border hidden md:block">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-center">Total de Pedidos</TableHead>
                        <TableHead>Cliente Desde</TableHead>
                        <TableHead>
                            <span className="sr-only">Ações</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {DUMMY_CUSTOMERS.map((customer) => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell className="text-center">{customer.totalOrders}</TableCell>
                            <TableCell>
                                {format(new Date(customer.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm">
                                    Editar
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      </main>
    </div>
  );
}

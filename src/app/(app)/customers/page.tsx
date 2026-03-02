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
import { PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    <div className="flex flex-col h-screen">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
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
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="rounded-lg border">
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

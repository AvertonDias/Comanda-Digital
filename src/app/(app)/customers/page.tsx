'use client';

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
import { PlusCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, query, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from "firebase/firestore";
import type { Customer } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CustomersPage() {
  const { restaurantId, isLoading: isRestLoading } = useRestaurant();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const customersQuery = useMemoFirebase(() => {
    if (!restaurantId || !firestore) return null;
    return query(collection(firestore, `restaurants/${restaurantId}/customers`), orderBy('createdAt', 'desc'));
  }, [restaurantId, firestore]);

  const { data: customers, isLoading: isCustLoading } = useCollection<Customer>(customersQuery);

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone || !restaurantId) return;

    const colRef = collection(firestore, `restaurants/${restaurantId}/customers`);
    const data = {
      name: newName,
      phone: newPhone,
      restaurantId,
      totalOrders: 0,
      createdAt: serverTimestamp()
    };

    addDoc(colRef, data).catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', permissionError);
    });

    toast({ title: "Cliente cadastrado!" });
    setIsDialogOpen(false);
    setNewName('');
    setNewPhone('');
  };

  const handleDeleteCustomer = () => {
    if (!customerToDelete || !restaurantId) return;
    const docRef = doc(firestore, `restaurants/${restaurantId}/customers`, customerToDelete.id);
    deleteDoc(docRef).then(() => {
        toast({ title: "Cliente removido." });
    });
    setCustomerToDelete(null);
  };

  if (isRestLoading || isCustLoading) return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader>
        <SidebarTrigger className="md:hidden" />
        <div className="flex-1"><h1 className="text-xl font-semibold">Clientes</h1></div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Adicionar Cliente</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleAddCustomer}>
                    <DialogHeader>
                        <DialogTitle>Novo Cliente</DialogTitle>
                        <DialogDescription>Insira as informações básicas do cliente.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Nome</Label>
                            <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">Telefone</Label>
                            <Input id="phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="col-span-3" required />
                        </div>
                    </div>
                    <DialogFooter><Button type="submit">Salvar Cliente</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </AppHeader>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-center">Total de Pedidos</TableHead>
                        <TableHead>Cliente Desde</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {customers?.map((customer) => (
                        <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell className="text-center">{customer.totalOrders}</TableCell>
                            <TableCell>
                                {customer.createdAt?.seconds 
                                    ? format(new Date(customer.createdAt.seconds * 1000), "dd/MM/yyyy", { locale: ptBR }) 
                                    : 'Recentemente'}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCustomerToDelete(customer)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {customers?.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </main>

      <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
                  <AlertDialogDescription>Deseja remover o histórico de "{customerToDelete?.name}"? Esta ação é irreversível.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90 text-white">Excluir</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
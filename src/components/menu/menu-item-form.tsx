
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { generateDescriptionAction } from '@/app/actions/menu';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory } from '@/lib/types';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  description: z.string().min(10, "A descrição deve ser mais detalhada."),
  price: z.coerce.number().min(0.01, "Preço deve ser maior que zero."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  isAvailable: z.boolean().default(true),
  ingredients: z.string().optional(),
});

type MenuItemFormProps = {
  restaurantId: string;
  categories: MenuItemCategory[];
  onSuccess?: () => void;
  initialData?: MenuItem;
};

export function MenuItemForm({ restaurantId, categories, onSuccess, initialData }: MenuItemFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      categoryId: initialData?.categoryId || "",
      isAvailable: initialData?.isAvailable ?? true,
      ingredients: "",
    },
  });

  async function handleGenerateAI() {
    const dishName = form.getValues('name');
    const ingredients = form.getValues('ingredients');

    if (!dishName) {
      toast({ variant: "destructive", title: "Erro", description: "Digite o nome do prato primeiro." });
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('dishName', dishName);
      formData.append('ingredients', ingredients || dishName);
      
      const result = await generateDescriptionAction(null, formData);
      if (result.message === 'success' && result.description) {
        form.setValue('description', result.description);
        toast({ title: "Descrição Gerada!", description: "AI criou uma descrição para você." });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao gerar descrição com IA." });
    } finally {
      setIsGenerating(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const itemData = {
        ...values,
        restaurantId,
        updatedAt: serverTimestamp(),
        imageUrl: initialData?.imageUrl || `https://picsum.photos/seed/${values.name}/600/400`, // Placeholder
        imageHint: initialData?.imageHint || "food plate",
        printSectorId: initialData?.printSectorId || "default", // Ajustar conforme necessário
      };

      if (initialData) {
        const docRef = doc(firestore, `restaurants/${restaurantId}/menuItems`, initialData.id);
        await updateDoc(docRef, itemData);
        toast({ title: "Item atualizado!", description: "O item foi salvo com sucesso." });
      } else {
        const colRef = collection(firestore, `restaurants/${restaurantId}/menuItems`);
        await addDoc(colRef, { ...itemData, createdAt: serverTimestamp() });
        toast({ title: "Item criado!", description: "O novo item foi adicionado ao cardápio." });
      }
      
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Não foi possível gravar no banco de dados." });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Prato</FormLabel>
              <FormControl><Input placeholder="Ex: Hambúrguer Artesanal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço (R$)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="ingredients"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ingredientes (para a IA)</FormLabel>
              <FormControl><Input placeholder="Ex: pão brioche, carne 180g, cheddar..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Descrição</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar com IA
                </Button>
              </div>
              <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit">{initialData ? "Atualizar Item" : "Criar Item"}</Button>
        </div>
      </form>
    </Form>
  );
}

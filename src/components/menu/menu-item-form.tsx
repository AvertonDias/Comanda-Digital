
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, X } from 'lucide-react';
import { generateDescriptionAction } from '@/app/actions/menu';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory } from '@/lib/types';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  description: z.string().min(1, "A descrição é obrigatória."),
  ingredients: z.string().optional(),
  price: z.coerce.number().min(0.01, "Preço deve ser maior que zero."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  isAvailable: z.boolean().default(true),
  addonGroups: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Nome do grupo é obrigatório"),
    isMandatory: z.boolean(),
    minQuantity: z.number().min(0),
    maxQuantity: z.number().min(1),
    options: z.array(z.object({
      name: z.string().min(1, "Nome da opção é obrigatório"),
      price: z.coerce.number().min(0)
    }))
  })).optional()
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
      ingredients: initialData?.ingredients || "",
      price: initialData?.price || 0,
      categoryId: initialData?.categoryId || "",
      isAvailable: initialData?.isAvailable ?? true,
      addonGroups: initialData?.addonGroups || []
    },
  });

  const { fields: addonGroups, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "addonGroups"
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

  function onSubmit(values: z.infer<typeof formSchema>) {
    const itemData = {
      ...values,
      restaurantId,
      updatedAt: serverTimestamp(),
      imageUrl: initialData?.imageUrl || `https://picsum.photos/seed/${values.name}/600/400`, 
      imageHint: initialData?.imageHint || "food plate",
      printSectorId: initialData?.printSectorId || "default", 
    };

    if (initialData) {
      const docRef = doc(firestore, `restaurants/${restaurantId}/menuItems`, initialData.id);
      updateDoc(docRef, itemData).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: itemData
        }));
      });
      toast({ title: "Item atualizado!" });
    } else {
      const colRef = collection(firestore, `restaurants/${restaurantId}/menuItems`);
      addDoc(colRef, { ...itemData, createdAt: serverTimestamp() }).catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: itemData
        }));
      });
      toast({ title: "Item criado!" });
    }
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
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

            <FormField
              control={form.control}
              name="ingredients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ingredientes Base (Separados por vírgula)</FormLabel>
                  <FormControl><Input placeholder="Ex: Pão brioche, Carne 180g, Queijo cheddar, Alface" {...field} /></FormControl>
                  <FormDescription>Esses itens aparecerão como opcionais para o cliente retirar ou adicionar mais.</FormDescription>
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
                    <FormLabel>Preço Base (R$)</FormLabel>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Descrição de Venda</FormLabel>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleGenerateAI}
                      disabled={isGenerating}
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Gerar com IA
                    </Button>
                  </div>
                  <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 border-l pl-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase">Grupos de Adicionais Pagos</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => appendGroup({ 
                  id: Math.random().toString(36).substr(2, 9),
                  name: "", 
                  isMandatory: false, 
                  minQuantity: 0, 
                  maxQuantity: 1, 
                  options: [] 
                })}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo Grupo
              </Button>
            </div>

            <div className="space-y-4">
              {addonGroups.map((group, groupIdx) => (
                <Card key={group.id} className="p-4 space-y-4 relative bg-muted/20 border-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-8 w-8 text-destructive"
                    onClick={() => removeGroup(groupIdx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="grid grid-cols-1 gap-3 pr-8">
                    <FormField
                      control={form.control}
                      name={`addonGroups.${groupIdx}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase">Título do Grupo</FormLabel>
                          <FormControl><Input {...field} className="h-8" placeholder="Ex: Escolha o queijo" /></FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name={`addonGroups.${groupIdx}.isMandatory`}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="text-xs cursor-pointer">Obrigatório</FormLabel>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-xs">Máx Opções:</Label>
                        <Input 
                          type="number" 
                          {...form.register(`addonGroups.${groupIdx}.maxQuantity`, { valueAsNumber: true })} 
                          className="h-8 w-16" 
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Opções do Grupo</Label>
                    <div className="space-y-2">
                      {form.watch(`addonGroups.${groupIdx}.options`)?.map((_, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <Input 
                            placeholder="Nome" 
                            {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.name`)} 
                            className="h-8 text-xs"
                          />
                          <Input 
                            type="number" 
                            placeholder="R$" 
                            {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.price`, { valueAsNumber: true })} 
                            className="h-8 w-24 text-xs"
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              const options = form.getValues(`addonGroups.${groupIdx}.options`);
                              form.setValue(`addonGroups.${groupIdx}.options`, options.filter((_, i) => i !== optIdx));
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="w-full h-8 border-dashed border-2 text-[10px]"
                        onClick={() => {
                          const options = form.getValues(`addonGroups.${groupIdx}.options`) || [];
                          form.setValue(`addonGroups.${groupIdx}.options`, [...options, { name: "", price: 0 }]);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adicionar Opção
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" size="lg" className="w-full md:w-auto font-bold uppercase">
            {initialData ? "Salvar Alterações" : "Criar Item no Cardápio"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

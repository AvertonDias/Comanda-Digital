
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  ingredients: z.array(z.string()).default([]),
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
  const [newIngredient, setNewIngredient] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      ingredients: Array.isArray(initialData?.ingredients) ? initialData.ingredients : [],
      price: initialData?.price || 0,
      categoryId: initialData?.categoryId || "",
      isAvailable: initialData?.isAvailable ?? true,
      addonGroups: initialData?.addonGroups || []
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        ingredients: Array.isArray(initialData.ingredients) ? initialData.ingredients : [],
        price: initialData.price,
        categoryId: initialData.categoryId,
        isAvailable: initialData.isAvailable,
        addonGroups: initialData.addonGroups || []
      });
    }
  }, [initialData, form]);

  const { fields: addonGroups, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "addonGroups"
  });

  const handleAddIngredient = () => {
    if (!newIngredient.trim()) return;
    const current = Array.isArray(form.getValues("ingredients")) ? form.getValues("ingredients") : [];
    if (!current.includes(newIngredient.trim())) {
      form.setValue("ingredients", [...current, newIngredient.trim()]);
    }
    setNewIngredient("");
  };

  const handleRemoveIngredient = (idx: number) => {
    const current = Array.isArray(form.getValues("ingredients")) ? form.getValues("ingredients") : [];
    form.setValue("ingredients", current.filter((_, i) => i !== idx));
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    const itemData = {
      ...values,
      description: "", // Mantendo vazio já que foi removido do form
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

  const watchedIngredients = form.watch("ingredients");
  const ingredientsArray = Array.isArray(watchedIngredients) ? watchedIngredients : [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary">Informações Básicas</h3>
            
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

            <div className="space-y-3 bg-muted/20 p-4 rounded-lg border-2 border-dashed">
              <FormLabel className="text-primary font-black">Ingredientes Base (+)</FormLabel>
              <div className="flex gap-2">
                <Input 
                  placeholder="Ex: Pão brioche" 
                  value={newIngredient} 
                  onChange={e => setNewIngredient(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
                />
                <Button type="button" size="icon" onClick={handleAddIngredient} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>Adicione item por item. Eles aparecerão como opcionais para o cliente.</FormDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                {ingredientsArray.map((ing, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1 px-3 py-1.5 font-bold uppercase text-[10px] bg-white border-2">
                    {ing}
                    <X className="h-3 w-3 cursor-pointer text-destructive hover:scale-125 transition-transform" onClick={() => handleRemoveIngredient(idx)} />
                  </Badge>
                ))}
                {ingredientsArray.length === 0 && <span className="text-[10px] text-muted-foreground uppercase italic">Nenhum ingrediente adicionado</span>}
              </div>
            </div>

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
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
          </div>

          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-primary">Adicionais Pagos</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-8 font-bold text-[10px] uppercase"
                onClick={() => appendGroup({ 
                  id: Math.random().toString(36).substr(2, 9),
                  name: "", 
                  isMandatory: false, 
                  minQuantity: 0, 
                  maxQuantity: 1, 
                  options: [] 
                })}
              >
                <Plus className="mr-1 h-3 w-3" /> Novo Grupo
              </Button>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {addonGroups.map((group, groupIdx) => (
                <Card key={group.id} className="p-4 space-y-4 relative bg-muted/10 border-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-7 w-7 text-destructive"
                    onClick={() => removeGroup(groupIdx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="space-y-3 pr-8">
                    <FormField
                      control={form.control}
                      name={`addonGroups.${groupIdx}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Título do Grupo</FormLabel>
                          <FormControl><Input {...field} className="h-8 text-xs font-bold" placeholder="Ex: Escolha o queijo" /></FormControl>
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
                            <FormLabel className="text-[10px] font-black uppercase cursor-pointer">Obrigatório</FormLabel>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Máx:</Label>
                        <Input 
                          type="number" 
                          {...form.register(`addonGroups.${groupIdx}.maxQuantity`, { valueAsNumber: true })} 
                          className="h-7 w-12 text-center p-0 text-xs" 
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="space-y-2">
                      {form.watch(`addonGroups.${groupIdx}.options`)?.map((_, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <Input 
                            placeholder="Opção (Ex: Cheddar)" 
                            {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.name`)} 
                            className="h-8 text-xs"
                          />
                          <Input 
                            type="number" 
                            placeholder="R$" 
                            {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.price`, { valueAsNumber: true })} 
                            className="h-8 w-20 text-xs"
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
                        className="w-full h-8 border-dashed border-2 text-[9px] font-black uppercase"
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
              {addonGroups.length === 0 && (
                <div className="text-center py-10 bg-muted/10 rounded-lg border-2 border-dashed">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Nenhum grupo de adicionais</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" size="lg" className="w-full md:w-auto bg-primary font-black uppercase px-12">
            {initialData ? "Salvar Alterações" : "Cadastrar no Cardápio"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

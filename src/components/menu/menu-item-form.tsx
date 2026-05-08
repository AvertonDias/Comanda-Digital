'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { MenuItem, MenuItemCategory, MenuItemIngredient } from '@/lib/types';
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
  ingredients: z.array(z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    extraPrice: z.coerce.number().min(0)
  })).default([]),
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
  const [newIngName, setNewIngName] = useState("");
  const [newIngPrice, setNewIngPrice] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      ingredients: initialData?.ingredients || [],
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
        ingredients: initialData.ingredients || [],
        price: initialData.price,
        categoryId: initialData.categoryId,
        isAvailable: initialData.isAvailable,
        addonGroups: initialData.addonGroups || []
      });
    }
  }, [initialData, form]);

  const { fields: ingredientFields, append: appendIng, remove: removeIng } = useFieldArray({
    control: form.control,
    name: "ingredients"
  });

  const { fields: addonGroups, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "addonGroups"
  });

  const handleAddIngredient = () => {
    if (!newIngName.trim()) return;
    appendIng({ 
      name: newIngName.trim(), 
      extraPrice: Number(newIngPrice) || 0 
    });
    setNewIngName("");
    setNewIngPrice("");
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    const itemData = {
      ...values,
      description: "", 
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Coluna 1: Informações e Ingredientes */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="h-4 w-1 bg-primary rounded-full" />
              1. Informações Básicas
            </h3>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase">Nome do Prato</FormLabel>
                  <FormControl><Input placeholder="Ex: Hambúrguer Artesanal" className="h-11" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 bg-muted/10 p-4 rounded-xl border-2 border-dashed border-muted">
              <FormLabel className="text-primary text-[10px] font-black uppercase">Ingredientes e Valor de Extra (+)</FormLabel>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nome (Ex: Bacon)" 
                    value={newIngName} 
                    className="h-10 text-sm flex-[2]"
                    onChange={e => setNewIngName(e.target.value)}
                  />
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Extra (R$)" 
                      value={newIngPrice} 
                      type="number"
                      step="0.01"
                      className="h-10 text-sm pl-6"
                      onChange={e => setNewIngPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddIngredient())}
                    />
                  </div>
                  <Button type="button" size="icon" onClick={handleAddIngredient} className="shrink-0 h-10 w-10">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <FormDescription className="text-[9px] uppercase font-bold text-muted-foreground">
                Informe o nome e quanto custa se o cliente pedir uma porção extra.
              </FormDescription>
              
              <div className="space-y-2 pt-2">
                {ingredientFields.map((field, idx) => (
                  <div key={field.id} className="flex items-center justify-between bg-background border-2 rounded-lg p-2 group">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase">{form.watch(`ingredients.${idx}.name`)}</span>
                        <span className="text-[9px] text-primary font-bold">VALOR EXTRA: R$ {form.watch(`ingredients.${idx}.extraPrice`)?.toFixed(2)}</span>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeIng(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {ingredientFields.length === 0 && <span className="text-[9px] text-muted-foreground uppercase italic font-bold">Nenhum ingrediente cadastrado</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase">Preço Base (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" className="h-11" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase">Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
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

          {/* Coluna 2: Adicionais */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="h-4 w-1 bg-primary rounded-full" />
                2. Grupos de Adicionais
              </h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="h-8 font-bold text-[10px] uppercase border-2"
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

            <div className="space-y-4">
              {addonGroups.map((group, groupIdx) => (
                <Card key={group.id} className="p-4 space-y-4 relative bg-muted/5 border-2 shadow-none overflow-hidden">
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
                          <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Título do Grupo</FormLabel>
                          <FormControl><Input {...field} className="h-9 text-xs font-bold" placeholder="Ex: Escolha o queijo" /></FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <FormField
                        control={form.control}
                        name={`addonGroups.${groupIdx}.isMandatory`}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="text-[9px] font-black uppercase cursor-pointer">Obrigatório</FormLabel>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground">Limite Máx:</Label>
                        <Input 
                          type="number" 
                          {...form.register(`addonGroups.${groupIdx}.maxQuantity`, { valueAsNumber: true })} 
                          className="h-7 w-12 text-center p-0 text-xs font-bold" 
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    {form.watch(`addonGroups.${groupIdx}.options`)?.map((_, optIdx) => (
                      <div key={optIdx} className="flex gap-2 items-center">
                        <Input 
                          placeholder="Opção (Ex: Cheddar)" 
                          {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.name`)} 
                          className="h-9 text-xs font-medium"
                        />
                        <div className="flex items-center gap-1 border rounded-md px-2 bg-background h-9">
                          <span className="text-[10px] font-bold text-muted-foreground">R$</span>
                          <Input 
                            type="number" 
                            placeholder="0,00" 
                            {...form.register(`addonGroups.${groupIdx}.options.${optIdx}.price`, { valueAsNumber: true })} 
                            className="border-none h-full w-14 p-0 text-xs font-black shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => {
                            const options = form.getValues(`addonGroups.${groupIdx}.options`);
                            form.setValue(`addonGroups.${groupIdx}.options`, options.filter((_, i) => i !== optIdx));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="w-full h-10 border-dashed border-2 text-[9px] font-black uppercase mt-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
                      onClick={() => {
                        const options = form.getValues(`addonGroups.${groupIdx}.options`) || [];
                        form.setValue(`addonGroups.${groupIdx}.options`, [...options, { name: "", price: 0 }]);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar Opção
                    </Button>
                  </div>
                </Card>
              ))}
              {addonGroups.length === 0 && (
                <div className="text-center py-10 bg-muted/5 rounded-xl border-2 border-dashed border-muted">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Nenhum adicional configurado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 pt-6 pb-2 bg-background/95 backdrop-blur-sm border-t mt-auto flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full bg-primary font-black uppercase py-6 shadow-xl active:scale-95 transition-all">
            {initialData ? "Salvar Alterações" : "Cadastrar no Cardápio"}
          </Button>
          <Button type="button" variant="ghost" className="w-full text-muted-foreground font-black uppercase text-[10px]" onClick={onSuccess}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

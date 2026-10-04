'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, Plus, Minus, Share2, Maximize2, ShoppingBag, Info, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { MenuItem, MenuItemAddonOption, MenuItemIngredient } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type SelectionAddon = MenuItemAddonOption & { groupId: string };
type IngredientStatus = 'normal' | 'removed' | 'extra';

type MenuItemSelectionDialogProps = {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    item: MenuItem;
    quantity: number;
    addons: SelectionAddon[];
    notes: string;
    totalPrice: number;
    ingredientsExtraPrice: number;
  }) => void;
};

export function MenuItemSelectionDialog({ item, isOpen, onClose, onConfirm }: MenuItemSelectionDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<SelectionAddon[]>([]);
  const [notes, setNotes] = useState('');
  const [ingredientMods, setIngredientMods] = useState<Record<string, IngredientStatus>>({});

  const ingredientsList = useMemo(() => {
    if (!item?.ingredients) return [];
    return Array.isArray(item.ingredients) ? item.ingredients : [];
  }, [item?.ingredients]);

  const ingredientsExtraPrice = useMemo(() => {
    if (!item?.ingredients) return 0;
    return Object.entries(ingredientMods)
        .filter(([_, status]) => status === 'extra')
        .reduce((acc, [ingName]) => {
            const ing = item.ingredients?.find(i => i.name === ingName);
            return acc + (ing?.extraPrice || 0);
        }, 0);
  }, [item?.ingredients, ingredientMods]);

  const currentTotal = useMemo(() => {
    if (!item) return 0;
    const addonsTotal = selectedAddons.reduce((acc, curr) => acc + curr.price, 0);
    return (item.price + addonsTotal + ingredientsExtraPrice) * quantity;
  }, [item, selectedAddons, ingredientsExtraPrice, quantity]);

  const isMandatoryGroupsMet = useMemo(() => {
    if (!item?.addonGroups) return true;
    return item.addonGroups.every(group => {
      if (!group.isMandatory) return true;
      const count = selectedAddons.filter(a => a.groupId === group.id).length;
      return count >= (group.minQuantity || 1);
    });
  }, [item, selectedAddons]);

  useEffect(() => {
    if (!isOpen) {
      setQuantity(1);
      setSelectedAddons([]);
      setNotes('');
      setIngredientMods({});
    }
  }, [isOpen]);

  if (!item) return null;

  const handleAddonToggle = (group: any, option: MenuItemAddonOption) => {
    setSelectedAddons(prev => {
      const isSelected = prev.some(a => a.name === option.name && a.groupId === group.id);
      
      if (isSelected) {
        return prev.filter(a => !(a.name === option.name && a.groupId === group.id));
      }

      const groupSelections = prev.filter(a => a.groupId === group.id);
      if (groupSelections.length >= (group.maxQuantity || 999)) {
        return prev;
      }

      return [...prev, { ...option, groupId: group.id }];
    });
  };

  const updateIngredientStatus = (ingredient: string, status: IngredientStatus) => {
    setIngredientMods(prev => ({
        ...prev,
        [ingredient]: status
    }));
  };

  const handleConfirm = () => {
    if (!isMandatoryGroupsMet || !item) return;

    // Gerar notas baseadas nas modificações de ingredientes
    const removed = Object.entries(ingredientMods).filter(([_, status]) => status === 'removed').map(([ing]) => ing);
    const extra = Object.entries(ingredientMods).filter(([_, status]) => status === 'extra').map(([ing]) => ing);

    let generatedNotes = '';
    if (removed.length > 0) generatedNotes += `SEM: ${removed.join(', ')} `;
    if (extra.length > 0) generatedNotes += `${generatedNotes ? '| ' : ''}EXTRA: ${extra.join(', ')} `;
    
    const finalNotes = notes ? `${generatedNotes}${generatedNotes ? '| ' : ''}${notes}` : generatedNotes;

    onConfirm({
      item,
      quantity,
      addons: selectedAddons,
      notes: finalNotes.trim(),
      totalPrice: currentTotal,
      ingredientsExtraPrice: ingredientsExtraPrice
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[450px] p-0 overflow-hidden flex flex-col h-[95vh] sm:h-[85vh]">
        <ScrollArea className="flex-1">
          <div className="relative w-full aspect-[4/3] bg-muted">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
            />
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
              <Button 
                variant="destructive" 
                size="icon" 
                className="rounded-full pointer-events-auto h-8 w-8"
                onClick={onClose}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="icon" className="rounded-full pointer-events-auto h-8 w-8 bg-black/40 text-white hover:bg-black/60 border-none">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-black uppercase leading-tight">{item.name}</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                Personalize seu pedido selecionando os ingredientes e adicionais desejados.
              </DialogDescription>
            </div>

            {/* Seção de Ingredientes Base (Modificadores de Retirada/Extra) */}
            {ingredientsList.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-primary/5 p-3 rounded-md border-l-4 border-primary">
                  <div>
                    <h3 className="font-black text-sm uppercase text-primary">Ajustar Ingredientes</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Personalize as porções padrão
                    </p>
                  </div>
                  <Info className="h-4 w-4 text-primary opacity-50" />
                </div>
                
                <div className="space-y-0 divide-y bg-muted/10 rounded-lg">
                  {ingredientsList.map((ingredient, idx) => {
                    const status = ingredientMods[ingredient.name] || 'normal';
                    const hasExtraPrice = ingredient.extraPrice > 0;
                    
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between px-4 py-3 transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                            <p className={cn(
                                "text-xs font-black uppercase transition-all truncate",
                                status === 'removed' ? "text-muted-foreground line-through opacity-50" : "text-foreground",
                                status === 'extra' ? "text-primary scale-105 origin-left" : ""
                            )}>
                                {ingredient.name}
                            </p>
                            {status === 'extra' && (
                                <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[8px] font-black uppercase bg-primary/10 text-primary border-none">
                                        Extra
                                    </Badge>
                                    {hasExtraPrice && <span className="text-[8px] font-black text-primary">+R${ingredient.extraPrice.toFixed(2)}</span>}
                                </div>
                            )}
                            {status === 'removed' && (
                                <Badge variant="outline" className="h-4 px-1.5 py-0 text-[8px] font-black uppercase text-muted-foreground">
                                    Removido
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-background rounded-lg border-2 p-1 shadow-sm shrink-0">
                            <Button 
                                variant={status === 'removed' ? "destructive" : "ghost"} 
                                size="icon" 
                                className="h-7 w-7 rounded-md"
                                onClick={() => updateIngredientStatus(ingredient.name, status === 'removed' ? 'normal' : 'removed')}
                            >
                                <Minus className="h-3.5 w-3.5" />
                            </Button>
                            
                            <div className="w-8 text-center">
                                {status === 'normal' ? (
                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 mx-auto" />
                                ) : status === 'extra' ? (
                                    <span className="text-[10px] font-black text-primary">2x</span>
                                ) : (
                                    <span className="text-[10px] font-black text-destructive">0x</span>
                                )}
                            </div>

                            <Button 
                                variant={status === 'extra' ? "default" : "ghost"} 
                                size="icon" 
                                className={cn("h-7 w-7 rounded-md", status === 'extra' ? "bg-primary" : "")}
                                onClick={() => updateIngredientStatus(ingredient.name, status === 'extra' ? 'normal' : 'extra')}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seção de Adicionais Pagos */}
            {item.addonGroups?.map((group) => (
              <div key={group.id} className="space-y-4">
                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-md">
                  <div>
                    <h3 className="font-black text-sm uppercase">{group.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      {group.isMandatory ? `Obrigatório • Escolha no mínimo ${group.minQuantity || 1}` : `Opcional • Máximo ${group.maxQuantity}`}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-0 divide-y">
                  {group.options.map((option, idx) => {
                    const isSelected = selectedAddons.some(a => a.name === option.name && a.groupId === group.id);
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between py-4 cursor-pointer hover:bg-muted/5 transition-colors"
                        onClick={() => handleAddonToggle(group, option)}
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-black uppercase">{option.name}</p>
                          <p className="text-primary text-[10px] font-black">
                            + R$ {option.price.toFixed(2)}
                          </p>
                        </div>
                        <Button 
                          variant={isSelected ? "default" : "outline"} 
                          size="icon" 
                          className={cn(
                            "h-8 w-8 rounded-full transition-all border-2",
                            isSelected ? "bg-black text-white scale-110 border-black" : "border-muted-foreground/20"
                          )}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-3 pb-8">
              <h3 className="font-black text-sm uppercase">Observações Extras</h3>
              <Textarea 
                placeholder="Ex: Ponto da carne, sem pimenta, etc..." 
                className="bg-muted/20 border-none resize-none h-24 focus-visible:ring-black text-xs font-medium"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-black uppercase">Subtotal</span>
              <span className="text-xl font-black">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentTotal)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-black text-white rounded-lg h-10 px-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/10"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-black text-sm">{quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/10"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button 
                className="h-10 px-8 rounded-lg bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-black uppercase text-xs flex-1 shadow-lg disabled:opacity-50 transition-all active:scale-95"
                disabled={!isMandatoryGroupsMet}
                onClick={handleConfirm}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

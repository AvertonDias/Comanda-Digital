'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, Plus, Minus, Share2, Maximize2, ShoppingBag, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { MenuItem, MenuItemAddonOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

type SelectionAddon = MenuItemAddonOption & { groupId: string };

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
  }) => void;
};

export function MenuItemSelectionDialog({ item, isOpen, onClose, onConfirm }: MenuItemSelectionDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<SelectionAddon[]>([]);
  const [notes, setNotes] = useState('');
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);

  const ingredientsList = useMemo(() => {
    if (!item?.ingredients) return [];
    return Array.isArray(item.ingredients) ? item.ingredients : [];
  }, [item?.ingredients]);

  const currentTotal = useMemo(() => {
    if (!item) return 0;
    const addonsTotal = selectedAddons.reduce((acc, curr) => acc + curr.price, 0);
    return (item.price + addonsTotal) * quantity;
  }, [item, selectedAddons, quantity]);

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
      setExcludedIngredients([]);
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

  const handleIngredientToggle = (ingredient: string) => {
    setExcludedIngredients(prev => 
      prev.includes(ingredient) 
        ? prev.filter(i => i !== ingredient) 
        : [...prev, ingredient]
    );
  };

  const handleConfirm = () => {
    if (!isMandatoryGroupsMet || !item) return;

    let finalNotes = notes;
    if (excludedIngredients.length > 0) {
      const exclusionString = `SEM: ${excludedIngredients.join(', ')}`;
      finalNotes = finalNotes ? `${exclusionString} | ${finalNotes}` : exclusionString;
    }

    onConfirm({
      item,
      quantity,
      addons: selectedAddons,
      notes: finalNotes,
      totalPrice: currentTotal
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
                <Button variant="secondary" size="icon" className="rounded-full pointer-events-auto h-8 w-8 bg-black/40 text-white hover:bg-black/60 border-none">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase leading-tight">{item.name}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {item.description}
              </p>
            </div>

            {ingredientsList.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md">
                  <div>
                    <h3 className="font-bold text-sm uppercase">Personalizar Ingredientes</h3>
                    <p className="text-xs text-muted-foreground">
                      Remova os itens que não deseja
                    </p>
                  </div>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="space-y-0 divide-y">
                  {ingredientsList.map((ingredient, idx) => {
                    const isExcluded = excludedIngredients.includes(ingredient);
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between py-4 cursor-pointer hover:bg-muted/5 transition-colors"
                        onClick={() => handleIngredientToggle(ingredient)}
                      >
                        <p className={cn(
                          "text-sm font-medium uppercase transition-colors",
                          isExcluded ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {ingredient}
                        </p>
                        <Checkbox 
                          checked={!isExcluded}
                          className="rounded-full h-6 w-6 border-2 data-[state=checked]:bg-black data-[state=checked]:border-black"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {item.addonGroups?.map((group) => (
              <div key={group.id} className="space-y-4">
                <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md">
                  <div>
                    <h3 className="font-bold text-sm uppercase">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.isMandatory ? `Obrigatório • Escolha ${group.minQuantity || 1}` : `Opcional • Máx ${group.maxQuantity}`}
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
                          <p className="text-sm font-medium uppercase">{option.name}</p>
                          <p className="text-primary text-xs font-bold">
                            +R$ {option.price.toFixed(2)}
                          </p>
                        </div>
                        <Button 
                          variant={isSelected ? "default" : "outline"} 
                          size="icon" 
                          className={cn(
                            "h-7 w-7 rounded-full transition-all",
                            isSelected && "bg-black text-white scale-110"
                          )}
                        >
                          {isSelected ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-3 pb-8">
              <h3 className="font-bold text-sm uppercase">Observações Extras</h3>
              <Textarea 
                placeholder="Ex: Ponto da carne, talheres, etc..." 
                className="bg-muted/30 border-none resize-none h-24 focus-visible:ring-black"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-bold uppercase">Total</span>
              <span className="text-xl font-black">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentTotal)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-black text-white rounded-full h-10 px-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/10"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-bold">{quantity}</span>
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
                className="h-10 px-8 rounded-md bg-[#EF3B33] hover:bg-[#D32F2F] text-white font-bold uppercase flex-1 shadow-lg disabled:opacity-50 transition-all active:scale-95"
                disabled={!isMandatoryGroupsMet}
                onClick={handleConfirm}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
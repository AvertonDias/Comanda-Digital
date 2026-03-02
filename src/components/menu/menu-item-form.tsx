'use client';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { generateDescriptionAction } from '@/app/actions/menu';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: '',
  description: '',
  errors: {},
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar Item'}
    </Button>
  );
}

function GenerateButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" variant="outline" disabled={pending} name="intent" value="generate">
            <Sparkles className="mr-2 h-4 w-4" />
            {pending ? 'Gerando...' : 'Gerar com IA'}
        </Button>
    )
}

export function MenuItemForm() {
  const [state, formAction] = useFormState(generateDescriptionAction, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message === 'success' && state.description) {
        const descriptionElement = document.getElementById('description') as HTMLTextAreaElement | null;
        if(descriptionElement) {
            descriptionElement.value = state.description;
        }
        toast({
            title: "Descrição Gerada!",
            description: "A descrição do prato foi gerada com sucesso.",
        })
    } else if (state.message && state.message !== 'success') {
        toast({
            variant: "destructive",
            title: "Erro",
            description: state.message,
        })
    }
  }, [state, toast]);

  return (
    <form action={formAction}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="dishName" className="text-right">
            Nome
          </Label>
          <Input id="dishName" name="dishName" className="col-span-3" />
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="ingredients" className="text-right">
            Ingredientes
          </Label>
          <div className="col-span-3">
            <Input id="ingredients" name="ingredients" placeholder="Separe por vírgulas: queijo, presunto, etc." />
          </div>
        </div>

        <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
                Descrição
            </Label>
            <div className="col-span-3 space-y-2">
                <Textarea id="description" name="description" className="min-h-[100px]" />
                <GenerateButton />
            </div>
        </div>

        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="price" className="text-right">
            Preço
          </Label>
          <Input id="price" name="price" type="number" step="0.01" className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="category" className="text-right">
            Categoria
          </Label>
          <Select name="category">
            <SelectTrigger className="col-span-3">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Lanches">Lanches</SelectItem>
              <SelectItem value="Pizzas">Pizzas</SelectItem>
              <SelectItem value="Saladas">Saladas</SelectItem>
              <SelectItem value="Sobremesas">Sobremesas</SelectItem>
              <SelectItem value="Bebidas">Bebidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="sector" className="text-right">
            Setor Impressão
          </Label>
          <Select name="sector">
            <SelectTrigger className="col-span-3">
              <SelectValue placeholder="Selecione um setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cozinha">Cozinha</SelectItem>
              <SelectItem value="Bar">Bar</SelectItem>
              <SelectItem value="Sobremesa">Sobremesa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

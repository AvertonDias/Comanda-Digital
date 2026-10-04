'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UtensilsCrossed, Sparkles, CheckCircle2, Loader2, Store } from 'lucide-react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function RestaurantSetupCard() {
  const [restaurantName, setRestaurantName] = useState('Meu Restaurante');
  const [seedData, setSeedData] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleCreateRestaurant = async () => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Usuário não autenticado',
        description: 'Faça login para criar seu restaurante.'
      });
      return;
    }

    if (!restaurantName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Por favor, informe o nome do seu restaurante.'
      });
      return;
    }

    setIsCreating(true);
    try {
      const batch = writeBatch(firestore);
      const restaurantRef = doc(collection(firestore, 'restaurants'));
      const restaurantId = restaurantRef.id;

      // 1. Cria o Restaurante
      batch.set(restaurantRef, {
        name: restaurantName.trim(),
        ownerId: user.uid,
        ownerEmail: user.email || '',
        plan: 'pro',
        status: 'ativo',
        deliveryFee: 5.0,
        createdAt: serverTimestamp(),
      });

      // 2. Atualiza o perfil do usuário
      const userProfileRef = doc(firestore, `users/${user.uid}`);
      batch.set(userProfileRef, {
        name: user.displayName || user.email || 'Administrador',
        email: user.email || '',
        avatarUrl: user.photoURL || '',
        activeRestaurantId: restaurantId,
      }, { merge: true });

      // 3. Adiciona como Admin na equipe
      const teamRef = doc(firestore, `restaurants/${restaurantId}/team/${user.uid}`);
      batch.set(teamRef, {
        userId: user.uid,
        email: user.email || '',
        name: user.displayName || 'Administrador',
        role: 'admin',
        isActive: true,
        restaurantId,
        createdAt: serverTimestamp(),
      });

      // 4. Setores de Impressão padrão
      const cozinhaSectorRef = doc(firestore, `restaurants/${restaurantId}/printSectors/cozinha`);
      batch.set(cozinhaSectorRef, { id: 'cozinha', name: 'Cozinha', restaurantId });

      const barSectorRef = doc(firestore, `restaurants/${restaurantId}/printSectors/bar`);
      batch.set(barSectorRef, { id: 'bar', name: 'Bar / Bebidas', restaurantId });

      // 5. Se marcado, cria mesas e itens de cardápio iniciais
      if (seedData) {
        // Categorias
        const catLanchesRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories/cat_lanches`);
        batch.set(catLanchesRef, { id: 'cat_lanches', name: 'Lanches & Burgers', order: 1 });

        const catBebidasRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories/cat_bebidas`);
        batch.set(catBebidasRef, { id: 'cat_bebidas', name: 'Bebidas', order: 2 });

        const catPorcoesRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories/cat_porcoes`);
        batch.set(catPorcoesRef, { id: 'cat_porcoes', name: 'Porções & Entradas', order: 3 });

        const catSobremesasRef = doc(firestore, `restaurants/${restaurantId}/menuItemCategories/cat_sobremesas`);
        batch.set(catSobremesasRef, { id: 'cat_sobremesas', name: 'Sobremesas', order: 4 });

        // Itens
        const items = [
          {
            id: 'item_burger_1',
            categoryId: 'cat_lanches',
            name: 'Burger Clássico com Queijo',
            price: 28.90,
            isAvailable: true,
            description: 'Pão brioche tostado na manteiga, blend suculento 160g, queijo cheddar derretido e maionese especial.'
          },
          {
            id: 'item_burger_2',
            categoryId: 'cat_lanches',
            name: 'Burger Bacon Especial',
            price: 34.90,
            isAvailable: true,
            description: 'Blend bovino 160g, fatias crocantes de bacon artesanal, queijo prato e molho barbecue rústico.'
          },
          {
            id: 'item_fritas',
            categoryId: 'cat_porcoes',
            name: 'Porção de Batata Frita Crocante',
            price: 22.00,
            isAvailable: true,
            description: '400g de batatas selecionadas, temperadas com sal marinho, alecrim e leve toque de páprica.'
          },
          {
            id: 'item_coca',
            categoryId: 'cat_bebidas',
            name: 'Refrigerante Lata 350ml',
            price: 7.00,
            isAvailable: true,
            description: 'Opções geladas: Coca-Cola, Guaraná Antarctica ou Sprite.'
          },
          {
            id: 'item_suco',
            categoryId: 'cat_bebidas',
            name: 'Suco Natural de Laranja 500ml',
            price: 10.00,
            isAvailable: true,
            description: 'Preparado na hora com laranjas selecionadas.'
          },
          {
            id: 'item_pudim',
            categoryId: 'cat_sobremesas',
            name: 'Pudim de Leite Condensado',
            price: 12.00,
            isAvailable: true,
            description: 'Fatia generosa com textura aveludada e calda de caramelo dourada.'
          }
        ];

        for (const item of items) {
          const itemRef = doc(firestore, `restaurants/${restaurantId}/menuItems/${item.id}`);
          batch.set(itemRef, {
            ...item,
            restaurantId,
            createdAt: serverTimestamp(),
          });
        }

        // Mesas 1 a 6
        for (let i = 1; i <= 6; i++) {
          const tableNumStr = i < 10 ? `0${i}` : `${i}`;
          const tableRef = doc(collection(firestore, `restaurants/${restaurantId}/tables`));
          batch.set(tableRef, {
            restaurantId,
            name: `Mesa ${tableNumStr}`,
            status: 'livre',
            capacity: i === 4 ? 6 : i === 6 ? 8 : 4,
            createdAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      toast({
        title: 'Restaurante criado com sucesso!',
        description: 'Os dados foram gravados diretamente no seu banco de dados Firebase.'
      });

      // Recarrega para atualizar o contexto
      window.location.reload();
    } catch (error: any) {
      console.error('Erro ao inicializar restaurante no Firestore:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gravar no banco',
        description: error.message || 'Verifique as permissões no Firebase.'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 shadow-lg bg-card">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Store className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Inicializar seu Banco de Dados</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          Seu projeto no Firebase está conectado. Crie seu primeiro restaurante para começar a gravar mesas, cardápio e comandas no Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-lg mx-auto pt-2">
        <div className="space-y-2">
          <Label htmlFor="setup-name" className="font-semibold">Nome do seu Estabelecimento</Label>
          <Input 
            id="setup-name"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Ex: Pizzaria Bella, Hamburgueria Gourmet..."
            className="text-base h-11"
            disabled={isCreating}
          />
        </div>

        <div className="rounded-lg border border-border p-4 bg-muted/40 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={seedData} 
              onChange={(e) => setSeedData(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              disabled={isCreating}
            />
            <div className="space-y-1">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Criar dados iniciais de demonstração (Recomendado)
              </span>
              <p className="text-xs text-muted-foreground">
                Cadastra automaticamente 6 mesas, 4 categorias (Lanches, Bebidas, Porções, Sobremesas) e 6 itens para você já testar o fluxo de comandas e QR Code.
              </p>
            </div>
          </label>
        </div>

        <Button 
          size="lg" 
          className="w-full text-base font-bold shadow-md gap-2"
          onClick={handleCreateRestaurant}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Gravando no Firebase Firestore...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Criar Restaurante & Gravar no Firestore
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

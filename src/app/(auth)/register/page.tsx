'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import { useRestaurant } from "@/hooks/use-restaurant";

// Google Icon SVG component
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 48 48" role="img" aria-label="Google sign-in" {...props}>
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.591,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );

export default function RegisterPage() {
  const [restaurantName, setRestaurantName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { hasRestaurant, isLoading: isResLoading } = useRestaurant();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Redireciona apenas se o usuário estiver logado E já tiver um restaurante
    if (!isUserLoading && !isResLoading && user && hasRestaurant) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, hasRestaurant, isResLoading, router]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurantName || !userName) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: "Por favor, preencha todos os campos.",
        });
        return;
    }

    // Se o usuário não está logado, valida a senha
    if (!user && password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro de Validação",
        description: "As senhas não coincidem.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let targetUser = user;

      // Se não estiver logado, cria a conta primeiro
      if (!targetUser) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          targetUser = userCredential.user;
          await updateProfile(targetUser, { displayName: userName });
      }
      
      const batch = writeBatch(firestore);
      
      // 1. Cria o Restaurante
      const restaurantRef = doc(collection(firestore, "restaurants"));
      batch.set(restaurantRef, {
          name: restaurantName,
          plan: 'basico',
          status: 'ativo',
          createdAt: serverTimestamp()
      });

      // 2. Cria/Atualiza o Perfil do Usuário
      const userProfileRef = doc(firestore, `users/${targetUser.uid}`);
      batch.set(userProfileRef, {
        name: userName,
        email: targetUser.email,
        avatarUrl: targetUser.photoURL || ''
      }, { merge: true });
      
      // 3. Vincula o usuário ao novo restaurante como admin
      const userRoleRef = doc(firestore, `users/${targetUser.uid}/restaurantRoles/${restaurantRef.id}`);
      batch.set(userRoleRef, {
          userId: targetUser.uid,
          restaurantId: restaurantRef.id,
          role: 'admin',
          isActive: true
      });
      
      await batch.commit();
      
      toast({
        title: 'Sucesso!',
        description: 'Seu restaurante foi criado com sucesso.',
      });
      router.push('/dashboard');
    } catch (error: any) {
        console.error("Registration Error:", error);
        let description = 'Ocorreu um erro ao processar sua solicitação.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'Este e-mail já está em uso.';
        } else if (error.code === 'auth/weak-password') {
            description = 'A senha deve ter pelo menos 6 caracteres.';
        }
        toast({
            variant: 'destructive',
            title: 'Erro',
            description,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || isUserLoading || isResLoading;

  return (
    <Card className="mx-auto max-w-sm w-full">
      <CardHeader className="space-y-1 text-center">
        <div className="inline-flex justify-center p-2">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Configurar seu Restaurante</CardTitle>
        <CardDescription>
          {user ? 'Preencha os dados do seu novo estabelecimento.' : 'Comece a gerenciar seu negócio agora mesmo.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurantName">Nome do Restaurante</Label>
              <Input 
                id="restaurantName" 
                type="text" 
                placeholder="Ex: Pizzaria do Zé" 
                required 
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                disabled={isLoading}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="userName">Seu Nome de Exibição</Label>
              <Input 
                id="userName" 
                type="text" 
                placeholder="Ex: José da Silva" 
                required 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {!user && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Seu Email (Admin)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@pizzaria.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : 'Criar Restaurante'}
            </Button>
          </div>
        </form>

        {!user && (
          <>
            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Ou
                    </span>
                </div>
            </div>

            <Button variant="outline" className="w-full" disabled={isLoading}>
                <GoogleIcon className="mr-2 h-4 w-4" />
                Cadastrar com Google
            </Button>

            <div className="mt-4 text-center text-sm">
              Já tem uma conta?{' '}
              <Link href="/login" className="underline">
                Login
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, doc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { UtensilsCrossed, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRestaurant } from "@/hooks/use-restaurant";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 48 48" role="img" aria-label="Google sign-in" {...props}>
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.591,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );

function RegisterContent() {
  const [restaurantName, setRestaurantName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { hasRestaurant, isLoading: isResLoading } = useRestaurant();
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inviteId = searchParams.get('invite');
  const invitedRestId = searchParams.get('rest');

  useEffect(() => {
    if (!isUserLoading && !isResLoading && user && hasRestaurant) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, hasRestaurant, isResLoading, router]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao entrar com Google.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!inviteId && !restaurantName) {
        toast({ variant: "destructive", title: "Erro", description: "Preencha o nome do restaurante." });
        return;
    }

    setIsSubmitting(true);
    try {
      let targetUser = user;
      
      // 1. Criar usuário se não estiver logado
      if (!targetUser) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          targetUser = userCredential.user;
          await updateProfile(targetUser, { displayName: userName });
      }
      
      const batch = writeBatch(firestore);
      let targetRestaurantId = invitedRestId;
      let targetRole = 'waiter';

      // 2. Se for convite, validar e preparar atualização
      if (inviteId && invitedRestId) {
          const inviteRef = doc(firestore, `restaurants/${invitedRestId}/invitations/${inviteId}`);
          const inviteSnap = await getDoc(inviteRef);
          
          if (!inviteSnap.exists()) {
              toast({ variant: 'destructive', title: 'Erro', description: 'Convite inválido ou expirado.' });
              setIsSubmitting(false);
              return;
          }
          
          targetRole = inviteSnap.data().role || 'waiter';
          batch.update(inviteRef, { status: 'accepted' });
      } else {
          // 3. Criar novo restaurante se não for convite
          const restaurantRef = doc(collection(firestore, "restaurants"));
          targetRestaurantId = restaurantRef.id;
          targetRole = 'admin';
          
          batch.set(restaurantRef, {
              name: restaurantName,
              plan: 'basico',
              status: 'ativo',
              createdAt: serverTimestamp()
          });
      }

      // 4. Salvar perfil do usuário
      const userProfileRef = doc(firestore, `users/${targetUser.uid}`);
      batch.set(userProfileRef, {
        name: targetUser.displayName || userName || targetUser.email,
        email: targetUser.email,
        avatarUrl: targetUser.photoURL || '',
        activeRestaurantId: targetRestaurantId
      }, { merge: true });
      
      // 5. Salvar na subcoleção de equipe
      const memberRef = doc(firestore, `restaurants/${targetRestaurantId}/team/${targetUser.uid}`);
      batch.set(memberRef, {
          userId: targetUser.uid,
          email: targetUser.email,
          role: targetRole,
          isActive: true,
          restaurantId: targetRestaurantId,
          createdAt: serverTimestamp()
      });
      
      await batch.commit();
      
      toast({ 
        title: 'Sucesso!', 
        description: inviteId ? 'Você entrou para a equipe!' : 'Seu restaurante foi configurado.' 
      });
      
      router.push('/dashboard');
    } catch (error: any) {
        console.error("Registration Error:", error);
        toast({ 
          variant: 'destructive', 
          title: 'Erro no Cadastro', 
          description: error.message || 'Ocorreu uma falha ao processar o seu registro.' 
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-sm w-full">
      <CardHeader className="space-y-1 text-center">
        <UtensilsCrossed className="mx-auto h-8 w-8 text-primary" />
        <CardTitle className="text-2xl font-bold">
            {inviteId ? 'Aceitar Convite' : 'Criar Restaurante'}
        </CardTitle>
        <CardDescription>
            {inviteId ? 'Finalize seu perfil para começar.' : 'Configure seu negócio em segundos.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          {!inviteId && (
            <div className="space-y-2">
                <Label>Nome do Restaurante</Label>
                <Input 
                  placeholder="Ex: Pizzaria do Zé" 
                  required 
                  value={restaurantName} 
                  onChange={(e) => setRestaurantName(e.target.value)} 
                  disabled={isSubmitting} 
                />
            </div>
          )}
          
          {!user ? (
            <>
              <div className="space-y-2">
                <Label>Seu Nome</Label>
                <Input 
                  placeholder="Ex: José Silva" 
                  required 
                  value={userName} 
                  onChange={(e) => setUserName(e.target.value)} 
                  disabled={isSubmitting} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  disabled={isSubmitting} 
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={isSubmitting} 
                  minLength={6}
                />
              </div>
            </>
          ) : (
            <div className="bg-muted p-3 rounded-md text-sm text-center">
              Logado como: <strong>{user.displayName || user.email}</strong>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : inviteId ? 'Entrar para a Equipe' : 'Finalizar Cadastro'}
          </Button>

          {!user && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isSubmitting}>
                <GoogleIcon className="mr-2 h-4 w-4" /> Registrar com Google
              </Button>
            </>
          )}
          <p className="text-center text-xs text-muted-foreground mt-4">
            Já tem uma conta? <Link href="/login" className="underline">Faça login</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <RegisterContent />
        </Suspense>
    );
}

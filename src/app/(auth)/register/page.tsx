'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, doc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
import { Loader2, Download, Smartphone, Share2, PlusSquare, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect, Suspense, use } from 'react';
import { useRestaurant } from "@/hooks/use-restaurant";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 48 48" role="img" aria-label="Google sign-in" {...props}>
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.021,35.591,44,30.138,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );

function RegisterContent({ inviteId, invitedRestId }: { inviteId?: string, invitedRestId?: string }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { hasRestaurant, isLoading: isResLoading, role } = useRestaurant();
  
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredRole, setRegisteredRole] = useState<string | null>(null);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Detecta modo standalone
    const standalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detecta iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    // Só redireciona automaticamente se não estiver na tela de sucesso de cadastro
    if (!registeredRole && !isUserLoading && !isResLoading && user && hasRestaurant) {
      if (role === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/orders');
      }
    }
  }, [user, isUserLoading, hasRestaurant, isResLoading, role, registeredRole, router]);

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

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      toast({
        title: "Instalação do App",
        description: "Abra as opções do seu navegador (três pontinhos) e toque em 'Adicionar à tela inicial' ou 'Instalar aplicativo'."
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: "Instalado!", description: "O app foi adicionado à sua tela inicial." });
    }
    setDeferredPrompt(null);
  };

  const handleProceedToApp = () => {
    if (registeredRole === 'admin') {
      router.push('/dashboard');
    } else {
      router.push('/orders');
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
      
      if (!targetUser) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          targetUser = userCredential.user;
          await updateProfile(targetUser, { displayName: userName });
      }
      
      const batch = writeBatch(firestore);
      let targetRestaurantId = invitedRestId;
      let targetRole = 'waiter';

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

      const userProfileRef = doc(firestore, `users/${targetUser.uid}`);
      batch.set(userProfileRef, {
        name: targetUser.displayName || userName || targetUser.email,
        email: targetUser.email,
        avatarUrl: targetUser.photoURL || '',
        activeRestaurantId: targetRestaurantId
      }, { merge: true });
      
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
        title: 'Cadastro realizado!', 
        description: inviteId ? 'Você entrou para a equipe como Garçom/Ajudante!' : 'Seu restaurante foi configurado.' 
      });
      
      // Exibe a tela especial de convite para instalar o App no celular
      setRegisteredRole(targetRole);
    } catch (error: any) {
        console.error("Registration Error:", error);
        let desc = error.message || 'Ocorreu uma falha ao processar o seu registro.';
        if (error.code === 'auth/operation-not-allowed') {
          desc = 'O método E-mail/Senha precisa ser ativado no Firebase Console > Authentication > Método de login.';
        } else if (error.code === 'auth/email-already-in-use') {
          desc = 'Este e-mail já está cadastrado. Faça login na tela anterior.';
        } else if (error.code === 'auth/weak-password') {
          desc = 'A senha precisa ter pelo menos 6 caracteres.';
        }
        toast({ 
          variant: 'destructive', 
          title: 'Erro no Cadastro', 
          description: desc
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  // 📲 Tela de Sucesso com Pedido de Instalação do App no Celular com Ícone Oficial
  if (registeredRole) {
    return (
      <Card className="mx-auto max-w-sm w-full shadow-2xl border-2 border-primary/30 animate-in zoom-in-95 duration-500 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-400 to-primary w-full" />
        <CardHeader className="space-y-3 text-center pb-2 pt-6">
          <div className="relative mx-auto size-20 rounded-3xl overflow-hidden shadow-xl ring-4 ring-primary/20 bg-primary/10 flex items-center justify-center">
            <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute bottom-0 right-0 bg-primary text-white p-1 rounded-tl-xl shadow">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Cadastro Concluído
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-tight pt-1">
              Instale a Comanda no seu Celular
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              Adicione o aplicativo à sua tela inicial para abrir mesas e anotar pedidos com agilidade diretamente no seu aparelho com o ícone oficial.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 pb-6">
          <div className="bg-muted/40 rounded-2xl p-4 border space-y-2 text-left">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <Smartphone className="h-4 w-4 text-primary shrink-0" />
              <span>Funciona como um aplicativo nativo</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pl-6.5">
              Não ocupa espaço na memória, abre em tela cheia e você não precisa digitar endereço no navegador para atender as mesas.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Button 
              onClick={handleInstallClick} 
              className="w-full h-12 text-sm font-black uppercase shadow-lg shadow-primary/25 gap-2 rounded-xl"
            >
              <Download className="h-4 w-4" />
              Instalar Aplicativo no Celular
            </Button>

            <Button 
              variant="outline" 
              onClick={handleProceedToApp} 
              className="w-full h-11 text-xs font-bold gap-2 rounded-xl border-2"
            >
              <span>{registeredRole === 'admin' ? 'Acessar Dashboard' : 'Continuar para os Pedidos'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>

        {/* Modal Guia para iOS Safari */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <Card className="w-full max-w-sm rounded-3xl bg-background border-2 shadow-2xl p-6 space-y-5 text-center">
              <div className="size-16 rounded-2xl overflow-hidden shadow-lg ring-4 ring-primary/20 mx-auto">
                <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase tracking-tight">Instalar no iPhone / iPad</h3>
                <p className="text-xs text-muted-foreground">
                  Para instalar a Comanda Digital com o ícone oficial:
                </p>
              </div>
              <div className="bg-muted/40 rounded-2xl p-4 text-left space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs">1</span>
                  <p>Toque no botão de <strong>Compartilhar</strong> <Share2 className="inline h-4 w-4 text-primary ml-1" /> na barra inferior do Safari.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs">2</span>
                  <p>Role a lista e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare className="inline h-4 w-4 text-primary ml-1" />.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-xs">3</span>
                  <p>Toque em <strong>"Adicionar"</strong> no canto superior direito.</p>
                </div>
              </div>
              <Button className="w-full h-11 font-bold rounded-xl" onClick={() => { setShowIOSGuide(false); handleProceedToApp(); }}>
                Tudo Pronto, Abrir App!
              </Button>
            </Card>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-sm w-full">
      <CardHeader className="space-y-2 text-center pb-2">
        <div className="mx-auto size-14 rounded-2xl overflow-hidden shadow-md ring-2 ring-primary/20 bg-primary/10 flex items-center justify-center">
          <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <CardTitle className="text-2xl font-bold">
            {inviteId ? 'Aceitar Convite' : 'Criar Restaurante'}
        </CardTitle>
        <CardDescription>
            {inviteId ? 'Finalize seu perfil para começar a atender.' : 'Configure seu negócio em segundos.'}
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
          <p className="text-center text-sm mt-4">
            Já tem uma conta? <Link href="/login" className="underline">Faça login</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage(props: { searchParams: Promise<{ invite?: string, rest?: string }> }) {
    const searchParams = use(props.searchParams);
    const inviteId = searchParams.invite;
    const invitedRestId = searchParams.rest;

    return (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
            <RegisterContent inviteId={inviteId} invitedRestId={invitedRestId} />
        </Suspense>
    );
}

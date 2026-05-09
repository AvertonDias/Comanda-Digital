'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, UtensilsCrossed, Smartphone } from 'lucide-react';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Impede o navegador de mostrar o prompt padrão imediatamente
      e.preventDefault();
      // Salva o evento para ser disparado depois
      setDeferredPrompt(e);
      // Mostra o nosso aviso personalizado
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Verifica se já está instalado (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt nativo
    deferredPrompt.prompt();

    // Aguarda a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação');
    } else {
      console.log('Usuário recusou a instalação');
    }

    // Limpa o prompt salvo
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] animate-in slide-in-from-bottom-full duration-700 ease-in-out">
      <Card className="shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-primary/30 bg-background/95 backdrop-blur-xl overflow-hidden">
        <div className="h-1 bg-primary w-full animate-pulse" />
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg shadow-primary/20">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div className="space-y-0.5">
              <p className="font-black text-sm uppercase tracking-tight">Instalar Aplicativo</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> Acesso rápido na tela inicial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
                onClick={handleInstallClick} 
                className="h-10 px-5 gap-2 font-black uppercase text-[10px] shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar Agora
            </Button>
            <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setShowPrompt(false)} 
                className="h-10 w-10 text-muted-foreground hover:bg-muted/50 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
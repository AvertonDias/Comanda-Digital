'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, UtensilsCrossed } from 'lucide-react';

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
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom-full duration-500">
      <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-md">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Instalar Comanda Digital</p>
              <p className="text-xs text-muted-foreground">Acesse mais rápido da sua tela inicial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleInstallClick} className="h-8 gap-2">
              <Download className="h-3 w-3" />
              Instalar
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setShowPrompt(false)} className="h-8 w-8 text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
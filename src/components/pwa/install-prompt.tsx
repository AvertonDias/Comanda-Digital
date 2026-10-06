'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Share2, PlusSquare } from 'lucide-react';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Detecta se já está em modo standalone (app instalado)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Detecta iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // No iOS, se não estiver instalado, mostra o aviso após 2 segundos
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => {
        const hasDismissed = sessionStorage.getItem('pwa_dismissed');
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa_dismissed', 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 z-[100] max-w-md mx-auto animate-in slide-in-from-bottom-full duration-500">
        <Card className="shadow-2xl border-2 border-primary/40 bg-background/95 backdrop-blur-xl overflow-hidden rounded-2xl">
          <div className="h-1 bg-gradient-to-r from-primary via-emerald-400 to-primary w-full" />
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-12 rounded-2xl overflow-hidden shadow-md ring-2 ring-primary/20 shrink-0 bg-primary/10">
                <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="font-black text-xs sm:text-sm uppercase tracking-tight truncate">Instalar no Celular</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                  <Smartphone className="h-3 w-3 text-primary shrink-0" /> Ícone na tela inicial
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button 
                  onClick={handleInstallClick} 
                  size="sm"
                  className="h-9 px-3.5 gap-1.5 font-black uppercase text-[10px] shadow-md shadow-primary/20 rounded-xl active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar
              </Button>
              <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={handleDismiss} 
                  className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Guia para iOS Safari */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-sm rounded-3xl bg-background border-2 shadow-2xl p-6 space-y-5 text-center">
            <div className="size-16 rounded-2xl overflow-hidden shadow-lg ring-4 ring-primary/20 mx-auto">
              <img src="/app-icon.jpg" alt="Comanda Digital" className="size-full object-cover" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black uppercase tracking-tight">Instalar no iPhone / iPad</h3>
              <p className="text-xs text-muted-foreground">
                Siga os passos abaixo para instalar o app com o ícone oficial:
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
            <Button className="w-full h-11 font-bold rounded-xl" onClick={() => setShowIOSModal(false)}>
              Entendi
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}

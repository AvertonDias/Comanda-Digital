
'use client';

import { cn } from '@/lib/utils';
import React, { useState, useEffect, useRef } from 'react';

export function AppHeader({ children }: { children: React.ReactNode }) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Esconde o header ao rolar para baixo, mostra ao rolar para cima.
      // Um limite (e.g., > 80) evita esconder em pequenas rolagens no topo.
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-md transition-transform duration-300 md:px-6",
        !isHeaderVisible && '-translate-y-full'
      )}
    >
      {children}
    </header>
  );
}

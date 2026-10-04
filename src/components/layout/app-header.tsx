
'use client';

import { cn } from '@/lib/utils';
import React from 'react';

export function AppHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-md shadow-xs md:px-6",
        className
      )}
    >
      {children}
    </header>
  );
}


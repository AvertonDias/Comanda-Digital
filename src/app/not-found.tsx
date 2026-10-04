import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">Página não encontrada</h2>
      <p className="text-muted-foreground mb-4">A página que você está procurando não existe.</p>
      <Button asChild>
        <Link href="/dashboard">Voltar ao Início</Link>
      </Button>
    </div>
  );
}

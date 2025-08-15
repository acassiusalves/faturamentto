"use client";
import { ReturnsForm } from './returns-form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';


export default function DevolucoesPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-8">
        <Link href="/estoque" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit mb-4">
            <ChevronLeft className="h-4 w-4" />
            Voltar ao Estoque
        </Link>
       <div>
          <h1 className="text-3xl font-bold font-headline">Devolução de Pedidos</h1>
          <p className="text-muted-foreground">Registre a entrada de produtos retornados por clientes.</p>
        </div>
        <ReturnsForm />
    </div>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';

export default function DadosFreteMercadoLivrePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Dados de Frete do Mercado Livre</h1>
        <p className="text-muted-foreground">
          Consulte e gerencie dados relacionados ao frete do Mercado Livre.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
          <CardDescription>
            Esta funcionalidade está sendo desenvolvida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
          <Truck className="h-16 w-16 mb-4" />
          <p>A funcionalidade de análise de fretes do Mercado Livre estará disponível aqui em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}

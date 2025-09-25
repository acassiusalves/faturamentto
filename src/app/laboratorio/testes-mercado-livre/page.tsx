"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MercadoLivreLogo } from '@/components/icons';

export default function TestesMercadoLivrePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Testes com API do Mercado Livre</h1>
        <p className="text-muted-foreground">
          Esta área é dedicada a testes e integrações com o Mercado Livre.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MercadoLivreLogo className="h-6 w-6" />
            Em Construção
          </CardTitle>
          <CardDescription>
            Funcionalidades de teste para o Mercado Livre aparecerão aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
          <p>Página em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
}

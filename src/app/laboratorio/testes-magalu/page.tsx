
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MagaluLogo } from '@/components/icons';

export default function TestesMagaluPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Laboratório de Testes - Magalu</h1>
        <p className="text-muted-foreground">
          Área para testar integrações e funcionalidades com a API da Magazine Luiza.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
          <CardDescription>
            Esta página é um laboratório para a integração com a Magalu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
          <MagaluLogo className="h-20 w-auto mb-4" />
          <p>Funcionalidades experimentais para a Magalu aparecerão aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}

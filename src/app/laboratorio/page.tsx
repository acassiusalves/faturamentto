"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker } from 'lucide-react';

export default function LaboratorioPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Laboratório de Testes</h1>
        <p className="text-muted-foreground">
          Uma área para testar novas integrações e funcionalidades.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
          <CardDescription>
            Esta página é um laboratório para novas ideias.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
          <Beaker className="h-16 w-16 mb-4" />
          <p>Funcionalidades experimentais aparecerão aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}

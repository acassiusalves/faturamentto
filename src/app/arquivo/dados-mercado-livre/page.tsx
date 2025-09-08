
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

export default function DadosMercadoLivrePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Dados Mercado Livre</h1>
        <p className="text-muted-foreground">
          Consulte e gerencie os dados salvos das suas análises do Mercado Livre.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Dados Salvos</CardTitle>
            <CardDescription>
                Esta área exibirá os dados salvos da ferramenta "Buscar Categoria no Mercado Livre".
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <Database className="h-16 w-16 mb-4" />
                <p className="font-semibold">Nenhum dado salvo ainda.</p>
                <p>A funcionalidade para exibir os dados será implementada aqui.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

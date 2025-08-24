
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function EtiquetasPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciador de Etiquetas</h1>
        <p className="text-muted-foreground">
          Gere e imprima as etiquetas para os seus envios.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Etiquetas</CardTitle>
            <CardDescription>Esta página está em construção.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <FileText className="h-16 w-16 mb-4" />
                <p>A funcionalidade de geração de etiquetas será implementada aqui.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

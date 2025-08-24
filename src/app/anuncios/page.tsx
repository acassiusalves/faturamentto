"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

export default function AnunciosPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciador de Anúncios</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os anúncios dos seus canais de venda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anúncios</CardTitle>
          <CardDescription>
            Funcionalidade em desenvolvimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <Megaphone className="h-16 w-16 mb-4" />
            <p>A gestão de anúncios será implementada aqui em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}

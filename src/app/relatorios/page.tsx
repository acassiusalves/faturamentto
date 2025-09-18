"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere e visualize relatórios personalizados sobre suas operações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
          <CardDescription>
            Esta página está em desenvolvimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4" />
          <p>A funcionalidade de relatórios estará disponível em breve.</p>
        </CardContent>
      </Card>
    </div>
  );
}

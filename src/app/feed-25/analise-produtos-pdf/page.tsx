
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnaliseProdutosPdfPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Análise de Produtos PDF</h1>
        <p className="text-muted-foreground">
          Página em construção.
        </p>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
          <CardDescription>
            Esta funcionalidade está sendo reconstruída.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <p>Aguardando novas instruções para reconstruir esta página.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

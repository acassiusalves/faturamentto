
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountAnalysisPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Análise por Conta</h1>
        <p className="text-muted-foreground">
          Aqui você poderá analisar o desempenho de cada conta individualmente.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Esta página está em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}

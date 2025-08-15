"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function ComprasPage() {

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Relatório de Compras</h1>
        <p className="text-muted-foreground">
          Análise de produtos vendidos para auxiliar nas decisões de compra de estoque.
        </p>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Análise de Vendas para Compra</CardTitle>
          <CardDescription>
            Aguardando as próximas instruções para desenvolver esta funcionalidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

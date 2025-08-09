"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "./ui/button";

export function ProductSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Produto</CardTitle>
        <CardDescription>
          Gerencie atributos e outras configurações para seus produtos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Componente de configurações em breve.</p>
            <Button variant="link">Sugerir Funcionalidade</Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "./ui/button";

interface ProductCreatorProps {
  category: string;
}

export function ProductCreator({ category }: ProductCreatorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar Produto - {category}</CardTitle>
        <CardDescription>
          Preencha os detalhes para criar um novo modelo de produto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Componente de criação de produto em breve.</p>
            <Button variant="link">Sugerir Funcionalidade</Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Central de Aprovações</h1>
        <p className="text-muted-foreground">
          Gerencie e aprove solicitações pendentes no sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Aprovações Pendentes</CardTitle>
            <CardDescription>
                Não há nenhuma atividade pendente de aprovação no momento.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <ListChecks className="h-12 w-12 mb-4" />
                <p>Tudo em ordem por aqui!</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

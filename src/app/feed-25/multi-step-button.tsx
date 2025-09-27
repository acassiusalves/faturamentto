
"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { processListFullFlowAction } from "@/app/actions";
import { Loader2, Wand2 } from "lucide-react";

export function BotaoFluxoCompletoIA({
  getTextareaValue,
  getDatabaseValue,
  onFinish,
}: {
  getTextareaValue: () => string;
  getDatabaseValue: () => string;
  onFinish?: (r: Awaited<ReturnType<typeof processListFullFlowAction>>) => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleRun = () => {
    const rawList = getTextareaValue();
    const databaseList = getDatabaseValue();

    if (!rawList.trim()) {
        toast({ title: "Lista vazia", description: "Por favor, insira uma lista de produtos.", variant: "destructive" });
        return;
    }
    if (!databaseList.trim()) {
        toast({ title: "Banco de dados vazio", description: "O banco de dados de produtos está vazio.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('rawList', rawList);
        formData.append('databaseList', databaseList);
        
        const result = await processListFullFlowAction({ result: null, error: null }, formData);
        
        if (result.error) {
            throw new Error(result.error);
        }

        toast({ title: "Fluxo concluído ✅", description: "Processamento finalizado com sucesso." });
        onFinish?.(result);
      } catch (e: any) {
        toast({ title: "Erro no fluxo", description: e?.message || "Falha ao processar", variant: "destructive" });
      }
    });
  };

  return (
    <Button onClick={handleRun} disabled={isPending} variant="secondary">
      {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</>) : (<><Wand2 className="mr-2 h-4 w-4" /> Fluxo Completo (IA)</>)}
    </Button>
  );
}

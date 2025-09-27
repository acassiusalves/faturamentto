
"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { processListFullFlowAction } from "@/app/actions";
import { Loader2, Wand2 } from "lucide-react";
import type { FullFlowResult } from "@/lib/types";

export function BotaoFluxoCompletoIA({
  textareaRef,
  databaseRef,
  onFinish,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  databaseRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  onFinish?: (r: FullFlowResult | null) => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleRun = () => {
    const rawList = textareaRef.current?.value || "";
    const databaseList = databaseRef.current?.value || "";

    if (!rawList.trim()) {
        toast({ title: "Lista vazia", description: "Por favor, insira uma lista de produtos.", variant: "destructive" });
        return;
    }
    if (!databaseList.trim()) {
        toast({ title: "Banco de dados vazio", description: "O banco de dados de produtos está vazio.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('rawList', rawList);
      formData.append('databaseList', databaseList);
      
      let resp: Awaited<ReturnType<typeof processListFullFlowAction>> | undefined;

      try {
        resp = await processListFullFlowAction(formData);
      } catch (e: any) {
        toast({ title: "Erro no fluxo", description: String(e?.message || e), variant: "destructive" });
        return;
      }
      
      if (!resp) {
          toast({ title: "Erro no fluxo", description: "A ação não retornou uma resposta.", variant: "destructive" });
          return;
      }

      const { result, error } = resp;

      if (error) {
          toast({ title: "Erro no fluxo", description: String(error), variant: "destructive" });
          return;
      }
      
      toast({ title: "Fluxo concluído ✅", description: "Resultados disponíveis." });
      onFinish?.(result!);
    });
  };

  return (
    <Button onClick={handleRun} disabled={isPending} variant="secondary">
      {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</>) : (<><Wand2 className="mr-2 h-4 w-4" /> Fluxo Completo (IA)</>)}
    </Button>
  );
}


"use client";

import { useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Loader2 } from 'lucide-react';
import { debugMappingAction } from '@/app/actions';
import type { AnalyzeLabelOutput } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MappingDebuggerProps {
  originalZpl: string;
  analysisResult: AnalyzeLabelOutput;
  onMappingDebug: (info: any) => void;
}

export function MappingDebugger({
  originalZpl,
  analysisResult,
  onMappingDebug,
}: MappingDebuggerProps) {
  const [debugState, debugAction, isDebugging] = useActionState(debugMappingAction, {
    result: null,
    error: null,
  });
  const [isTransitioning, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDebugClick = () => {
    startTransition(() => {
        const formData = new FormData();
        formData.append('originalZpl', originalZpl);
        formData.append('extractedData', JSON.stringify(analysisResult));
        debugAction(formData);
    });
    setIsDialogOpen(true);
  };

  const debugResult = debugState?.result;
  const isPending = isDebugging || isTransitioning;

  return (
    <>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={handleDebugClick} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 animate-spin"/> : <BrainCircuit className="mr-2" />}
          Debug Mapeamento
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Debug do Mapeamento Preciso</DialogTitle>
            <DialogDescription>
              Informações sobre como o sistema analisou a etiqueta ZPL.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto p-1">
            {isPending ? (
                 <div className="flex items-center justify-center h-48">
                    <Loader2 className="animate-spin text-primary" />
                 </div>
            ) : debugResult ? (
              <div className="space-y-4">
                <div className="flex gap-4">
                    <Badge>Total de Elementos: {debugResult.stats?.totalElements}</Badge>
                    <Badge variant="secondary">Campos Mapeados: {debugResult.stats?.mappedFields}</Badge>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Campos Mapeados com Sucesso:</h3>
                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="space-y-1 text-xs">
                        {debugResult.mappedFields.map((item: any) => (
                           <div key={item.field} className="flex justify-between items-center p-1 bg-muted/50 rounded">
                                <span className="font-bold">{item.field}:</span>
                                <span>{item.content}</span>
                                <Badge variant="outline">Linha {item.line}</Badge>
                                <Badge variant="default" className="bg-green-600">Conf: {item.confidence}</Badge>
                           </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Todos os Elementos Extraídos:</h3>
                  <ScrollArea className="h-64 rounded-md border p-2">
                    <div className="space-y-1 text-xs">
                        {debugResult.allElements.map((item: any, i: number) => (
                             <div key={i} className="flex justify-between items-center p-1 bg-muted/50 rounded">
                                <span>{item.content}</span>
                                <Badge variant="outline">Linha {item.line}</Badge>
                           </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : debugState?.error ? (
              <p className="text-destructive">{debugState.error}</p>
            ) : (
              <p>Clique no botão de debug para ver os resultados.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

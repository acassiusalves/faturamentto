
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

export interface SkuConflict {
  childSku: string;
  parentSkus: string[];
}

interface ConflictCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: SkuConflict[];
}

export function ConflictCheckDialog({ isOpen, onClose, conflicts }: ConflictCheckDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório de Conflitos de SKU</DialogTitle>
          <DialogDescription>
            Resultado da verificação de SKUs de anúncios associados a múltiplos produtos principais.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {conflicts.length === 0 ? (
            <Alert variant="default" className="border-green-500/50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="font-semibold">Nenhum Conflito Encontrado</AlertTitle>
              <AlertDescription>
                Parabéns! Todos os seus SKUs de anúncios estão associados a apenas um produto principal.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-semibold">
                  {conflicts.length} Conflito(s) Encontrado(s)
                </AlertTitle>
                <AlertDescription>
                  Os SKUs de anúncio abaixo estão vinculados a mais de um produto principal. Isso pode causar erros no picking. Recomendamos corrigir essas associações.
                </AlertDescription>
              </Alert>
              <ScrollArea className="mt-4 h-[40vh] rounded-md border p-4">
                 <div className="space-y-4">
                    {conflicts.map((conflict, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-semibold">
                                SKU do Anúncio (Filho): <Badge>{conflict.childSku}</Badge>
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Está associado a múltiplos SKUs Pais:
                                </p>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 pl-6">
                                {conflict.parentSkus.map(parentSku => (
                                    <Badge key={parentSku} variant="destructive">{parentSku}</Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

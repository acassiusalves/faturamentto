
"use client";

import { useState } from "react";
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
import { CheckCircle, AlertTriangle, ArrowRight, Save, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";

export interface SkuConflict {
  childSku: string;
  parentProducts: {
    sku: string;
    name: string;
    productId: string;
  }[];
}

interface ConflictCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: SkuConflict[];
  onSave: (corrections: Map<string, string>) => Promise<void>;
  isSaving: boolean;
}

export function ConflictCheckDialog({ isOpen, onClose, conflicts, onSave, isSaving }: ConflictCheckDialogProps) {
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const handleSelectionChange = (childSku: string, correctParentId: string) => {
    setSelections(prev => new Map(prev).set(childSku, correctParentId));
  };
  
  const handleSaveChanges = () => {
    onSave(selections);
  }

  const canSave = selections.size > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Relatório e Correção de Conflitos de SKU</DialogTitle>
          <DialogDescription>
            Resultado da verificação de SKUs de anúncios associados a múltiplos produtos principais. Selecione a associação correta para cada conflito.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 flex-grow overflow-y-auto">
          {conflicts.length === 0 ? (
            <Alert variant="default" className="border-green-500/50 h-full flex flex-col justify-center items-center">
              <CheckCircle className="h-10 w-10 text-green-600 mb-4" />
              <AlertTitle className="font-semibold text-lg">Nenhum Conflito Encontrado</AlertTitle>
              <AlertDescription>
                Parabéns! Todos os seus SKUs de anúncios estão associados a apenas um produto principal.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-semibold">
                  {conflicts.length} Conflito(s) Encontrado(s)
                </AlertTitle>
                <AlertDescription>
                  Os SKUs de anúncio abaixo estão vinculados a mais de um produto principal. Isso pode causar erros no picking. Selecione a associação correta e salve.
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[calc(80vh-150px)] rounded-md border p-4">
                 <div className="space-y-4">
                    {conflicts.map((conflict, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg">
                            <div className="font-semibold mb-2">
                                SKU do Anúncio (Filho): <Badge>{conflict.childSku}</Badge>
                            </div>
                            <RadioGroup 
                                onValueChange={(value) => handleSelectionChange(conflict.childSku, value)}
                                value={selections.get(conflict.childSku)}
                            >
                                <div className="space-y-2 pl-6">
                                    <p className="text-sm text-muted-foreground">Selecione o produto Pai correto:</p>
                                    {conflict.parentProducts.map(parent => (
                                        <Label key={parent.productId} className="flex items-center gap-3 p-2 rounded-md hover:bg-background transition-colors cursor-pointer border">
                                            <RadioGroupItem value={parent.productId} id={`${conflict.childSku}-${parent.productId}`} />
                                            <div className="flex flex-col">
                                                <Badge variant="default" className="w-fit">{parent.sku}</Badge>
                                                <span className="text-sm font-normal text-foreground">{parent.name}</span>
                                            </div>
                                        </Label>
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>
                    ))}
                 </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {conflicts.length > 0 && (
                <Button onClick={handleSaveChanges} disabled={!canSave || isSaving}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Salvar Correções
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

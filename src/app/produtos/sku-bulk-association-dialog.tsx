
"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadProducts } from "@/services/firestore";
import type { Product } from "@/lib/types";

interface SkuBulkAssociationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (associations: Map<string, string[]>) => Promise<void>;
}

export function SkuBulkAssociationDialog({ isOpen, onClose, onSave }: SkuBulkAssociationDialogProps) {
  const [textValue, setTextValue] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();
  
  const handleClose = () => {
    setTextValue("");
    onClose();
  };

  const handleImport = async () => {
    if (!textValue.trim()) {
        toast({ variant: 'destructive', title: 'Nenhum dado inserido', description: 'Por favor, cole os dados de associação na área de texto.'});
        return;
    }
    
    setIsParsing(true);
    try {
        const lines = textValue.trim().split('\n');
        const associations = new Map<string, string[]>();
        let invalidLines = 0;
        let existingChildSkus = new Set<string>();
        const conflictingChildSkus = new Set<string>();

        // Pre-load all products to check for existing associations
        const allProducts: Product[] = await loadProducts();
        allProducts.forEach(p => {
            p.associatedSkus?.forEach(childSku => {
                existingChildSkus.add(childSku);
            });
        });

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/); // Split by one or more spaces/tabs
            if (parts.length === 2) {
                const [parentSku, childSku] = parts;
                
                // Check for conflict: if child SKU is already associated with another parent
                if (existingChildSkus.has(childSku)) {
                    const ownerProduct = allProducts.find(p => p.associatedSkus?.includes(childSku));
                    // Allow adding to the same parent again (idempotent), but not a different one.
                    if (ownerProduct && ownerProduct.sku !== parentSku) {
                        conflictingChildSkus.add(childSku);
                        continue; // Skip this conflicting association
                    }
                }

                if (!associations.has(parentSku)) {
                    associations.set(parentSku, []);
                }
                associations.get(parentSku)?.push(childSku);
                existingChildSkus.add(childSku); // Add to our set for checks within the same import list

            } else {
                invalidLines++;
            }
        }
        
        if (associations.size === 0 && conflictingChildSkus.size === 0) {
            toast({
                variant: 'destructive',
                title: 'Nenhuma Associação Válida Encontrada',
                description: 'Verifique o formato dos dados. O padrão esperado é "SKU_PAI SKU_FILHO" por linha.',
            });
        } else {
            if (associations.size > 0) {
                await onSave(associations);
            }
            if (invalidLines > 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Linhas Inválidas',
                    description: `${invalidLines} linhas foram ignoradas por não estarem no formato correto.`,
                });
            }
            if (conflictingChildSkus.size > 0) {
                toast({
                    variant: 'destructive',
                    title: 'Conflitos de Associação',
                    description: `${conflictingChildSkus.size} SKUs filhos já estão associados a outros produtos e foram ignorados.`,
                });
            }
            handleClose();
        }
    } catch (error) {
        console.error("Erro na associação em massa:", error);
        toast({ variant: 'destructive', title: 'Erro na Importação', description: 'Ocorreu um erro inesperado.' });
    } finally {
        setIsParsing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Associar SKUs em Massa</DialogTitle>
          <DialogDescription>
            Cole aqui a sua lista de associações. Cada linha deve conter o SKU do produto pai e o SKU a ser associado, separados por um espaço ou tab.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
           <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Formato Esperado</AlertTitle>
              <AlertDescription>
                <p>Cada linha deve conter dois SKUs: o SKU Pai (já cadastrado no sistema) e o SKU Filho (do anúncio).</p>
                <code className="block bg-muted p-2 rounded-md mt-2 text-sm">
                    #09P 175342314550C<br />
                    #09P 175342314550A<br />
                    #09V 14CVerde256x8C
                </code>
              </AlertDescription>
           </Alert>
          <div className="space-y-2">
            <Label htmlFor="bulk-associate-textarea">Lista de Associações</Label>
            <Textarea
              id="bulk-associate-textarea"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="SKU_PAI_1 SKU_FILHO_1&#x0a;SKU_PAI_1 SKU_FILHO_2&#x0a;SKU_PAI_2 SKU_FILHO_3"
              rows={15}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isParsing}>Cancelar</Button>
          <Button onClick={handleImport} disabled={isParsing}>
            {isParsing ? <Loader2 className="animate-spin" /> : <Link />}
            Processar e Salvar Associações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

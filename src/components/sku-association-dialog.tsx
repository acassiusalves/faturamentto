"use client";

import { useState, useEffect } from "react";
import type { Product } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { Trash2, Link2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SkuAssociationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSave: (product: Product, newSkus: string[]) => void;
}

export function SkuAssociationDialog({ isOpen, onClose, product, onSave }: SkuAssociationDialogProps) {
  const [associatedSkus, setAssociatedSkus] = useState<string[]>([]);
  const [newSkus, setNewSkus] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setAssociatedSkus(product.associatedSkus || []);
      setNewSkus(""); // Reset textarea on product change
    }
  }, [product]);

  const handleAddSkus = () => {
    if (!newSkus.trim()) return;

    // Split by comma, newline, or semicolon and trim whitespace
    const skusToAdd = newSkus
      .split(/[,\n;]/)
      .map(sku => sku.trim())
      .filter(Boolean); // Remove empty strings

    const uniqueNewSkus = skusToAdd.filter(sku => !associatedSkus.includes(sku));

    if (uniqueNewSkus.length > 0) {
      setAssociatedSkus(prev => [...prev, ...uniqueNewSkus]);
    }
    setNewSkus("");
  };

  const handleRemoveSku = (skuToRemove: string) => {
    setAssociatedSkus(prev => prev.filter(sku => sku !== skuToRemove));
  };

  const handleSaveChanges = () => {
    onSave(product, associatedSkus);
    toast({
        title: "Associações Salvas!",
        description: `Os SKUs foram associados ao produto ${product.name}.`
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 /> Associar SKUs ao Produto
          </DialogTitle>
          <DialogDescription>
            Adicione SKUs de anúncios diferentes que correspondem a este produto principal: <span className="font-semibold text-primary">{product.name} (SKU: {product.sku})</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-skus">Novos SKUs para Associar</Label>
            <Textarea
              id="new-skus"
              value={newSkus}
              onChange={(e) => setNewSkus(e.target.value)}
              placeholder="Cole uma lista de SKUs aqui, separados por vírgula, ponto e vírgula ou quebra de linha."
              rows={4}
            />
            <Button onClick={handleAddSkus} className="w-full">Adicionar à Lista</Button>
          </div>
          
          <div className="space-y-2">
            <Label>SKUs Associados Atualmente ({associatedSkus.length})</Label>
            <div className="p-3 border rounded-md min-h-[100px] max-h-[200px] overflow-y-auto">
              {associatedSkus.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {associatedSkus.map(sku => (
                    <Badge key={sku} variant="secondary" className="flex items-center gap-1.5 pr-1 text-sm">
                      {sku}
                      <button onClick={() => handleRemoveSku(sku)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum SKU associado ainda.</p>
              )}
            </div>
          </div>
          <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ao associar SKUs, o sistema reconhecerá as vendas de qualquer um desses códigos como pertencentes a este produto principal.
              </AlertDescription>
           </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSaveChanges}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import { useState, useEffect } from 'react';
import type { Sale } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Save, FilterX } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CostRefinementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  onSave: (costsToSave: Map<string, number>) => Promise<void>;
}

export function CostRefinementDialog({ isOpen, onClose, sales, onSave }: CostRefinementDialogProps) {
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset costs when the dialog is opened or the sales list changes
    if (isOpen) {
      setCosts(new Map());
    }
  }, [isOpen, sales]);

  const handleCostChange = (saleId: string, cost: string) => {
    const numericCost = parseFloat(cost);
    if (!isNaN(numericCost) && numericCost >= 0) {
      setCosts(prev => new Map(prev).set(saleId, numericCost));
    } else {
      // If input is cleared or invalid, remove from map
      setCosts(prev => {
        const newMap = new Map(prev);
        newMap.delete(saleId);
        return newMap;
      });
    }
  };

  const handleSaveCosts = async () => {
    setIsSaving(true);
    await onSave(costs);
    setIsSaving(false);
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
        return "Data inválida";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Refinamento de Custos</DialogTitle>
          <DialogDescription>
            Abaixo estão as vendas do período que não possuem um custo de produto associado. Insira o custo manual para cada uma.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
            {sales.length > 0 ? (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>ID Pedido</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Canal de Venda</TableHead>
                                <TableHead className="w-[150px]">Custo do Produto (R$)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sales.map(sale => (
                                <TableRow key={sale.id}>
                                    <TableCell className="font-mono text-xs">{(sale as any).order_code}</TableCell>
                                    <TableCell>{formatDate((sale as any).payment_approved_date)}</TableCell>
                                    <TableCell className="font-medium">{(sale as any).item_title}</TableCell>
                                    <TableCell>{(sale as any).marketplace_name}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            placeholder="Ex: 850.50"
                                            step="0.01"
                                            onChange={(e) => handleCostChange(sale.id, e.target.value)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FilterX className="h-10 w-10 mb-4"/>
                    <p>Nenhuma venda sem custo encontrada neste período.</p>
                </div>
            )}
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSaveCosts} disabled={costs.size === 0 || isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar Custos ({costs.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

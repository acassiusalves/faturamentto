

"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Sale, Product } from '@/lib/types';
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
import { Loader2, Save, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

interface CostRefinementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  products: Product[];
  onSave: (costsToSave: Map<string, number>) => Promise<void>;
}

export function CostRefinementDialog({ isOpen, onClose, sales, products, onSave }: CostRefinementDialogProps) {
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);


  useEffect(() => {
    // Reset costs when the dialog is opened or the sales list changes
    if (isOpen) {
      setCosts(new Map());
      setPageIndex(0); // Reset to first page when dialog opens
    }
  }, [isOpen, sales]);

  const productSkuMap = useMemo(() => {
    const map = new Map<string, string>();
    if (products) {
        products.forEach(p => {
            if(p.sku) map.set(p.sku, p.name);
            p.associatedSkus?.forEach(assocSku => {
                map.set(assocSku, p.name);
            });
        });
    }
    return map;
  }, [products]);
  
  const pageCount = Math.ceil(sales.length / pageSize);
  const paginatedSales = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return sales.slice(startIndex, startIndex + pageSize);
  }, [sales, pageIndex, pageSize]);


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
                            {paginatedSales.map(sale => {
                                const friendlyName = productSkuMap.get((sale as any).item_sku) || (sale as any).item_title;
                                return (
                                <TableRow key={sale.id}>
                                    <TableCell className="font-mono text-xs">{(sale as any).order_code}</TableCell>
                                    <TableCell>{formatDate((sale as any).payment_approved_date)}</TableCell>
                                    <TableCell className="font-medium">{friendlyName}</TableCell>
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
                            )})}
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
        <DialogFooter className="pt-4 border-t flex-wrap-reverse sm:flex-wrap">
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 flex-1 justify-center sm:justify-start">
                 <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Itens/página</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            setPageSize(Number(value));
                            setPageIndex(0);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize.toString()} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-sm font-medium">
                    Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSaveCosts} disabled={costs.size === 0 || isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                Salvar Custos ({costs.size})
              </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

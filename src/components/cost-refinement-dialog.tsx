
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
import * as Lucide from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import React from 'react';

// Fallbacks seguros p/ qualquer versão do lucide-react
const Icons = {
  Loader2: Lucide.Loader2,
  Save: Lucide.Save,
  // se FilterX não existir, cai pro Filter -> se não tiver, cai pro Search
  FilterX: (Lucide as any).FilterX ?? (Lucide as any).Filter ?? Lucide.Search,
  // se FileSpreadsheet não existir -> cai pro FileText
  FileSpreadsheet: (Lucide as any).FileSpreadsheet ?? Lucide.FileText,
  ChevronLeft: Lucide.ChevronLeft,
  ChevronRight: Lucide.ChevronRight,
  ChevronsLeft: Lucide.ChevronsLeft,
  ChevronsRight: Lucide.ChevronsRight,
};

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
  const { toast } = useToast();
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCosts(new Map());
      setPageIndex(0);
    }
  }, [isOpen]);

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
    const numericCost = parseFloat(cost.replace(',', '.'));
    setCosts(prev => {
      const next = new Map(prev);
      if (!isNaN(numericCost) && numericCost >= 0) {
        next.set(saleId, numericCost);
      } else {
        next.delete(saleId);
      }
      return next;
    });
  };

  const handleSaveCosts = async () => {
    setIsSaving(true);
    await onSave(costs);
    setIsSaving(false);
  };

  const normalizeOrderCode = (code: string) => (code || '').replace(/\D/g, '');

  const applyParsedRows = (rows: any[]) => {
      if (rows.length === 0) {
        toast({ variant: 'destructive', title: 'Arquivo Vazio', description: 'A planilha selecionada não contém dados.' });
        return;
      }
      const headers = Object.keys(rows[0]);
      if (headers.length < 2) {
        toast({ variant: 'destructive', title: 'Formato Incorreto', description: 'A planilha deve ter pelo menos duas colunas.' });
        return;
      }

      const orderHeader = headers.find(h => h.toLowerCase().includes('pedido') || h.toLowerCase().includes('order'));
      const costHeader = headers.find(h => h.toLowerCase().includes('custo') || h.toLowerCase().includes('cost'));

      if (!orderHeader || !costHeader) {
        toast({ variant: 'destructive', title: 'Colunas não encontradas', description: 'A planilha deve conter uma coluna para "pedido" e uma para "custo".' });
        return;
      }

      let updatedCount = 0;
      setCosts(prev => {
        const next = new Map(prev);
        rows.forEach(row => {
          const orderCode = row[orderHeader]?.toString().trim();
          const costValue = parseFloat(row[costHeader]?.toString().replace(',', '.'));
          
          if (orderCode && !isNaN(costValue)) {
            const normalizedOrderCode = normalizeOrderCode(orderCode);
            const saleToUpdate = sales.find(s => normalizeOrderCode((s as any).order_code) === normalizedOrderCode);
            if (saleToUpdate) {
              next.set(saleToUpdate.id, costValue);
              updatedCount++;
            }
          }
        });
        return next;
      });
      
      toast({ title: 'Planilha Processada!', description: `${updatedCount} custos foram preenchidos a partir do arquivo.` });
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (file.name.endsWith('.csv')) {
          Papa.parse(content as string, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => applyParsedRows(results.data),
          });
        } else {
          const workbook = XLSX.read(content, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          applyParsedRows(jsonData);
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao ler arquivo', description: 'O formato do arquivo pode estar corrompido.' });
      } finally {
        setIsParsing(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Refinamento de Custos</DialogTitle>
          <DialogDescription>
            Abaixo estão as vendas do período que não possuem um custo de produto associado. Insira o custo manual para cada uma ou importe uma planilha.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
            <div className="flex justify-end mb-4">
                <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileChange}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
                    {isParsing ? <Icons.Loader2 className="animate-spin" /> : <Icons.FileSpreadsheet className="mr-2 h-4 w-4" />}
                    Importar Planilha de Custos
                </Button>
            </div>
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
                                            value={costs.get(sale.id) ?? ''}
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
                    <Icons.FilterX className="h-10 w-10 mb-4"/>
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
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <Icons.ChevronsLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <Icons.ChevronLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <Icons.ChevronRight className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <Icons.ChevronsRight className="h-4 w-4" /> </Button>
                </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSaveCosts} disabled={costs.size === 0 || isSaving}>
                {isSaving ? <Icons.Loader2 className="animate-spin" /> : <Icons.Save />}
                Salvar Custos ({costs.size})
              </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

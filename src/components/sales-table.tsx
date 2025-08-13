
"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from 'react';
import type { Sale, SupportData, CustomCalculation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CostDialog } from '@/components/cost-dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sheet, View, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical, FileSpreadsheet, Package, Calculator, Loader2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { iderisFields } from '@/lib/ideris-fields';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { loadAppSettings, saveAppSettings } from '@/services/firestore';
import Image from 'next/image';

import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";


interface SalesTableProps {
  data: Sale[];
  supportData: SupportData | null;
  onUpdateSaleCosts: (saleId: string, newCosts: Sale['costs']) => void;
  calculateTotalCost: (sale: Sale) => number;
  calculateNetRevenue: (sale: Sale) => number;
  formatCurrency: (value: number) => string;
  isLoading: boolean;
  productCostSource?: Map<string, number>;
  customCalculations?: CustomCalculation[];
  isDashboard?: boolean;
}

const fixedColumns: { key: string; label: string; isCustom?: boolean }[] = [
    { key: "order_code", label: "Pedido" },
    { key: "payment_approved_date", label: "Data" },
    { key: "item_title", label: "Produto" },
    { key: "item_sku", label: "SKU" },
    { key: "item_quantity", label: "Qtd." },
    { key: "value_with_shipping", label: "Valor Bruto" },
    { key: "product_cost", label: "Custo do Produto", isCustom: true },
    { key: "fee_order", label: "Comissão" },
    { key: "left_over", label: "Lucro (Ideris)" },
];


export function SalesTable({ data, supportData, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading, productCostSource = new Map(), customCalculations = [], isDashboard = false }: SalesTableProps) {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  useEffect(() => {
    setIsClient(true);
  }, []);


  const numericColumns = useMemo(() => {
    const iderisNumeric = iderisFields
        .filter(f => f.path.toLowerCase().includes('value') || f.path.toLowerCase().includes('amount') || f.path.toLowerCase().includes('fee') || f.path.toLowerCase().includes('cost') || f.path.toLowerCase().includes('discount') || f.path.toLowerCase().includes('leftover') || f.path.toLowerCase().includes('profit'))
        .map(f => f.key);
        
    const customNumeric = customCalculations.map(c => c.id);
    const nonNumericSku = ['item_sku', 'order_code', 'id', 'document_value'];
    const finalNumeric = new Set([...iderisNumeric, 'product_cost', ...customNumeric]);
    nonNumericSku.forEach(key => finalNumeric.delete(key));

    return finalNumeric;
  }, [customCalculations]);


  const getColumnAlignment = (key: string) => {
    return numericColumns.has(key) ? 'text-right' : 'text-left';
  }
  
  const pageCount = Math.ceil(data.length / pageSize);
  
  const paginatedData = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, pageIndex, pageSize]);

  useEffect(() => {
    if (pageIndex >= pageCount) {
        setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [data, pageIndex, pageCount]);


  const renderSkeleton = () => (
    Array.from({ length: 5 }).map((_, index) => (
       <TableRow key={`skeleton-${index}`}>
         {fixedColumns.map(key => <TableCell key={`${key}-skel-${index}`}><Skeleton className="h-5 w-full" /></TableCell>)}
          <TableCell className="text-center"><Skeleton className="h-8 w-[140px] mx-auto" /></TableCell>
      </TableRow>
    ))
  );
  
  const formatDate = (dateString: string | null) => {
      if (!dateString) return 'N/A';
      try {
          if (/^\d{4}-\d{2}/.test(dateString)) {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
          }
          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
              return dateString;
          }
          return date.toLocaleDateString('pt-BR');
      } catch (e) {
          return dateString;
      }
  };

  if (!isClient) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle className="text-lg">Detalhes das Vendas</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="animate-spin" />
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
         <CardHeader className="flex flex-row items-center justify-between">
             <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle className="text-lg">Detalhes das Vendas</CardTitle>
            </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  {fixedColumns.map((field) => (
                    <TableHead key={field.key} className={cn("whitespace-nowrap", getColumnAlignment(field.key))}>
                        <div className="flex items-center gap-2">
                          {field.label}
                          {field.isCustom && <Calculator className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                    </TableHead>
                  ))}
                  {!isDashboard && <TableHead className="text-center whitespace-nowrap">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : paginatedData.length > 0 ? (
                  paginatedData.map((sale) => {
                    const productCost = productCostSource.get((sale as any).order_code);
                    return (
                      <TableRow key={sale.id}>
                        {fixedColumns.map(field => {
                          let cellContent: any;
                          
                          if (field.isCustom) {
                              cellContent = sale.customData?.[field.key];
                          } else if(field.key === 'product_cost') {
                             cellContent = productCost;
                          } else {
                             cellContent = (sale as any)[field.key];
                          }

                          const fieldKeyLower = field.label.toLowerCase();
                          const isDateColumn = fieldKeyLower.includes('date') || fieldKeyLower.includes('data');

                          if (isDateColumn) {
                            cellContent = formatDate(cellContent);
                          } else if (numericColumns.has(field.key)) {
                              const className = field.key === 'fee_order' ? 'text-destructive' : (field.key === 'left_over' || field.key === 'lucro_liquido') ? 'font-semibold text-green-600' : '';
                              if(field.key === 'product_cost' && cellContent > 0) {
                                  cellContent = (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Custo do picking</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <span>{formatCurrency(cellContent)}</span>
                                    </div>
                                  );
                              } else {
                                 cellContent = <span className={className}>{typeof cellContent === 'number' ? formatCurrency(cellContent) : (cellContent || 'N/A')}</span>;
                              }
                          }

                          return (
                            <TableCell key={`${sale.id}-${field.key}`} className={cn("whitespace-nowrap", getColumnAlignment(field.key))}>
                              {cellContent ?? 'N/A'}
                            </TableCell>
                          )
                        })}

                        {!isDashboard && (
                          <TableCell className="text-center whitespace-nowrap space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                              Gerenciar Custos
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={fixedColumns.length + 1} className="h-24 text-center">
                       <div className="flex flex-col items-center justify-center gap-2">
                            <Sheet className="h-8 w-8 text-muted-foreground" />
                            <p className="text-muted-foreground">Nenhuma venda encontrada.</p>
                            <p className="text-sm text-muted-foreground">Use os filtros ou importe as vendas para começar.</p>
                       </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground">
                Total de {data.length} vendas.
            </div>
            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Itens por página</p>
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
                            {[10, 30, 50, 100].map((size) => (
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
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(0)}
                        disabled={pageIndex === 0}
                    >
                        <span className="sr-only">Primeira página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageIndex - 1)}
                        disabled={pageIndex === 0}
                    >
                        <span className="sr-only">Página anterior</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageIndex + 1)}
                        disabled={pageIndex >= pageCount - 1}
                    >
                        <span className="sr-only">Próxima página</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setPageIndex(pageCount - 1)}
                        disabled={pageIndex >= pageCount - 1}
                    >
                        <span className="sr-only">Última página</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
      
      {selectedSale && (
        <CostDialog
          sale={selectedSale}
          isOpen={!!selectedSale}
          onClose={() => setSelectedSale(null)}
          onSave={(newCosts) => {
            onUpdateSaleCosts(selectedSale.id, newCosts);
            setSelectedSale(null);
          }}
          formatCurrency={formatCurrency}
        />
      )}
    </TooltipProvider>
  );
}

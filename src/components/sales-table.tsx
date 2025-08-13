
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
import Image from 'next/image';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const DEFAULT_USER_ID = 'default-user'; // Placeholder until proper auth is added

const fixedIderisColumns = [
    'order_code',
    'payment_approved_date',
    'item_title',
    'item_sku',
    'item_quantity',
    'value_with_shipping',
    'fee_order',
    'fee_shipment',
    'left_over'
];


const DraggableHeader = ({ header, children }: { header: any, children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: header.key });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <TableHead
            ref={setNodeRef}
            style={style}
            className={cn("whitespace-nowrap", header.className)}
        >
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" {...attributes} {...listeners} className="cursor-grab h-6 w-5">
                    <GripVertical className="h-4 w-4" />
                </Button>
                {children}
            </div>
        </TableHead>
    );
};

export function SalesTable({ data, supportData, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading, productCostSource = new Map(), customCalculations = [], isDashboard = false }: SalesTableProps) {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [isSettingsLoading, setIsSettingsLoading] = useState(!isDashboard);
  
  // Columns state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [allAvailableColumns, setAllAvailableColumns] = useState<any[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

   useEffect(() => {
        setIsClient(true);
        if (!isDashboard) {
            loadTableSettings();
        }
    }, [isDashboard, supportData]);

  const loadTableSettings = () => {
    setIsSettingsLoading(true);

    const iderisCols = iderisFields
        .filter(field => fixedIderisColumns.includes(field.key))
        .map(field => ({
            ...field,
            group: 'Ideris',
            isCustom: false
        }));

    const systemCols = [
        { key: 'product_cost', label: 'Custo do Produto', isCustom: true, group: 'Sistema' },
        ...(customCalculations || []).map(c => ({
            key: c.id,
            label: c.name,
            isCustom: true,
            isPercentage: c.isPercentage,
            group: 'Sistema'
        }))
    ];
    
    const sheetCols: any[] = [];
    if (supportData && supportData.files) {
        const allFriendlyNames = new Set<string>();
        Object.values(supportData.files).flat().forEach(file => {
            Object.values(file.friendlyNames).forEach(name => allFriendlyNames.add(name));
        });
        allFriendlyNames.forEach(name => {
             sheetCols.push({ key: name, label: name, isCustom: true, group: 'Planilha' });
        });
    }

    const availableColumns = [...iderisCols, ...systemCols, ...sheetCols];
    setAllAvailableColumns(availableColumns);
    
    const savedVisible = localStorage.getItem(`visibleColumns-conciliacao-${DEFAULT_USER_ID}`);
    const savedOrder = localStorage.getItem(`columnOrder-conciliacao-${DEFAULT_USER_ID}`);

    const initialVisible: Record<string, boolean> = savedVisible ? JSON.parse(savedVisible) : {};
    if (!savedVisible) {
        // Set default visibility
        fixedIderisColumns.forEach(key => initialVisible[key] = true);
        systemCols.forEach(c => initialVisible[c.key] = true);
    }
    setVisibleColumns(initialVisible);

    const initialOrder = savedOrder ? JSON.parse(savedOrder) : availableColumns.map(c => c.key);
    const validOrder = initialOrder.filter((key: string) => availableColumns.some(c => c.key === key));
    setColumnOrder(validOrder);

    setIsSettingsLoading(false);
  };
  
  const handleVisibleChange = (key: string, checked: boolean) => {
    const newVisible = { ...visibleColumns, [key]: checked };
    setVisibleColumns(newVisible);
    localStorage.setItem(`visibleColumns-conciliacao-${DEFAULT_USER_ID}`, JSON.stringify(newVisible));
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
        setColumnOrder(items => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over!.id as string);
            const newOrder = arrayMove(items, oldIndex, newIndex);
            localStorage.setItem(`columnOrder-conciliacao-${DEFAULT_USER_ID}`, JSON.stringify(newOrder));
            return newOrder;
        });
    }
  };


  const orderedAndVisibleColumns = useMemo(() => {
    return columnOrder
      .map(key => allAvailableColumns.find(c => c.key === key))
      .filter((col): col is any => col && visibleColumns[col.key]);
  }, [columnOrder, visibleColumns, allAvailableColumns]);


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
  
  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
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
         {Array.from({ length: 8 }).map((_, colIndex) => (
             <TableCell key={`skel-cell-${index}-${colIndex}`}><Skeleton className="h-5 w-full" /></TableCell>
         ))}
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

  const getColumnGroups = () => {
      const groups: Record<string, any[]> = {
          'Ideris': [],
          'Sistema': [],
          'Planilha': []
      };
      allAvailableColumns.forEach(col => {
          if(groups[col.group]) {
              groups[col.group].push(col);
          }
      });
      return groups;
  }
  
  const columnGroups = getColumnGroups();


  if (!isClient && isDashboard) { // Only show basic loader for dashboard on server
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
         <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle className="text-lg">Detalhes das Vendas</CardTitle>
            </div>
            {!isDashboard && (
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={isSettingsLoading}>
                                {isSettingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <View className="h-4 w-4" />}
                                Exibir Colunas
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64" align="end">
                           <DropdownMenuLabel>Exibir/Ocultar Colunas</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           {Object.entries(columnGroups).map(([groupName, columns]) => (
                               columns.length > 0 && (
                                   <DropdownMenuGroup key={groupName}>
                                       <DropdownMenuLabel className="text-muted-foreground font-semibold text-xs">{groupName}</DropdownMenuLabel>
                                        {columns.map(col => (
                                            <DropdownMenuCheckboxItem
                                                key={col.key}
                                                checked={visibleColumns[col.key]}
                                                onCheckedChange={(checked) => handleVisibleChange(col.key, !!checked)}
                                            >
                                                {col.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                   </DropdownMenuGroup>
                               )
                           ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto custom-scrollbar">
            <Table>
               <DndContext
                    id={'dnd-context-sales-table'}
                    onDragEnd={handleDragEnd}
                    collisionDetection={closestCenter}
                >
              <TableHeader>
                <TableRow>
                   <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      {orderedAndVisibleColumns.map((field) => (
                        <DraggableHeader key={field.key} header={{key: field.key, className: getColumnAlignment(field.key) }}>
                            <div className="flex items-center gap-2">
                              {field.label}
                              {(field.isCustom || field.group === 'Planilha') && <Calculator className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                        </DraggableHeader>
                      ))}
                  </SortableContext>
                  {!isDashboard && <TableHead className="text-center whitespace-nowrap">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              </DndContext>
              <TableBody>
                {isLoading || isSettingsLoading ? renderSkeleton() : paginatedData.length > 0 ? (
                  paginatedData.map((sale) => {
                    return (
                      <TableRow key={sale.id}>
                        {orderedAndVisibleColumns.map(field => {
                          let cellContent: any;
                          let isPercentage = field.isPercentage || false;
                          
                          if (field.group === 'Sistema') {
                              if(field.key === 'product_cost') {
                                 cellContent = productCostSource.get((sale as any).order_code);
                              } else {
                                  cellContent = sale.customData?.[field.key];
                              }
                          } else if (field.group === 'Planilha') {
                              cellContent = sale.sheetData?.[field.key];
                          } else {
                             cellContent = (sale as any)[field.key];
                          }

                          const fieldKeyLower = field.label.toLowerCase();
                          const isDateColumn = fieldKeyLower.includes('date') || fieldKeyLower.includes('data');

                          if (isDateColumn) {
                            cellContent = formatDate(cellContent);
                          } else if (numericColumns.has(field.key) && typeof cellContent === 'number') {
                              const className = field.key === 'fee_order' || field.key === 'fee_shipment' ? 'text-destructive' : (field.key === 'left_over' || (field.key.includes('lucro') && cellContent > 0)) ? 'font-semibold text-green-600' : '';
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
                                      <span className="text-destructive">{formatCurrency(cellContent)}</span>
                                    </div>
                                  );
                              } else if (isPercentage) {
                                  cellContent = <span className={className}>{cellContent.toFixed(2)}%</span>;
                              } else {
                                 cellContent = <span className={className}>{formatCurrency(cellContent)}</span>;
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
                    <TableCell colSpan={orderedAndVisibleColumns.length + 1} className="h-24 text-center">
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

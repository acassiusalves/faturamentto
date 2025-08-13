
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
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

const defaultVisibleColumnsOrder: string[] = [
    "order_code", "payment_approved_date", "item_title", "item_sku", "item_quantity", "value_with_shipping", "product_cost", "fee_order", "left_over"
];
const dashboardVisibleColumnsOrder: string[] = [
    "order_code", "payment_approved_date", "item_title", "item_sku", "marketplace_name", "value_with_shipping", "fee_order", "fee_shipment"
];

function SortableItem({ id, children, ...props }: { id: string, children: React.ReactNode, [key: string]: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id});
  
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 w-full" {...props}>
       <div {...listeners} className="cursor-grab p-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
       </div>
       <div className="flex-grow">
        {React.cloneElement(children as React.ReactElement, { onSelect: (e: Event) => e.preventDefault()})}
       </div>
    </div>
  );
}


export function SalesTable({ data, supportData, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading, productCostSource = new Map(), customCalculations = [], isDashboard = false }: SalesTableProps) {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);

  // Column states
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [friendlyNames, setFriendlyNames] = useState<Record<string, string>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [allAvailableColumns, setAllAvailableColumns] = useState<{ key: string; label: string; path: string; isSupport?: boolean; isCustom?: boolean; isPercentage?: boolean; }[]>([]);
  
  const [isGrouped, setIsGrouped] = useState(true);
  
  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    async function loadDataAndSettings() {
        setIsSettingsLoading(true);

        // Define base columns available in the app code
        const codeDefinedColumns = [
            ...iderisFields,
            { key: 'product_cost', label: 'Custo do Produto', path: '', isCustom: true },
        ];

        // Fetch dynamic columns from other sources
        const supportCols = supportData?.files ? Array.from(new Set(Object.values(supportData.files).flat().flatMap(file => file.headers?.map(h => file.friendlyNames[h] || h) || []))).map(name => ({ key: name, label: name, path: '', isSupport: true })) : [];
        const customCols = customCalculations.map(calc => ({ key: calc.id, label: calc.name, path: '', isCustom: true, isPercentage: calc.isPercentage }));

        const combinedCols = [...codeDefinedColumns, ...supportCols, ...customCols];
        const uniqueColumns: typeof combinedCols = [];
        const seenKeys = new Set();
        combinedCols.forEach(col => { if (!seenKeys.has(col.key)) { uniqueColumns.push(col); seenKeys.add(col.key); } });
        
        // Load settings from Firestore
        const settings = await loadAppSettings();
        const savedIgnored = settings?.ignoredIderisColumns || [];
        const savedFriendlyNames = settings?.friendlyFieldNames || {};
        
        // Filter out ignored columns
        const available = uniqueColumns.filter(col => !savedIgnored.includes(col.key));
        setAllAvailableColumns(available);
        setFriendlyNames(savedFriendlyNames);

        // Load column order and visibility from Firestore
        const savedColumnOrder = settings?.conciliacaoColumnOrder;
        let initialColumnOrder = savedColumnOrder && savedColumnOrder.length > 0 ? savedColumnOrder : defaultVisibleColumnsOrder;
        
        const currentOrderSet = new Set(initialColumnOrder);
        available.forEach(col => { if (!currentOrderSet.has(col.key)) initialColumnOrder.push(col.key); });
        setColumnOrder(initialColumnOrder);

        const savedVisible = settings?.conciliacaoVisibleColumns;
        let initialVisible = savedVisible || {};

        // Ensure all available columns have a visibility setting, defaulting to true for new columns
        available.forEach(col => {
            if (!(col.key in initialVisible)) {
                initialVisible[col.key] = defaultVisibleColumnsOrder.includes(col.key) || col.isSupport || col.isCustom;
            }
        });
        setVisibleColumns(initialVisible);

        setIsSettingsLoading(false);
    }
    
    if (isDashboard) {
      setAllAvailableColumns(iderisFields);
      setColumnOrder(dashboardVisibleColumnsOrder);
      setVisibleColumns(dashboardVisibleColumnsOrder.reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      setIsSettingsLoading(false);
    } else {
      loadDataAndSettings();
    }

}, [isDashboard, supportData, customCalculations]);

  async function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (active.id !== over?.id && over) {
        const newOrder = arrayMove(columnOrder, columnOrder.indexOf(active.id as string), columnOrder.indexOf(over.id as string));
        setColumnOrder(newOrder);
        if (!isDashboard) {
            await saveAppSettings({ conciliacaoColumnOrder: newOrder });
        }
    }
  }

  const getGroupKey = (key: string): 'sistema' | 'ideris' | 'planilha' => {
        const customColumnKeys = new Set(['product_cost', ...customCalculations.map(c => c.key)]);
        if (customColumnKeys.has(key)) return 'sistema';
        if (allAvailableColumns.find(c => c.key === key)?.isSupport) return 'planilha';
        return 'ideris';
    };

  const groupedColumns = useMemo(() => {
    const iderisGroup = allAvailableColumns.filter(c => getGroupKey(c.key) === 'ideris');
    const planilhaGroup = allAvailableColumns.filter(c => getGroupKey(c.key) === 'planilha');
    const sistemaGroup = allAvailableColumns.filter(c => getGroupKey(c.key) === 'sistema');

    return {
      sistema: sistemaGroup,
      ideris: iderisGroup,
      planilha: planilhaGroup,
    };
  }, [allAvailableColumns, getGroupKey]);
  
  const getColumnHeader = (fieldKey: string) => {
    return friendlyNames[fieldKey] || allAvailableColumns.find(f => f.key === fieldKey)?.label || fieldKey;
  };
  
  const handleVisibilityChange = async (key: string, checked: boolean) => {
    const newVisibleColumns = { ...visibleColumns, [key]: checked };
    setVisibleColumns(newVisibleColumns);
    if (!isDashboard) {
        await saveAppSettings({ conciliacaoVisibleColumns: newVisibleColumns });
    }
  }

  const columnsToShow = useMemo(() => {
    return columnOrder
      .map(key => allAvailableColumns.find(field => field.key === key))
      .filter((field): field is { key: string; label: string, path: string, isPercentage?: boolean, isCustom?: boolean } => !!field && visibleColumns[field.key]);
  }, [columnOrder, visibleColumns, allAvailableColumns]);

  const numericColumns = useMemo(() => {
    const iderisNumeric = iderisFields
        .filter(f => f.path.toLowerCase().includes('value') || f.path.toLowerCase().includes('amount') || f.path.toLowerCase().includes('fee') || f.path.toLowerCase().includes('cost') || f.path.toLowerCase().includes('discount') || f.path.toLowerCase().includes('leftover') || f.path.toLowerCase().includes('profit'))
        .map(f => f.key);
        
    const supportNumeric: string[] = [];
    const nonNumericKeywords = ['id', 'código', 'codigo', 'pedido', 'nota', 'documento', 'rastreio', 'data', 'date'];

    if (data.length > 0 && allAvailableColumns.some(c => c.isSupport)) {
      const firstSale = data[0];
      allAvailableColumns.filter(c => c.isSupport).forEach(col => {
        const colKeyLower = col.key.toLowerCase();
        if (nonNumericKeywords.some(keyword => colKeyLower.includes(keyword))) {
          return;
        }

        if (firstSale.sheetData && firstSale.sheetData[col.key]) {
            const value = firstSale.sheetData[col.key];
            if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(String(value).replace(/\./g, '').replace(',', '.'))))) {
                supportNumeric.push(col.key);
            }
        }
      });
    }

    const customNumeric = customCalculations.map(c => c.key);
    const nonNumericSku = ['item_sku', 'order_code', 'id', 'document_value'];
    const finalNumeric = new Set([...iderisNumeric, ...supportNumeric, 'product_cost', ...customNumeric]);
    nonNumericSku.forEach(key => finalNumeric.delete(key));

    return finalNumeric;
  }, [data, allAvailableColumns, customCalculations]);


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
         {defaultVisibleColumnsOrder.map(key => <TableCell key={`${key}-skel-${index}`}><Skeleton className="h-5 w-full" /></TableCell>)}
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

  const renderColumnGroup = (groupTitle: string, columns: any[]) => {
      if(columns.length === 0) return null;
      
      const visibleColsInGroup = columnOrder.filter(key => columns.some(c => c.key === key));

      return (
        <DropdownMenuGroup>
          <DropdownMenuLabel>{groupTitle}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {visibleColsInGroup.map(key => {
              const field = allAvailableColumns.find(f => f.key === key);
              if (!field) return null;
              return (
                <SortableItem key={field.key} id={field.key}>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns[field.key] === true}
                    onCheckedChange={(checked) => handleVisibilityChange(field.key, !!checked)}
                  >
                    {getColumnHeader(field.key)}
                    {(field as any).isSupport && <FileSpreadsheet className="h-3 w-3 text-muted-foreground ml-auto" />}
                    {(field as any).isCustom && <Calculator className="h-3 w-3 text-muted-foreground ml-auto" />}
                  </DropdownMenuCheckboxItem>
                </SortableItem>
              )
          })}
        </DropdownMenuGroup>
      );
  };
  
  const renderAllColumns = () => {
    return columnOrder.map(key => {
        const field = allAvailableColumns.find(f => f.key === key);
        if (!field) return null;
        return (
            <SortableItem key={field.key} id={field.key}>
                <DropdownMenuCheckboxItem
                checked={visibleColumns[field.key] === true}
                onCheckedChange={(checked) => handleVisibilityChange(field.key, !!checked)}
                >
                {getColumnHeader(field.key)}
                {(field as any).isSupport && <FileSpreadsheet className="h-3 w-3 text-muted-foreground ml-auto" />}
                {(field as any).isCustom && <Calculator className="h-3 w-3 text-muted-foreground ml-auto" />}
                </DropdownMenuCheckboxItem>
            </SortableItem>
        )
    });
  }

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
            {!isDashboard && (
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isSettingsLoading}>
                      {isSettingsLoading ? <Loader2 className="mr-2 animate-spin"/> : <View className="mr-2" />}
                      Exibir Colunas
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <div className="p-2 flex items-center justify-between">
                        <Label htmlFor="group-columns-switch" className="text-sm font-normal">Agrupar por Origem</Label>
                        <Switch id="group-columns-switch" checked={isGrouped} onCheckedChange={setIsGrouped} />
                    </div>
                    <DropdownMenuSeparator />
                    <ScrollArea className="h-[400px]">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
                                {isGrouped ? (
                                    <>
                                    {renderColumnGroup("Sistema", groupedColumns.sistema)}
                                    {renderColumnGroup("Ideris", groupedColumns.ideris)}
                                    {renderColumnGroup("Planilha", groupedColumns.planilha)}
                                    </>
                                ) : (
                                    renderAllColumns()
                                )}
                            </SortableContext>
                        </DndContext>
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnsToShow.map((field) => (
                    <TableHead key={field.key} className={cn("whitespace-nowrap", getColumnAlignment(field.key))}>
                        <div className="flex items-center gap-2">
                          {getColumnHeader(field.key)}
                          {field.isCustom && <Calculator className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                    </TableHead>
                  ))}
                  {!isDashboard && <TableHead className="text-center whitespace-nowrap">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isSettingsLoading ? renderSkeleton() : paginatedData.length > 0 ? (
                  paginatedData.map((sale) => {
                    const productCost = productCostSource.get((sale as any).order_code);
                    return (
                      <TableRow key={sale.id}>
                        {columnsToShow.map(field => {
                          let cellContent: any;
                          let isNumeric = false;
                          let numericValue = 0;
                          
                          if ((field as any).isCustom) {
                              cellContent = sale.customData?.[field.key];
                          } else if(field.key === 'product_cost') {
                             cellContent = productCost;
                          } else if (iderisFields.some(f => f.key === field.key)) {
                             cellContent = (sale as any)[field.key];
                          } else {
                             cellContent = sale.sheetData?.[field.key];
                          }

                          if (typeof cellContent === 'number') {
                              isNumeric = true;
                              numericValue = cellContent;
                          } else if (typeof cellContent === 'string' && cellContent && numericColumns.has(field.key)) {
                              const cleanedValue = cellContent.replace(/\./g, '').replace(',', '.');
                              const parsedValue = parseFloat(cleanedValue);
                              if (!isNaN(parsedValue)) {
                                  isNumeric = true;
                                  numericValue = parsedValue;
                              }
                          }

                          const fieldKeyLower = getColumnHeader(field.key).toLowerCase();
                          const isDateColumn = fieldKeyLower.includes('date') || fieldKeyLower.includes('data') || field.key.toLowerCase().includes('approved');

                          if (field.key === 'item_image' && cellContent) {
                             cellContent = <Image src={cellContent} alt={(sale as any).item_title || 'Imagem do Produto'} width={40} height={40} className="rounded-md object-cover h-10 w-10" data-ai-hint="product image" />;
                          } else if (isDateColumn) {
                            cellContent = formatDate(cellContent);
                          } else if (field.key === 'marketplace_name') {
                            cellContent = <Badge variant="outline">{cellContent}</Badge>;
                          } else if (field.isPercentage) {
                              cellContent = isNumeric ? `${numericValue.toFixed(2)}%` : 'N/A';
                          } else if (numericColumns.has(field.key)) {
                              const className = field.key === 'fee_order' ? 'text-destructive' : (field.key === 'left_over' || field.key === 'lucro_liquido') ? 'font-semibold text-green-600' : '';
                              if(field.key === 'product_cost' && isNumeric && numericValue > 0) {
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
                                      <span>{formatCurrency(numericValue)}</span>
                                    </div>
                                  );
                              } else {
                                 cellContent = <span className={className}>{isNumeric ? formatCurrency(numericValue) : (cellContent || 'N/A')}</span>;
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
                    <TableCell colSpan={columnsToShow.length + 1} className="h-24 text-center">
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

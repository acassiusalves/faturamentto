"use client";

import { useState, useMemo, useEffect } from 'react';
import type { Sale } from '@/lib/types';
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
import { TrendingUp, Sheet, View, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { iderisFields } from '@/lib/ideris-fields';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { loadAppSettings } from '@/lib/mock-services';
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


interface SalesTableProps {
  data: Sale[];
  onUpdateSaleCosts: (saleId: string, newCosts: Sale['costs']) => void;
  calculateTotalCost: (sale: Sale) => number;
  calculateNetRevenue: (sale: Sale) => number;
  formatCurrency: (value: number) => string;
  isLoading: boolean;
}

const defaultVisibleColumnsOrder: string[] = [
    "item_image", "order_code", "payment_approved_date", "item_title", "item_sku", "item_quantity", "value_with_shipping", "fee_order", "left_over"
];
const DEFAULT_USER_ID = 'default-user';

const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};


export function SalesTable({ data, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading }: SalesTableProps) {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [friendlyNames, setFriendlyNames] = useState<Record<string, string>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultVisibleColumnsOrder);
  
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
    async function loadData() {
        const savedVisibleColumns = localStorage.getItem(`visibleColumns-ideris-${DEFAULT_USER_ID}`);
        if (savedVisibleColumns) {
          setVisibleColumns(JSON.parse(savedVisibleColumns));
        } else {
          const defaults: Record<string, boolean> = {};
          iderisFields.forEach(f => {
              defaults[f.key] = defaultVisibleColumnsOrder.includes(f.key);
          });
          setVisibleColumns(defaults);
        }

        const savedColumnOrder = localStorage.getItem(`columnOrder-ideris-${DEFAULT_USER_ID}`);
        if (savedColumnOrder) {
            setColumnOrder(JSON.parse(savedColumnOrder));
        } else {
            setColumnOrder(defaultVisibleColumnsOrder);
        }

        const settings = await loadAppSettings();
        if (settings?.friendlyFieldNames) {
          setFriendlyNames(settings.friendlyFieldNames);
        }
    }
    loadData();
  }, []);
  
  const getColumnHeader = (fieldKey: string) => {
    return friendlyNames[fieldKey] || iderisFields.find(f => f.key === fieldKey)?.label || fieldKey;
  };
  
  const handleVisibilityChange = (key: string, checked: boolean) => {
    setVisibleColumns(prev => {
        const newVisibleColumns = { ...prev, [key]: checked };
        localStorage.setItem(`visibleColumns-ideris-${DEFAULT_USER_ID}`, JSON.stringify(newVisibleColumns));
        return newVisibleColumns;
    });

    setColumnOrder(prevOrder => {
        let newOrder;
        if (checked) {
            newOrder = prevOrder.includes(key) ? prevOrder : [...prevOrder, key];
        } else {
            newOrder = prevOrder.filter(k => k !== key);
        }
        localStorage.setItem(`columnOrder-ideris-${DEFAULT_USER_ID}`, JSON.stringify(newOrder));
        return newOrder;
    });
  }
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over!.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(`columnOrder-ideris-${DEFAULT_USER_ID}`, JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };
  
  const columnsToShow = useMemo(() => {
    return columnOrder
      .map(key => iderisFields.find(field => field.key === key))
      .filter((field): field is { key: string; label: string, path: string } => !!field && visibleColumns[field.key]);
  }, [columnOrder, visibleColumns]);

  const availableColumnsForSelection = useMemo(() => {
    const visibleKeys = new Set(columnsToShow.map(c => c.key));
    const hidden = iderisFields.filter(f => !visibleKeys.has(f.key));
    return { visible: columnsToShow, hidden };
  }, [columnsToShow]);


  const getColumnAlignment = (key: string) => {
    const numericKeys = ['item_quantity', 'value_with_shipping', 'paid_amount', 'fee_shipment', 'fee_order', 'net_amount', 'left_over', 'discount', 'discount_marketplace'];
    return numericKeys.includes(key) ? 'text-right' : 'text-left';
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
         {iderisFields.filter(f => defaultVisibleColumnsOrder.includes(f.key)).map(col => <TableCell key={`${col.key}-skel-${index}`}><Skeleton className="h-5 w-full" /></TableCell>)}
          <TableCell className="text-center"><Skeleton className="h-8 w-[140px] mx-auto" /></TableCell>
      </TableRow>
    ))
  );
  
  const formatDate = (dateString: string | null) => {
      if (!dateString) return 'N/A';
      try {
          // Check for ISO 8601 format (YYYY-MM-DD)
          if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
          }
          // Fallback for other formats, might be less reliable
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
    return null;
  }

  return (
    <>
      <Card>
         <CardHeader className="flex flex-row items-center justify-between">
             <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle className="text-lg">Detalhes das Vendas (Ideris)</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <View className="mr-2" />
                  Exibir Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Colunas Visíveis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={columnsToShow.map(c => c.key)} strategy={verticalListSortingStrategy}>
                          {availableColumnsForSelection.visible.map(field => (
                              <SortableItem key={field.key} id={field.key}>
                                  <DropdownMenuCheckboxItem
                                      checked={visibleColumns[field.key] === true}
                                      onCheckedChange={(checked) => handleVisibilityChange(field.key, checked)}
                                      className="flex items-center gap-2"
                                  >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                      <span>{getColumnHeader(field.key)}</span>
                                  </DropdownMenuCheckboxItem>
                              </SortableItem>
                          ))}
                      </SortableContext>
                  </DndContext>
                 <DropdownMenuLabel>Colunas Ocultas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableColumnsForSelection.hidden.length > 0 ? (
                    availableColumnsForSelection.hidden.map(field => (
                        <DropdownMenuCheckboxItem
                        key={field.key}
                        checked={visibleColumns[field.key] === true}
                        onCheckedChange={(checked) => handleVisibilityChange(field.key, checked)}
                        >
                        {getColumnHeader(field.key)}
                        </DropdownMenuCheckboxItem>
                    ))
                ) : (
                    <DropdownMenuItem disabled>Nenhuma coluna oculta</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnsToShow.map((field) => (
                    <TableHead key={field.key} className={cn("whitespace-nowrap", getColumnAlignment(field.key))}>
                      {getColumnHeader(field.key)}
                    </TableHead>
                  ))}
                  <TableHead className="text-center whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : paginatedData.length > 0 ? (
                  paginatedData.map((sale) => {
                    const totalCost = calculateTotalCost(sale);
                    const netRevenue = calculateNetRevenue(sale);

                    return (
                      <TableRow key={sale.id}>
                        {columnsToShow.map(field => {
                          let cellContent: any = (sale as any)[field.key];

                          if (field.key === 'item_image' && cellContent) {
                             cellContent = <Image src={cellContent} alt={(sale as any).item_title || 'Imagem do Produto'} width={40} height={40} className="rounded-md object-cover h-10 w-10" />;
                          } else if (field.key.toLowerCase().includes('date') || field.key.toLowerCase().includes('approved')) {
                            cellContent = formatDate(cellContent);
                          } else if (field.key === 'marketplace_name') {
                            cellContent = <Badge variant="outline">{cellContent}</Badge>;
                          } else if (field.key === 'item_quantity') {
                             // Do not format quantity as currency
                             cellContent = cellContent;
                          } else if (getColumnAlignment(field.key) === 'text-right') {
                            const isNumeric = typeof cellContent === 'number';
                            const className = field.key === 'fee_order' ? 'text-destructive' : (field.key === 'left_over') ? 'font-semibold text-green-600' : '';
                            cellContent = <span className={className}>{isNumeric ? formatCurrency(cellContent) : cellContent}</span>;
                          }

                          return (
                            <TableCell key={`${sale.id}-${field.key}`} className={cn("whitespace-nowrap", getColumnAlignment(field.key))}>
                              {cellContent ?? 'N/A'}
                            </TableCell>
                          )
                        })}

                        <TableCell className="text-center whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => setSelectedSale(sale)}>
                            Gerenciar Custos
                          </Button>
                        </TableCell>
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
    </>
  );
}

    
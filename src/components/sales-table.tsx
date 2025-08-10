"use client";

import { useState, useMemo, useEffect } from 'react';
import type { Sale, SupportData } from '@/lib/types';
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
import { TrendingUp, Sheet, View, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical, FileSpreadsheet } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { iderisFields } from '@/lib/ideris-fields';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { loadAppSettings } from '@/services/firestore';
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


interface SalesTableProps {
  data: Sale[];
  supportData: SupportData | null;
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

// Componente SortableItem refatorado para separar o "arrastar" do conteúdo
const SortableItem = ({ id, children }: { id: string; children: (listeners: ReturnType<typeof useSortable>['listeners']) => React.ReactNode }) => {
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
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
};


export function SalesTable({ data, supportData, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading }: SalesTableProps) {
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
  
  const supportDataColumns = useMemo(() => {
    if (!supportData?.files) return [];
    const allFriendlyNames = new Set<string>();
    Object.values(supportData.files).flat().forEach(file => {
        if (!file.headers) return;
        file.headers.forEach(header => {
            const friendlyName = file.friendlyNames[header] || header;
            if(friendlyName) allFriendlyNames.add(friendlyName);
        });
    });
    return Array.from(allFriendlyNames).map(name => ({ key: name, label: name, path: '' }));
  }, [supportData]);
  
  const allAvailableColumns = useMemo(() => {
      const existingKeys = new Set(iderisFields.map(f => f.key));
      const uniqueSupportCols = supportDataColumns.filter(sc => !existingKeys.has(sc.key));
      return [...iderisFields, ...uniqueSupportCols];
  }, [supportDataColumns]);

  useEffect(() => {
    setIsClient(true);
    async function loadData() {
        const savedColumnOrder = localStorage.getItem(`columnOrder-conciliacao-${DEFAULT_USER_ID}`);
        const settings = await loadAppSettings();
        
        let initialColumnOrder = defaultVisibleColumnsOrder;
        if (savedColumnOrder) {
            initialColumnOrder = JSON.parse(savedColumnOrder);
        }
        
        const currentOrderSet = new Set(initialColumnOrder);
        supportDataColumns.forEach(sc => {
            if (!currentOrderSet.has(sc.key)) {
                initialColumnOrder.push(sc.key);
            }
        });
        setColumnOrder(initialColumnOrder);

        if (settings?.friendlyFieldNames) {
            setFriendlyNames(settings.friendlyFieldNames);
        }
    }
    loadData();
  }, [supportDataColumns]);


  useEffect(() => {
    const savedSettings = localStorage.getItem(`visibleColumns-conciliacao-${DEFAULT_USER_ID}`);
    let initialSettings = savedSettings ? JSON.parse(savedSettings) : {};
    
    allAvailableColumns.forEach(col => {
      if (!(col.key in initialSettings)) {
        const isDefault = defaultVisibleColumnsOrder.includes(col.key);
        const isSupport = supportDataColumns.some(sc => sc.key === col.key);
        initialSettings[col.key] = isDefault || isSupport;
      }
    });

    setVisibleColumns(initialSettings);
}, [allAvailableColumns, supportDataColumns]);
  
  const getColumnHeader = (fieldKey: string) => {
    return friendlyNames[fieldKey] || allAvailableColumns.find(f => f.key === fieldKey)?.label || fieldKey;
  };
  
  const handleVisibilityChange = (key: string, checked: boolean) => {
    setVisibleColumns(prev => {
        const newVisibleColumns = { ...prev, [key]: checked };
        localStorage.setItem(`visibleColumns-conciliacao-${DEFAULT_USER_ID}`, JSON.stringify(newVisibleColumns));
        return newVisibleColumns;
    });

    setColumnOrder(prevOrder => {
        let newOrder;
        if (checked) {
            newOrder = prevOrder.includes(key) ? prevOrder : [...prevOrder, key];
        } else {
            newOrder = prevOrder.filter(k => k !== key);
        }
        localStorage.setItem(`columnOrder-conciliacao-${DEFAULT_USER_ID}`, JSON.stringify(newOrder));
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
        localStorage.setItem(`columnOrder-conciliacao-${DEFAULT_USER_ID}`, JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };
  
  const columnsToShow = useMemo(() => {
    return columnOrder
      .map(key => allAvailableColumns.find(field => field.key === key))
      .filter((field): field is { key: string; label: string, path: string } => !!field && visibleColumns[field.key]);
  }, [columnOrder, visibleColumns, allAvailableColumns]);

  const availableColumnsForSelection = useMemo(() => {
    const visibleKeys = new Set(columnsToShow.map(c => c.key));
    const hidden = allAvailableColumns.filter(f => !visibleKeys.has(f.key));
    return { visible: columnsToShow, hidden };
  }, [columnsToShow, allAvailableColumns]);

  const numericColumns = useMemo(() => {
    const iderisNumeric = iderisFields
        .filter(f => f.path.toLowerCase().includes('value') || f.path.toLowerCase().includes('amount') || f.path.toLowerCase().includes('fee') || f.path.toLowerCase().includes('cost') || f.path.toLowerCase().includes('discount') || f.path.toLowerCase().includes('leftover') || f.path.toLowerCase().includes('profit'))
        .map(f => f.key);
        
    const supportNumeric: string[] = [];
    if (data.length > 0 && supportDataColumns.length > 0) {
      const firstSale = data[0];
      supportDataColumns.forEach(col => {
          if (firstSale.sheetData && firstSale.sheetData[col.key]) {
              const value = firstSale.sheetData[col.key];
              if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(String(value).replace(/\./g, '').replace(',', '.'))))) {
                  supportNumeric.push(col.key);
              }
          }
      });
    }

    const nonNumericSku = ['item_sku', 'order_code', 'id', 'document_value'];
    const finalNumeric = new Set([...iderisNumeric, ...supportNumeric]);
    nonNumericSku.forEach(key => finalNumeric.delete(key));

    return finalNumeric;
  }, [data, supportDataColumns]);


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
         {iderisFields.filter(f => defaultVisibleColumnsOrder.includes(f.key)).map(col => <TableCell key={`${col.key}-skel-${index}`}><Skeleton className="h-5 w-full" /></TableCell>)}
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
    return null;
  }

  return (
    <>
      <Card>
         <CardHeader className="flex flex-row items-center justify-between">
             <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle className="text-lg">Detalhes das Vendas</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <View className="mr-2" />
                  Exibir Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <ScrollArea className="h-[400px]">
                    <DropdownMenuLabel>Colunas Visíveis</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={columnsToShow.map(c => c.key)} strategy={verticalListSortingStrategy}>
                            {availableColumnsForSelection.visible.map(field => {
                                const isSupportCol = supportDataColumns.some(sc => sc.key === field.key);
                                return (
                                    <SortableItem key={field.key} id={field.key}>
                                        {(listeners) => (
                                            <div className="flex items-center gap-2">
                                                {/* O GripVertical agora é o único que escuta os eventos de arrastar */}
                                                <span {...listeners} className="cursor-grab p-1">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                </span>
                                                <DropdownMenuCheckboxItem
                                                    checked={visibleColumns[field.key] === true}
                                                    onCheckedChange={(checked) => handleVisibilityChange(field.key, checked)}
                                                    className="flex-grow"
                                                    // onSelect não é mais necessário aqui, mas não prejudica
                                                    onSelect={(e) => e.preventDefault()}
                                                >
                                                    <span>{getColumnHeader(field.key)}</span>
                                                    {isSupportCol && <FileSpreadsheet className="h-3 w-3 text-muted-foreground ml-auto" />}
                                                </DropdownMenuCheckboxItem>
                                            </div>
                                        )}
                                    </SortableItem>
                                )
                            })}
                        </SortableContext>
                    </DndContext>
                    <DropdownMenuLabel>Colunas Ocultas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableColumnsForSelection.hidden.length > 0 ? (
                        availableColumnsForSelection.hidden.map(field => {
                            const isSupportCol = supportDataColumns.some(sc => sc.key === field.key);
                            return (
                                <DropdownMenuCheckboxItem
                                key={field.key}
                                checked={visibleColumns[field.key] === true}
                                onCheckedChange={(checked) => handleVisibilityChange(field.key, checked)}
                                className="flex items-center gap-2"
                                onSelect={(e) => e.preventDefault()}
                                >
                                <span>{getColumnHeader(field.key)}</span>
                                {isSupportCol && <FileSpreadsheet className="h-3 w-3 text-muted-foreground ml-auto" />}
                                </DropdownMenuCheckboxItem>
                            )
                        })
                    ) : (
                        <DropdownMenuItem disabled>Nenhuma coluna oculta</DropdownMenuItem>
                    )}
                </ScrollArea>
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
                    return (
                      <TableRow key={sale.id}>
                        {columnsToShow.map(field => {
                          let cellContent: any;
                          
                          if(iderisFields.some(f => f.key === field.key)) {
                             cellContent = (sale as any)[field.key];
                          } else {
                             cellContent = sale.sheetData?.[field.key];
                          }


                          if (field.key === 'item_image' && cellContent) {
                             cellContent = <Image src={cellContent} alt={(sale as any).item_title || 'Imagem do Produto'} width={40} height={40} className="rounded-md object-cover h-10 w-10" data-ai-hint="product image" />;
                          } else if (field.key.toLowerCase().includes('date') || field.key.toLowerCase().includes('approved')) {
                            cellContent = formatDate(cellContent);
                          } else if (field.key === 'marketplace_name') {
                            cellContent = <Badge variant="outline">{cellContent}</Badge>;
                          } else if (numericColumns.has(field.key)) {
                              let isNumeric = false;
                              let numericValue = 0;
                              if (typeof cellContent === 'number') {
                                  isNumeric = true;
                                  numericValue = cellContent;
                              } else if (typeof cellContent === 'string' && cellContent) {
                                  const cleanedValue = cellContent.replace(/\./g, '').replace(',', '.');
                                  const parsedValue = parseFloat(cleanedValue);
                                  if (!isNaN(parsedValue)) {
                                      isNumeric = true;
                                      numericValue = parsedValue;
                                  }
                              }
                              
                              const className = field.key === 'fee_order' ? 'text-destructive' : (field.key === 'left_over') ? 'font-semibold text-green-600' : '';
                              cellContent = <span className={className}>{isNumeric ? formatCurrency(numericValue) : (cellContent || 'N/A')}</span>;
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

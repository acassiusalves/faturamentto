

"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from 'react';
import type { Sale, SupportData, CustomCalculation, AppSettings, Product } from '@/lib/types';
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
import { TrendingUp, Sheet, View, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GripVertical, FileSpreadsheet, Package, Calculator, Loader2, RefreshCw, Bot, Search as SearchIcon, Ticket } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { iderisFields } from '@/lib/ideris-fields';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { saveAppSettings, loadAppSettings, saveSales } from "@/services/firestore";
import { fetchOrderById } from "@/services/ideris";
import { useToast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import { useRouter } from 'next/navigation';


interface SalesTableProps {
  data: Sale[];
  products: Product[];
  supportData: SupportData | null;
  onUpdateSaleCosts: (saleId: string, newCosts: Sale['costs']) => void;
  calculateTotalCost: (sale: Sale) => number;
  calculateNetRevenue: (sale: Sale) => number;
  formatCurrency: (value: number) => string;
  isLoading: boolean;
  productCostSource?: Map<string, { cost: number; isManual: boolean }>; // Alterado aqui
  customCalculations?: CustomCalculation[];
  isDashboard?: boolean;
  onOpenTicket?: (sale: Sale) => void;
}

const dashboardColumns = [
    { key: 'order_id', label: 'ID do Pedido' },
    { key: 'order_code', label: 'Código do Pedido' },
    { key: 'item_title', label: 'Nome do Produto (Item)' },
    { key: 'paid_amount', label: 'Valor Pago' },
    { key: 'item_quantity', label: 'Quantidade (Item)' },
    { key: 'auth_name', label: 'Nome da Conta' },
    { key: 'marketplace_name', label: 'Nome do Marketplace' },
    { key: 'payment_approved_date', label: 'Data de Aprovação (Pagamento)' },
    { key: 'state_name', label: 'Estado' },
    { key: 'item_sku', label: 'SKU (Item)' },
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

export function SalesTable({ data, products, supportData, onUpdateSaleCosts, calculateTotalCost, calculateNetRevenue, formatCurrency, isLoading, productCostSource = new Map(), customCalculations = [], isDashboard = false, onOpenTicket }: SalesTableProps) {
  const router = useRouter();
  const [currentSales, setCurrentSales] = useState<Sale[]>(data);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<string | null>(null);
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState({ current: 0, total: 0 });

  const { toast } = useToast();
  
  const [isSettingsLoading, setIsSettingsLoading] = useState(!isDashboard);
  
  // Columns state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});
  const [allAvailableColumns, setAllAvailableColumns] = useState<any[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [columnSearchTerm, setColumnSearchTerm] = useState("");

   useEffect(() => {
        setCurrentSales(data);
   }, [data]);

   useEffect(() => {
        setIsClient(true);
        if (!isDashboard) {
            loadTableSettings();
        } else {
             const setupDashboard = async () => {
                 setIsSettingsLoading(true);
                 const settings = await loadAppSettings();
                 const friendlyNames = settings?.friendlyFieldNames || {};
                 
                 const initialDashboardCols = dashboardColumns.map(col => ({
                    ...col,
                    label: friendlyNames[col.key] || col.label,
                    group: 'Dashboard',
                    isCustom: false,
                 }));

                 setAllAvailableColumns(initialDashboardCols);
                 setColumnOrder(initialDashboardCols.map(c => c.key));
                 const initialVisible: Record<string, boolean> = {};
                 initialDashboardCols.forEach(col => { initialVisible[col.key] = true });
                 setVisibleColumns(initialVisible);
                 setIsSettingsLoading(false);
             }
             setupDashboard();
        }
    }, [isDashboard, supportData, customCalculations, settingsVersion]);

  const loadTableSettings = async () => {
    setIsSettingsLoading(true);

    const settings = await loadAppSettings();
    const friendlyNames = settings?.friendlyFieldNames || {};
    const normalizeLabel = (s: string): string => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();


    const iderisCols = iderisFields
        .filter(field => field.key !== 'status') // Remove o status daqui para adicionarmos com o botão
        .map(field => ({
            ...field,
            label: friendlyNames[field.key] || field.label,
            group: 'Ideris',
            isCustom: false
        }));

    // Adiciona o campo de status separadamente para poder ter o botão
    const statusField = iderisFields.find(f => f.key === 'status');
     if (statusField) {
        iderisCols.push({
            ...statusField,
            label: friendlyNames[statusField.key] || statusField.label,
            group: 'Ideris',
            isCustom: false,
        });
    }

    const systemCols = [
        { key: 'product_cost', label: 'Custo do Produto', isCustom: true, group: 'Sistema' },
        ...(customCalculations || []).map(c => ({
            key: c.id,
            label: c.name,
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
             sheetCols.push({ key: normalizeLabel(name), label: name, isCustom: true, group: 'Planilha' });
        });
    }

    const availableColumns = [...iderisCols, ...systemCols, ...sheetCols];
    setAllAvailableColumns(availableColumns);
    
    const savedVisible = settings?.conciliacaoVisibleColumns || {};
    const savedOrder = settings?.conciliacaoColumnOrder;

    const initialVisible: Record<string, boolean> = savedVisible;
    if (Object.keys(savedVisible).length === 0) {
        // Set default visibility if nothing is saved
        availableColumns.forEach(key => initialVisible[key.key] = true);
    }
    setVisibleColumns(initialVisible);

    const initialOrder = savedOrder || availableColumns.map(c => c.key);
    const validOrder = initialOrder.filter((key: string) => availableColumns.some(c => c.key === key));
    const allKeys = availableColumns.map(c => c.key);
    const finalOrder = [...new Set([...validOrder, ...allKeys])]; // Ensure all columns are in the order list

    setColumnOrder(finalOrder);

    setIsSettingsLoading(false);
  };

  const saveTableSettings = async (order?: string[], visibility?: Record<string, boolean>) => {
    const settingsToSave: Partial<AppSettings> = {};
    if (order) settingsToSave.conciliacaoColumnOrder = order;
    if (visibility) settingsToSave.conciliacaoVisibleColumns = visibility;
    await saveAppSettings(settingsToSave);
  };
  
  const handleVisibleChange = (key: string, checked: boolean) => {
    const newVisible = { ...visibleColumns, [key]: checked };
    setVisibleColumns(newVisible);
    saveTableSettings(undefined, newVisible);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
        setColumnOrder(items => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over!.id as string);
            const newOrder = arrayMove(items, oldIndex, newIndex);
            saveTableSettings(newOrder, undefined);
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
    const finalNumeric = new Set([...iderisNumeric, 'product_cost', ...customNumeric, 'paid_amount']);
    nonNumericSku.forEach(key => finalNumeric.delete(key));

    return finalNumeric;
  }, [customCalculations]);

  const productSkuMap = useMemo(() => {
    const map = new Map<string, string>();
    if (products) {
        products.forEach(p => {
            map.set(p.sku, p.name);
            p.associatedSkus?.forEach(assocSku => {
                map.set(assocSku, p.name);
            });
        });
    }
    return map;
  }, [products]);


  const getColumnAlignment = (key: string) => {
    return numericColumns.has(key) ? 'text-right' : 'text-left';
  }
  
  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  const pageCount = Math.ceil(currentSales.length / pageSize);
  
  const paginatedData = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return currentSales.slice(startIndex, startIndex + pageSize);
  }, [currentSales, pageIndex, pageSize]);

  useEffect(() => {
    if (pageIndex >= pageCount) {
        setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [currentSales, pageIndex, pageCount]);


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
          if (/^\\d{4}-\\d{2}/.test(dateString)) {
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
    
    // Filter columns based on search term before grouping
    const lowerSearchTerm = columnSearchTerm.toLowerCase();
    const filteredColumns = columnSearchTerm
      ? allAvailableColumns.filter(col => col.label.toLowerCase().includes(lowerSearchTerm))
      : allAvailableColumns;

    filteredColumns.forEach(col => {
        if(groups[col.group]) {
            groups[col.group].push(col);
        }
    });

    return groups;
  }
  
  const columnGroups = getColumnGroups();

  const handleRefreshStatus = async (sale: Sale) => {
    const orderId = (sale as any).order_id;
    if (!orderId) return;

    setIsRefreshingStatus(orderId);
    try {
        const settings = await loadAppSettings();
        if (!settings?.iderisPrivateKey) {
            toast({ variant: 'destructive', title: 'Chave da Ideris não configurada.' });
            return;
        }

        const iderisOrder = await fetchOrderById(settings.iderisPrivateKey, orderId);

        if (!iderisOrder) {
            toast({ variant: 'destructive', title: 'Pedido não encontrado na Ideris.' });
            return;
        }

        const currentSaleIndex = currentSales.findIndex(s => s.id === sale.id);
        if (currentSaleIndex === -1) {
            toast({ variant: 'destructive', title: 'Pedido não encontrado localmente.' });
            return;
        }

        
        if (iderisOrder.status !== sale.status) {
            const updatedSale: Sale = { ...sale, status: iderisOrder.status };
            await saveSales([updatedSale]);
            
            // Update local state to reflect the change instantly
            const newSales = [...currentSales];
            newSales[currentSaleIndex] = updatedSale;
            setCurrentSales(newSales);
            
            toast({ title: 'Status Atualizado!', description: `O status do pedido ${orderId} foi atualizado para "${iderisOrder.status}".` });
        } else {
            toast({ title: 'Nenhuma Mudança', description: 'O status do pedido já está atualizado.' });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: 'Não foi possível buscar o status do pedido na Ideris.' });
    } finally {
        setIsRefreshingStatus(null);
    }
  }

  const handleQueueRefresh = async () => {
    const salesToProcess = [...currentSales]; // Pega todos os pedidos do filtro atual
    if (salesToProcess.length === 0) return;

    setIsQueueRefreshing(true);
    setQueueProgress(0);
    setCurrentStatus({ current: 0, total: salesToProcess.length });

    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey) {
        toast({ variant: 'destructive', title: 'Chave da Ideris não configurada.' });
        setIsQueueRefreshing(false);
        return;
    }

    const salesToUpdate: Sale[] = [];
    const updatedSalesMap = new Map<string, Sale>();
    let successCount = 0;
    let errorCount = 0;
    const total = salesToProcess.length;

    toast({ title: 'Iniciando atualização em fila...', description: `Verificando ${total} pedidos.` });

    for (let i = 0; i < total; i++) {
        const currentSale = salesToProcess[i];
        try {
            const iderisOrder = await fetchOrderById(settings.iderisPrivateKey, (currentSale as any).order_id);
            if (iderisOrder && iderisOrder.status !== currentSale.status) {
                const updatedSale: Sale = { ...currentSale, status: iderisOrder.status };
                salesToUpdate.push(updatedSale);
                updatedSalesMap.set(currentSale.id, updatedSale);
            }
            successCount++;
        } catch (e) {
            console.error(`Erro ao atualizar pedido ${(currentSale as any).order_id}:`, e);
            errorCount++;
        }
        const currentCount = i + 1;
        setQueueProgress((currentCount / total) * 100);
        setCurrentStatus({ current: currentCount, total: total });
    }

    if (salesToUpdate.length > 0) {
        await saveSales(salesToUpdate);
        setCurrentSales(prevSales => 
            prevSales.map(sale => updatedSalesMap.get(sale.id) || sale)
        );
    }

    setIsQueueRefreshing(false);
    toast({ 
        title: 'Atualização em Fila Concluída!', 
        description: `${salesToUpdate.length} status foram atualizados. ${successCount} pedidos verificados com sucesso, ${errorCount} falharam.`
    });
  }

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
            <div className="flex items-center gap-2">
                 {!isDashboard && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={isSettingsLoading}>
                                {isSettingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <View className="h-4 w-4" />}
                                Exibir Colunas
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64" align="end">
                            <div className="p-2">
                               <div className="relative">
                                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar coluna..."
                                        value={columnSearchTerm}
                                        onChange={(e) => setColumnSearchTerm(e.target.value)}
                                        className="pl-9 h-9"
                                    />
                                </div>
                            </div>
                           <ScrollArea className="h-72">
                                <div className="p-2 pt-0">
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
                               </div>
                           </ScrollArea>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </CardHeader>
        <CardContent>
          {isQueueRefreshing && (
            <div className="space-y-2 mb-4">
                 <Progress value={queueProgress} className="w-full" />
                 <p className="text-sm text-muted-foreground text-center">
                    Atualizando {currentStatus.current} de {currentStatus.total}...
                </p>
            </div>
           )}
          <div className="rounded-md border overflow-x-auto custom-scrollbar">
            <DndContext
                id={'dnd-context-sales-table'}
                onDragEnd={handleDragEnd}
                collisionDetection={closestCenter}
            >
                <Table>
                <TableHeader>
                    <TableRow>
                        {!isDashboard ? (
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
                        ) : (
                            orderedAndVisibleColumns.map(field => (
                                    <TableHead key={field.key} className={getColumnAlignment(field.key)}>
                                        {field.label}
                                    </TableHead>
                                ))
                        )}
                        {!isDashboard && <TableHead className="text-center whitespace-nowrap">Ações</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading || isSettingsLoading ? renderSkeleton() : paginatedData.length > 0 ? (
                    paginatedData.map((sale) => {
                            const columnsToRender = isDashboard ? orderedAndVisibleColumns : orderedAndVisibleColumns;
                        return (
                        <TableRow key={sale.id}>
                            {columnsToRender.map(field => {
                            let cellContent: any;
                            let isPercentage = field.isPercentage || false;
                             const normalizeLabel = (s: string): string => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

                            if (field.group === 'Sistema') {
                                if(field.key === 'product_cost') {
                                    cellContent = productCostSource.get((sale as any).order_code)?.cost;
                                } else {
                                    cellContent = sale.customData?.[field.key];
                                }
                            } else if (field.group === 'Planilha') {
                                cellContent = sale.sheetData?.[normalizeLabel(field.label)];
                            } else if (field.key === 'item_title') {
                                // Use system product name if available, otherwise fallback to ad name
                                cellContent = productSkuMap.get((sale as any).item_sku) || (sale as any).item_title;
                            } else {
                                cellContent = (sale as any)[field.key];
                            }

                            const fieldKeyLower = field.label.toLowerCase();
                            const isDateColumn = fieldKeyLower.includes('date') || fieldKeyLower.includes('data');
                            const isStatusColumn = field.key === 'status';

                            if (isDateColumn) {
                                cellContent = formatDate(cellContent);
                            } else if (isStatusColumn && !isDashboard) {
                                cellContent = (
                                    <div className="flex items-center gap-2 justify-start">
                                        {cellContent ? <Badge variant="secondary">{cellContent}</Badge> : 'N/A'}
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => handleRefreshStatus(sale)}
                                                    disabled={isRefreshingStatus === (sale as any).order_id}
                                                >
                                                    {isRefreshingStatus === (sale as any).order_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Atualizar status deste pedido</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            } else if (numericColumns.has(field.key) && typeof cellContent === 'number') {
                                const className = field.key === 'fee_order' || field.key === 'fee_shipment' ? 'text-destructive' : (field.key === 'left_over' || (field.key.includes('lucro') && cellContent > 0)) ? 'font-semibold text-green-600' : '';
                                if(field.key === 'product_cost' && cellContent > 0) {
                                    const costInfo = productCostSource.get((sale as any).order_code);
                                    cellContent = (
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {costInfo?.isManual ? <Calculator className="h-3.5 w-3.5 text-muted-foreground" /> : <Package className="h-3.5 w-3.5 text-muted-foreground" />}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{costInfo?.isManual ? 'Custo inserido manualmente' : 'Custo do picking'}</p>
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

                            {!isDashboard && onOpenTicket && (
                            <TableCell className="text-center whitespace-nowrap space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onOpenTicket(sale)}
                                >
                                  <Ticket className="mr-2 h-4 w-4" />
                                  Abrir Ticket
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
            </DndContext>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground">
                Total de {currentSales.length} vendas.
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



"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { loadAllPickingLogs, saveManualPickingLog, updatePickingLogs } from '@/services/firestore';
import type { PickedItemLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, PlusCircle, Pencil, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from "react-day-picker";
import { Badge } from '@/components/ui/badge';
import { ManualPickingDialog } from '@/components/manual-picking-dialog';


export function PickingHistory() {
  const { toast } = useToast();

  const [allPicks, setAllPicks] = useState<PickedItemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [isSaving, setIsSaving] = useState(false);


  const fetchAllPicks = useCallback(async () => {
    setIsLoading(true);
    const picks = await loadAllPickingLogs();
    setAllPicks(picks);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAllPicks();
  }, [fetchAllPicks]);

  const filteredPicks = useMemo(() => {
    return allPicks.filter(pick => {
        if (dateRange?.from && dateRange?.to) {
            const pickDate = new Date(pick.pickedAt);
            if (pickDate < dateRange.from || pickDate > dateRange.to) {
                return false;
            }
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            const matches = 
                (pick.orderNumber || '').toLowerCase().includes(lowerSearchTerm) ||
                (pick.name || '').toLowerCase().includes(lowerSearchTerm) ||
                (pick.sku || '').toLowerCase().includes(lowerSearchTerm) ||
                (pick.serialNumber || '').toLowerCase().includes(lowerSearchTerm);
            if (!matches) {
                return false;
            }
        }
        
        return true;
    });
  }, [allPicks, searchTerm, dateRange]);
  
  const handleManualSave = async (data: Omit<PickedItemLog, 'logId' | 'productId' | 'origin' | 'quantity' | 'id' | 'createdAt' >) => {
    try {
        await saveManualPickingLog(data as any);
        toast({
            title: "Registro Adicionado!",
            description: "O registro de picking manual foi salvo com sucesso."
        });
        setIsManualAddOpen(false);
        await fetchAllPicks();
    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Erro ao Salvar",
            description: "Não foi possível salvar o registro manual."
        });
    }
  }

  const pageCount = Math.ceil(filteredPicks.length / pageSize);

  const paginatedPicks = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return filteredPicks.slice(startIndex, startIndex + pageSize);
  }, [filteredPicks, pageIndex, pageSize]);

  useEffect(() => {
    if (pageIndex >= pageCount && pageCount > 0) {
        setPageIndex(pageCount - 1);
    } else if (pageCount === 0) {
        setPageIndex(0);
    }
  }, [filteredPicks, pageIndex, pageCount]);

  const handleCostChange = (logId: string, newCost: string) => {
    const numericCost = parseFloat(newCost);
    if (!isNaN(numericCost)) {
      setPendingChanges(prev => new Map(prev).set(logId, numericCost));
    }
  };

  const handleSaveChanges = async () => {
      if (pendingChanges.size === 0) return;
      setIsSaving(true);
      
      const updates = Array.from(pendingChanges.entries()).map(([logId, costPrice]) => ({ logId, costPrice }));

      try {
          await updatePickingLogs(updates);
          setAllPicks(prevPicks =>
              prevPicks.map(pick =>
                  pendingChanges.has(pick.logId)
                      ? { ...pick, costPrice: pendingChanges.get(pick.logId)! }
                      : pick
              )
          );
          toast({
              title: "Alterações Salvas!",
              description: `${updates.length} registro(s) de custo foram atualizados.`
          });
          setPendingChanges(new Map());
          setEditingRowId(null);
      } catch (error) {
          console.error("Error saving cost changes:", error);
          toast({ variant: "destructive", title: "Erro ao Salvar", description: "Não foi possível salvar as alterações de custo." });
      } finally {
          setIsSaving(false);
      }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
  
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando arquivo...</p>
      </div>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <div>
              <CardTitle>Histórico Completo de Picking</CardTitle>
              <CardDescription>
                Use os filtros para encontrar registros específicos de saídas de
                estoque.
              </CardDescription>
            </div>
          </div>
          <div className="text-sm font-semibold text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-md">
            {filteredPicks.length} registros encontrados
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            {pendingChanges.size > 0 && (
              <Button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : (
                  <Save className="mr-2" />
                )}
                Salvar Alterações
              </Button>
            )}
            <Button onClick={() => setIsManualAddOpen(true)}>
              <PlusCircle />
              Adicionar Registro Manual
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pedido, produto, SKU..."
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
          </div>
        </div>
      </CardHeader>
        <CardContent>
            <div className="rounded-md border max-h-[600px] overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                            <TableHead>Datas (Entrada/Saída)</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nº de Série (SN)</TableHead>
                            <TableHead>Custo</TableHead>
                            <TableHead className="text-right">Pedido</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Carregando histórico...</TableCell></TableRow>
                        ) : paginatedPicks.length > 0 ? (
                            paginatedPicks.map(item => (
                                <TableRow key={`${item.logId}-${item.serialNumber}-${item.pickedAt}`}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="secondary" className="font-normal justify-start">Entrada: {formatDate(item.createdAt)}</Badge>
                                            <Badge variant="outline" className="font-normal justify-start">Saída: {formatDateTime(item.pickedAt)}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                    <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {editingRowId === item.logId ? (
                                                <Input
                                                    type="number"
                                                    defaultValue={pendingChanges.get(item.logId) ?? item.costPrice}
                                                    onChange={(e) => handleCostChange(item.logId, e.target.value)}
                                                    onBlur={() => setEditingRowId(null)}
                                                    className="w-28 h-8"
                                                    autoFocus
                                                />
                                            ) : (
                                                <>
                                                    <span>{formatCurrency(pendingChanges.get(item.logId) ?? item.costPrice)}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => setEditingRowId(item.logId)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{item.orderNumber}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                                        <Archive className="h-12 w-12 mb-4" />
                                        <p>Nenhum registro encontrado.</p>
                                        <p className="text-xs">Tente ajustar os filtros ou aguarde novas saídas de estoque.</p>
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
                Total de {filteredPicks.length} registros.
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
    
    <ManualPickingDialog 
        isOpen={isManualAddOpen}
        onClose={() => setIsManualAddOpen(false)}
        onSave={handleManualSave}
    />
    </>
  );
}

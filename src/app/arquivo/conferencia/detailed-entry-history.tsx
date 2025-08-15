
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { InventoryItem } from "@/lib/types";
import { loadInventoryItems, loadProductSettings } from "@/services/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PackagePlus, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DetailedEntryHistory() {
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [originFilter, setOriginFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [availableOrigins, setAvailableOrigins] = useState<string[]>([]);
  
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [items, productSettings] = await Promise.all([
      loadInventoryItems(),
      loadProductSettings('celular') // Assuming 'celular' is the category
    ]);
    setAllItems(items);
    if (productSettings) {
      const originAttribute = productSettings.attributes.find(attr => attr.key === 'origem');
      if (originAttribute && originAttribute.values) {
        setAvailableOrigins(originAttribute.values);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Date range filter
      if (dateRange?.from) {
        const itemDate = new Date(item.createdAt);
        if (itemDate < dateRange.from) return false;
      }
      if (dateRange?.to) {
        const itemDate = new Date(item.createdAt);
        // Add one day to the 'to' date to make the range inclusive
        const toDate = new Date(dateRange.to);
        toDate.setDate(toDate.getDate() + 1);
        if (itemDate >= toDate) return false;
      }

      // Origin filter
      if (originFilter !== "all" && item.origin !== originFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(lowerSearchTerm) ||
          item.sku.toLowerCase().includes(lowerSearchTerm) ||
          item.serialNumber.toLowerCase().includes(lowerSearchTerm)
        );
      }

      return true;
    });
  }, [allItems, dateRange, originFilter, searchTerm]);
  
  const pageCount = Math.ceil(filteredItems.length / pageSize);

  const paginatedItems = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, pageIndex, pageSize]);
  
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                 <CardTitle>Histórico Detalhado de Entradas no Estoque</CardTitle>
                 <CardDescription>Visualize todos os itens que foram adicionados ao inventário.</CardDescription>
            </div>
            <div className="text-sm font-semibold text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-md">
                {filteredItems.length} registros encontrados
            </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
                 <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por produto, SKU, SN..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
             <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                 <Select value={originFilter} onValueChange={setOriginFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por origem" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        {availableOrigins.map(origin => (
                             <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
             </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Data da Entrada</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>SN</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                    <TableCell>
                      <Badge variant={item.condition === 'Novo' ? 'default' : 'secondary'}>
                        {item.condition || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.origin}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.costPrice)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                        <PackagePlus className="h-12 w-12 mb-4" />
                        <p>Nenhuma entrada de estoque encontrada.</p>
                        <p className="text-xs">Tente ajustar os filtros ou adicione novos itens na tela de Estoque.</p>
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
                Total de {filteredItems.length} registros.
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
  );
}

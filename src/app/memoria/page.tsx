
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from "react-day-picker";
import { startOfDay, endOfDay } from "date-fns";

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, Database, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, BrainCircuit, FileSpreadsheet } from 'lucide-react';
import { loadSales } from '@/services/firestore';
import type { Sale } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MemoryPage() {
    const { toast } = useToast();
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [isLoading, setIsLoading] = useState(true);

    // Filter and pagination states
    const [searchTerm, setSearchTerm] = useState('');
    const [marketplaceFilter, setMarketplaceFilter] = useState('all');
    const [stateFilter, setStateFilter] = useState('all');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    
    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const salesData = await loadSales();
            setAllSales(salesData);
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        if (!allSales) return [];

        let filtered = allSales;

        // Apply date range filter
        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

            filtered = filtered.filter(sale => {
                try {
                    const saleDateStr = (sale as any).payment_approved_date;
                    if (!saleDateStr) return false;
                    const saleDate = new Date(saleDateStr);
                    return saleDate >= fromDate && saleDate <= toDate;
                } catch {
                    return false;
                }
            });
        }
        
        // Apply other filters
        return filtered.filter(item => {
            const saleData = item as any;
            const searchMatch = searchTerm 
                ? saleData.order_code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  saleData.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  saleData.item_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  saleData.document_value?.includes(searchTerm)
                : true;

            const marketplaceMatch = marketplaceFilter === 'all' || (saleData.marketplace_name || 'N/A').toLowerCase() === marketplaceFilter.toLowerCase();
            const stateMatch = stateFilter === 'all' || (saleData.state_name || 'N/A') === stateFilter;
            
            return searchMatch && marketplaceMatch && stateMatch;
        });
    }, [allSales, dateRange, searchTerm, marketplaceFilter, stateFilter]);

    const uniqueMarketplaces = useMemo(() => ['all', ...Array.from(new Set(allSales.map(r => (r as any).marketplace_name).filter(Boolean)))], [allSales]);
    const uniqueStates = useMemo(() => ['all', ...Array.from(new Set(allSales.map(r => (r as any).state_name).filter(Boolean)))], [allSales]);

    const pageCount = Math.ceil(filteredData.length / pageSize);
    const paginatedData = useMemo(() => {
        const startIndex = pageIndex * pageSize;
        return filteredData.slice(startIndex, startIndex + pageSize);
    }, [filteredData, pageIndex, pageSize]);
    
     useEffect(() => {
        if (pageIndex >= pageCount && pageCount > 0) {
            setPageIndex(pageCount - 1);
        } else if (pageCount === 0) {
            setPageIndex(0);
        }
    }, [filteredData, pageIndex, pageCount]);
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), "dd/MM/yy HH:mm", { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Memória de Vendas</h1>
                <p className="text-muted-foreground">Consulte o histórico completo de vendas para análise de dados e treinamento de IA.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">Filtros e Ações</CardTitle>
                     <div className="flex flex-col md:flex-row gap-4 pt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por Pedido, Cliente, SKU ou Documento..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                        <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Filtrar por Marketplace" />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueMarketplaces.map((status, index) => (
                                    <SelectItem key={`${status}-${index}`} value={status}>{status === 'all' ? 'Todos os Marketplaces' : status || 'N/A'}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={stateFilter} onValueChange={setStateFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="Filtrar por Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueStates.map((status, index) => (
                                    <SelectItem key={`${status}-${index}`} value={status}>{status === 'all' ? 'Todos os Estados' : status || 'N/A'}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="pt-4">
                        <Button disabled>
                            <BrainCircuit className="mr-2" />
                            Analisar com IA (Em breve)
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex items-center justify-center h-64 gap-4">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <p>Carregando memória de vendas...</p>
                         </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Pedido</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Marketplace</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.length > 0 ? paginatedData.map((item) => (
                                        <TableRow key={(item as any).id}>
                                            <TableCell className="font-medium">{formatDate((item as any).payment_approved_date)}</TableCell>
                                            <TableCell className="font-mono text-xs">{(item as any).order_code}</TableCell>
                                            <TableCell className="font-mono text-xs">{(item as any).item_sku}</TableCell>
                                            <TableCell>{(item as any).customer_name}</TableCell>
                                            <TableCell><Badge variant="outline">{(item as any).marketplace_name}</Badge></TableCell>
                                            <TableCell><Badge variant="secondary">{(item as any).status}</Badge></TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                Nenhum registro encontrado com os filtros atuais.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                    <div className="text-sm text-muted-foreground">
                        Total de {filteredData.length} registros.
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
                                    {[20, 50, 100, 200].map((size) => (
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
                </CardFooter>
            </Card>
        </div>
    );
}

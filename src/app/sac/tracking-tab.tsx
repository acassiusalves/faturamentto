
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, startOfDay, endOfDay as dateFnsEndOfDay } from "date-fns";

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, Database, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, FilePieChart } from 'lucide-react';
import { loadAppSettings, loadSales, updateSalesStatuses } from '@/services/firestore';
import { fetchOrdersStatus } from '@/services/ideris';
import type { Sale } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface OrderStatus {
    orderId: number;
    statusId: number;
    statusDescription: string;
    mktStatusDescription: string;
    authenticationId: number;
}

export function TrackingTab() {
    const { toast } = useToast();
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState({ current: 0, total: 0 });

    // Filter and pagination states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    
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
            const toDate = dateRange.to ? dateFnsEndOfDay(dateRange.to) : dateFnsEndOfDay(dateRange.from);

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
                ? saleData.order_code?.toLowerCase().includes(searchTerm.toLowerCase()) || saleData.order_id?.toString().includes(searchTerm)
                : true;
            const statusMatch = statusFilter === 'all' || saleData.status?.toLowerCase() === statusFilter.toLowerCase();
            return searchMatch && statusMatch;
        });
    }, [allSales, dateRange, searchTerm, statusFilter]);

    const handleSyncStatus = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ variant: 'destructive', title: 'Período Inválido', description: 'Por favor, selecione um período de datas válido.' });
            return;
        }

        const salesToUpdate = filteredData.filter(sale => sale.status !== 'Entregue');
        if (salesToUpdate.length === 0) {
            toast({ title: 'Tudo Certo!', description: 'Nenhum pedido com status pendente encontrado no período selecionado.' });
            return;
        }

        setIsSyncing(true);
        setSyncProgress(0);
        setSyncStatus({ current: 0, total: salesToUpdate.length });

        try {
            const settings = await loadAppSettings();
            if (!settings?.iderisPrivateKey) {
                throw new Error("A chave da API da Ideris não está configurada.");
            }
            const iderisStatuses = await fetchOrdersStatus(settings.iderisPrivateKey, dateRange);
            const statusMap = new Map(iderisStatuses.map(s => [s.orderId, s.statusDescription]));

            const updates: { saleId: string; newStatus: string }[] = [];
            salesToUpdate.forEach((sale, index) => {
                const iderisStatus = statusMap.get((sale as any).order_id);
                if (iderisStatus && iderisStatus !== sale.status) {
                    updates.push({ saleId: sale.id, newStatus: iderisStatus });
                }
                const currentProgress = ((index + 1) / salesToUpdate.length) * 100;
                setSyncProgress(currentProgress);
                setSyncStatus({ current: index + 1, total: salesToUpdate.length });
            });

            if (updates.length > 0) {
                await updateSalesStatuses(updates);
                // Refresh local data after update
                const reloadedSales = await loadSales();
                setAllSales(reloadedSales);
                 toast({ title: 'Sincronização Concluída!', description: `${updates.length} de ${salesToUpdate.length} pedidos tiveram seus status atualizados.` });
            } else {
                 toast({ title: 'Nenhuma Mudança', description: 'Todos os pedidos no período já estavam com o status atualizado.' });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            toast({ variant: 'destructive', title: 'Erro ao Sincronizar Status', description: errorMessage });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const uniqueStatusDescriptions = useMemo(() => {
        if (!allSales) return [];
        const statuses = allSales.map(r => (r as any).status).filter(Boolean);
        return ['all', ...Array.from(new Set(statuses))];
    }, [allSales]);

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


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Acompanhamento de Status de Pedidos</CardTitle>
                    <CardDescription>Busque os status dos pedidos em um determinado período. A sincronização com a Ideris ignora automaticamente pedidos que já foram marcados como "Entregue".</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                    <div className="flex-grow">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    </div>
                    <Button onClick={handleSyncStatus} disabled={isSyncing || isLoading}>
                        {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        Sincronizar Status com a Ideris
                    </Button>
                </CardContent>
            </Card>

            {(isLoading || isSyncing) && (
                 <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">{isLoading ? "Carregando dados..." : "Sincronizando com a Ideris..."}</p>
                    {isSyncing && (
                         <div className="w-full max-w-md space-y-2">
                             <Progress value={syncProgress} className="w-full" />
                             <p className="text-sm text-muted-foreground text-center">
                                Verificando {syncStatus.current} de {syncStatus.total}...
                            </p>
                        </div>
                    )}
                </div>
            )}

            {!isLoading && !isSyncing && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FilePieChart/> Resultado da Busca</CardTitle>
                        <CardDescription>
                            Exibindo {filteredData.length} de {allSales.length} registros encontrados no banco de dados para o período.
                        </CardDescription>
                         <div className="flex flex-col md:flex-row gap-4 pt-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por ID ou Cód. do Pedido..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Filtrar por Status (Ideris)" />
                                </SelectTrigger>
                                <SelectContent>
                                     {uniqueStatusDescriptions.map((status, index) => (
                                        <SelectItem key={`${status}-${index}`} value={status}>{status === 'all' ? 'Todos os Status' : status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID do Pedido</TableHead>
                                        <TableHead>Cód. do Pedido</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Marketplace</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.length > 0 ? paginatedData.map((item) => (
                                        <TableRow key={(item as any).id}>
                                            <TableCell className="font-semibold">{(item as any).order_id}</TableCell>
                                            <TableCell className="font-mono">{(item as any).order_code}</TableCell>
                                            <TableCell><Badge variant={(item as any).status === 'Entregue' ? 'default' : 'secondary'} className={(item as any).status === 'Entregue' ? 'bg-green-600' : ''}>{(item as any).status}</Badge></TableCell>
                                            <TableCell>{(item as any).marketplace_name}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">Nenhum registro encontrado com os filtros atuais.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
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
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}

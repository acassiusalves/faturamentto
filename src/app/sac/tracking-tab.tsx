
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, Database, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { loadAppSettings } from '@/services/firestore';
import { fetchOrdersStatus } from '@/services/ideris';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface OrderStatus {
    orderId: number;
    statusId: number;
    statusDescription: string;
    mktStatusDescription: string;
    authenticationId: number;
}

export function TrackingTab() {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [isLoading, setIsLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState<OrderStatus[] | null>(null);

    // Filter and pagination states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [mktStatusFilter, setMktStatusFilter] = useState('all');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const handleFetchStatus = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ variant: 'destructive', title: 'Período Inválido', description: 'Por favor, selecione um período de datas válido.' });
            return;
        }
        setIsLoading(true);
        setApiResponse(null);
        try {
            const settings = await loadAppSettings();
            if (!settings?.iderisPrivateKey) {
                throw new Error("A chave da API da Ideris não está configurada.");
            }
            const statuses = await fetchOrdersStatus(settings.iderisPrivateKey, dateRange);
            setApiResponse(statuses);
            toast({ title: 'Busca Concluída!', description: `${statuses.length} status de pedidos foram encontrados no período.` });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            toast({ variant: 'destructive', title: 'Erro ao Buscar Status', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const uniqueStatusDescriptions = useMemo(() => {
        if (!apiResponse) return [];
        return ['all', ...Array.from(new Set(apiResponse.map(r => r.statusDescription)))];
    }, [apiResponse]);

    const uniqueMktStatusDescriptions = useMemo(() => {
        if (!apiResponse) return [];
        return ['all', ...Array.from(new Set(apiResponse.map(r => r.mktStatusDescription)))];
    }, [apiResponse]);

    const filteredData = useMemo(() => {
        if (!apiResponse) return [];
        return apiResponse.filter(item => {
            const searchMatch = searchTerm ? item.orderId.toString().includes(searchTerm) : true;
            const statusMatch = statusFilter === 'all' || item.statusDescription === statusFilter;
            const mktStatusMatch = mktStatusFilter === 'all' || item.mktStatusDescription === mktStatusFilter;
            return searchMatch && statusMatch && mktStatusMatch;
        });
    }, [apiResponse, searchTerm, statusFilter, mktStatusFilter]);

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
                    <CardDescription>Busque os status de todos os pedidos em um determinado período diretamente da Ideris.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                    <div className="flex-grow">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    </div>
                    <Button onClick={handleFetchStatus} disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Buscar Status'}
                    </Button>
                </CardContent>
            </Card>

            {isLoading && (
                 <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">Buscando status na Ideris...</p>
                </div>
            )}

            {apiResponse && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database/> Resultado da Busca</CardTitle>
                        <CardDescription>
                            Exibindo {filteredData.length} de {apiResponse.length} registros encontrados.
                        </CardDescription>
                         <div className="flex flex-col md:flex-row gap-4 pt-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por ID do Pedido..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Filtrar por Status Ideris" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueStatusDescriptions.map(status => (
                                        <SelectItem key={status} value={status}>{status === 'all' ? 'Todos os Status (Ideris)' : status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={mktStatusFilter} onValueChange={setMktStatusFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Filtrar por Status Marketplace" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueMktStatusDescriptions.map(status => (
                                        <SelectItem key={status} value={status}>{status === 'all' ? 'Todos os Status (Marketplace)' : status}</SelectItem>
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
                                        <TableHead>Status Ideris</TableHead>
                                        <TableHead>Status Marketplace</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.length > 0 ? paginatedData.map((item) => (
                                        <TableRow key={item.orderId}>
                                            <TableCell className="font-semibold">{item.orderId}</TableCell>
                                            <TableCell><Badge variant="secondary">{item.statusDescription}</Badge></TableCell>
                                            <TableCell><Badge variant="outline">{item.mktStatusDescription}</Badge></TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">Nenhum registro encontrado com os filtros atuais.</TableCell>
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


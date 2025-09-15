
"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Filter, X, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Save } from 'lucide-react';
import { loadSales, loadAppSettings, saveAppSettings } from '@/services/firestore';
import type { Sale, AnalyzeLabelOutput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { fetchLabelAction, analyzeZplAction } from '@/app/actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";
import { ZplEditor } from "./zpl-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialFetchState = {
    zplContent: null as string | null,
    error: null as string | null,
    rawError: null as string | null,
};

export default function EtiquetasPage() {
    const { toast } = useToast();
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [availableStates, setAvailableStates] = useState<Option[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    // State for ZPL processing
    const [zplContent, setZplContent] = useState<string | null>(null);
    const [isProcessingZpl, setIsProcessingZpl] = useState(false);
    const [zplAnalysis, setZplAnalysis] = useState<AnalyzeLabelOutput | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [fetchingOrderId, setFetchingOrderId] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [salesData, settings] = await Promise.all([
                loadSales(),
                loadAppSettings()
            ]);
            setAllSales(salesData);

            const statesFromSales = new Set<string>();
            salesData.forEach(sale => {
                const stateName = (sale as any).state_name;
                if (stateName) {
                    statesFromSales.add(stateName);
                }
            });
            const stateOptions = Array.from(statesFromSales).sort().map(s => ({ label: s, value: s }));
            setAvailableStates(stateOptions);

            if (settings?.etiquetasSelectedStates) {
                setSelectedStates(settings.etiquetasSelectedStates);
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar dados',
                description: 'Não foi possível buscar as vendas ou as configurações.'
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleFetchAndProcessZPL = async (orderId: string) => {
        setFetchingOrderId(orderId);
        setIsProcessingZpl(true);
        setZplContent(null);
        setZplAnalysis(null);
        
        try {
            // Step 1: Fetch ZPL
            const formData = new FormData();
            formData.append('orderId', orderId);
            const zplResult = await fetchLabelAction(initialFetchState, formData);

            if (zplResult.error || !zplResult.zplContent) {
                throw new Error(zplResult.error || 'Não foi possível obter o ZPL da Ideris.');
            }
             
            let imageUrl = null;
            try {
                const response = await fetch('/api/zpl-preview', {
                    method: 'POST',
                    body: zplResult.zplContent,
                });
                if (response.ok) {
                    const imageBlob = await response.blob();
                    imageUrl = URL.createObjectURL(imageBlob);
                }
            } catch (e) {
                console.error("Falha ao gerar imagem da etiqueta:", e);
            }

            setZplContent(zplResult.zplContent);

            // Step 2: Analyze ZPL
            const analyzeFormData = new FormData();
            analyzeFormData.append('zplContent', zplResult.zplContent);
            const analysisResult = await analyzeZplAction({ analysis: null, error: null }, analyzeFormData);

            if (analysisResult.error || !analysisResult.analysis) {
                throw new Error(analysisResult.error || 'Falha ao analisar os dados da etiqueta com a IA.');
            }

            setZplAnalysis(analysisResult.analysis);
            setIsEditorOpen(true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            toast({ variant: 'destructive', title: 'Erro no Processamento da Etiqueta', description: errorMessage });
        } finally {
            setIsProcessingZpl(false);
            setFetchingOrderId(null);
        }
    }


    const filteredSales = useMemo(() => {
        let salesToFilter = allSales;
        
        if (dateRange?.from) {
            salesToFilter = salesToFilter.filter(sale => {
                const saleDateStr = (sale as any).payment_approved_date;
                if (!saleDateStr) return false;
                const saleDate = new Date(saleDateStr);
                const fromDate = startOfDay(dateRange.from!);
                const toDate = dateRange.to ? endOfDay(dateRange.to) : fromDate;
                return saleDate >= fromDate && saleDate <= toDate;
            });
        }

        if (selectedStates.length > 0) {
            salesToFilter = salesToFilter.filter(sale => {
                const stateName = (sale as any).state_name;
                return stateName && selectedStates.includes(stateName);
            });
        } else {
             return [];
        }

        if (searchTerm.trim()) {
            const lowercasedTerm = searchTerm.toLowerCase();
            salesToFilter = salesToFilter.filter(sale => {
                const orderId = String((sale as any).order_id || '').toLowerCase();
                const orderCode = String((sale as any).order_code || '').toLowerCase();
                return orderId.includes(lowercasedTerm) || orderCode.includes(lowercasedTerm);
            });
        }

        return salesToFilter.sort((a, b) => {
            const dateA = new Date((a as any).payment_approved_date || 0).getTime();
            const dateB = new Date((b as any).payment_approved_date || 0).getTime();
            return dateB - dateA;
        });

    }, [allSales, selectedStates, searchTerm, dateRange]);
    
    const pageCount = useMemo(() => Math.ceil(filteredSales.length / pageSize), [filteredSales.length, pageSize]);
    
    const paginatedSales = useMemo(() => {
        const startIndex = pageIndex * pageSize;
        return filteredSales.slice(startIndex, startIndex + pageSize);
    }, [filteredSales, pageIndex, pageSize]);

    React.useEffect(() => {
        setPageIndex(0);
    }, [selectedStates, searchTerm, dateRange, pageSize]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveAppSettings({ etiquetasSelectedStates: selectedStates });
            toast({
                title: 'Seleção Salva!',
                description: 'Sua lista de estados foi salva com sucesso.'
            });
            setIsFilterDialogOpen(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Salvar',
                description: 'Não foi possível salvar a seleção de estados.'
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="ml-4">Carregando dados...</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-8 p-4 md:p-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Etiquetas por Localização</h1>
                        <p className="text-muted-foreground">
                            Filtre os pedidos pendentes por estado para imprimir suas etiquetas.
                        </p>
                    </div>
                    <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Filter className="mr-2 h-4 w-4" />
                                Filtrar Pedidos
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Filtros de Pedidos</DialogTitle>
                                <DialogDescription>
                                    Selecione os estados e o período para visualizar os pedidos.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Estados</Label>
                                    <MultiSelect
                                        options={availableStates}
                                        value={selectedStates}
                                        onChange={setSelectedStates}
                                        placeholder="Selecione os estados..."
                                        emptyText="Nenhum estado encontrado"
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Período</Label>
                                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsFilterDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar e Aplicar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                     <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <CardTitle>Pedidos Encontrados ({filteredSales.length})</CardTitle>
                                <CardDescription>
                                    Exibindo pedidos para os filtros aplicados.
                                </CardDescription>
                                {selectedStates.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="text-sm font-medium">Estados:</span>
                                        {selectedStates.map(state => (
                                            <Badge key={state} variant="secondary">
                                                {state}
                                                <button onClick={() => setSelectedStates(prev => prev.filter(s => s !== state))} className="ml-1.5 opacity-70 hover:opacity-100">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                             <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por ID Ideris ou Cód. Pedido..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID Ideris</TableHead>
                                        <TableHead>Cód. Pedido</TableHead>
                                        <TableHead>Data Aprovação</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Cidade/Estado</TableHead>
                                        <TableHead>Marketplace</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedSales.length > 0 ? (
                                        paginatedSales.map(sale => (
                                            <TableRow key={(sale as any).id}>
                                                <TableCell>{(sale as any).order_id}</TableCell>
                                                <TableCell className="font-mono">{(sale as any).order_code}</TableCell>
                                                <TableCell>{formatDate((sale as any).payment_approved_date)}</TableCell>
                                                <TableCell>{(sale as any).customer_name}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{(sale as any).address_city}</span>
                                                        <span className="text-xs text-muted-foreground">{(sale as any).state_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{(sale as any).marketplace_name}</Badge></TableCell>
                                                <TableCell className="text-center">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleFetchAndProcessZPL((sale as any).order_id)}
                                                        disabled={isProcessingZpl}
                                                    >
                                                        {isProcessingZpl && fetchingOrderId === (sale as any).order_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                        Etiqueta
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                {selectedStates.length > 0 ? "Nenhum pedido encontrado para os filtros atuais." : "Selecione um estado para começar."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                        <div className="text-sm text-muted-foreground">
                            Total de {filteredSales.length} registros.
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Itens por página</p>
                                <Select
                                    value={`${pageSize}`}
                                    onValueChange={(value) => setPageSize(Number(value))}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={pageSize.toString()} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[10, 20, 50, 100].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-sm font-medium">
                                Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0}>
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1}>
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
            </div>
            
             <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-5xl h-[95vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Editor de Etiqueta</DialogTitle>
                         <DialogDescription>
                            Altere os campos da etiqueta e visualize o resultado em tempo real antes de imprimir.
                        </DialogDescription>
                    </DialogHeader>
                    {isProcessingZpl || !zplContent || !zplAnalysis ? (
                         <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <p className="ml-4">Processando etiqueta...</p>
                        </div>
                    ) : (
                       <ZplEditor originalZpl={zplContent} initialData={zplAnalysis} />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

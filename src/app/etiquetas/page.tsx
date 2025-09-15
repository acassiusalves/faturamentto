
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MapPin, Save } from 'lucide-react';
import { loadSales, loadAppSettings, saveAppSettings } from '@/services/firestore';
import type { Sale } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function EtiquetasPage() {
    const { toast } = useToast();
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [availableStates, setAvailableStates] = useState<Option[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [salesData, settings] = await Promise.all([
                loadSales(),
                loadAppSettings()
            ]);
            setAllSales(salesData);

            // Populate available states from sales data
            const statesFromSales = new Set<string>();
            salesData.forEach(sale => {
                const stateName = (sale as any).state_name;
                if (stateName) {
                    statesFromSales.add(stateName);
                }
            });
            const stateOptions = Array.from(statesFromSales).sort().map(s => ({ label: s, value: s }));
            setAvailableStates(stateOptions);

            // Load saved states
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

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredSales = useMemo(() => {
        if (selectedStates.length === 0) {
            return [];
        }
        return allSales.filter(sale => {
            const stateName = (sale as any).state_name;
            return stateName && selectedStates.includes(stateName);
        });
    }, [allSales, selectedStates]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveAppSettings({ etiquetasSelectedStates: selectedStates });
            toast({
                title: 'Seleção Salva!',
                description: 'Sua lista de estados foi salva com sucesso.'
            });
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
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="ml-4">Carregando dados...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Etiquetas por Localização</h1>
                <p className="text-muted-foreground">
                    Selecione os estados para visualizar os pedidos pendentes e imprimir etiquetas.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin />
                        Filtro de Estados
                    </CardTitle>
                    <CardDescription>
                        Escolha um ou mais estados para listar os pedidos correspondentes. Clique em "Salvar Seleção" para manter sua escolha para futuros acessos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-md">
                      <MultiSelect
                          options={availableStates}
                          value={selectedStates}
                          onChange={setSelectedStates}
                          placeholder="Selecione os estados..."
                          emptyText="Nenhum estado encontrado"
                      />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Seleção
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Pedidos Encontrados ({filteredSales.length})</CardTitle>
                    <CardDescription>
                        Lista de pedidos para os estados selecionados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cód. Pedido</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Cidade/Estado</TableHead>
                                    <TableHead>Marketplace</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSales.length > 0 ? (
                                    filteredSales.map(sale => (
                                        <TableRow key={(sale as any).id}>
                                            <TableCell className="font-mono">{(sale as any).order_code}</TableCell>
                                            <TableCell>{(sale as any).customer_name}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{(sale as any).address_city}</span>
                                                    <span className="text-xs text-muted-foreground">{(sale as any).state_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{(sale as any).marketplace_name}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            {selectedStates.length > 0 ? "Nenhum pedido encontrado para os estados selecionados." : "Selecione um estado para começar."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


"use client";

import { useState, useEffect } from 'react';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, Database } from 'lucide-react';
import { loadAppSettings } from '@/services/firestore';
import { fetchOrdersStatus } from '@/services/ideris';

export function TrackingTab() {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [isLoading, setIsLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState<any[] | null>(null);

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
                        <CardTitle className="flex items-center gap-2"><Database/> Resposta da API</CardTitle>
                        <CardDescription>
                            Dados brutos retornados pela API da Ideris para a busca de status no período selecionado.
                            Total de {apiResponse.length} registros.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs max-h-[500px]">
                            <code>
                                {JSON.stringify(apiResponse, null, 2)}
                            </code>
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

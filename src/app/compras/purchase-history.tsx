
"use client";

import { useState, useEffect } from 'react';
import { loadPurchaseHistory } from '@/services/firestore';
import type { PurchaseList } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, PackageSearch } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export function PurchaseHistory() {
    const [history, setHistory] = useState<PurchaseList[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            setIsLoading(true);
            const purchaseHistory = await loadPurchaseHistory();
            setHistory(purchaseHistory);
            setIsLoading(false);
        }
        fetchHistory();
    }, []);

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string) => {
        return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="ml-4">Carregando histórico...</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    <div>
                        <CardTitle>Histórico de Listas de Compras</CardTitle>
                        <CardDescription>
                            Consulte todas as listas de compras que foram salvas no sistema.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {history.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {history.map(purchase => (
                            <AccordionItem key={purchase.id} value={purchase.id} className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex flex-col text-left">
                                            <span className="font-semibold">Compra de {formatDate(purchase.createdAt)}</span>
                                            <span className="text-sm text-muted-foreground">{purchase.items.length} produto(s) diferente(s)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">Custo Total:</span>
                                            <Badge variant="default" className="text-base">{formatCurrency(purchase.totalCost)}</Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <div className="rounded-md border mt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Produto</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead className="text-center">Quantidade</TableHead>
                                                    <TableHead className="text-right">Custo Unit.</TableHead>
                                                    <TableHead className="text-right">Custo Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {purchase.items.map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{item.productName}</TableCell>
                                                        <TableCell className="font-mono">{item.sku}</TableCell>
                                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                                                        <TableCell className="text-right font-semibold">{formatCurrency(item.unitCost * item.quantity)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <PackageSearch className="mx-auto h-12 w-12 mb-4" />
                        <p>Nenhuma lista de compra salva no histórico.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


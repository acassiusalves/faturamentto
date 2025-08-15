
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Sale } from '@/lib/types';
import { loadSales } from '@/services/firestore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

const STATUS_FILTERS = ['Aberto', 'A faturar', 'Faturado', 'Em separação'];

export default function ComprasPage() {
    const [orders, setOrders] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allSales = await loadSales();
            const filteredOrders = allSales.filter(sale => 
                sale.order_status && STATUS_FILTERS.includes(sale.order_status)
            );
            setOrders(filteredOrders);
        } catch (e) {
            console.error("Failed to fetch sales from Firestore:", e);
            setError(e instanceof Error ? e.message : "Ocorreu um erro desconhecido ao carregar os pedidos.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
        const lowerStatus = status?.toLowerCase() || '';
        if (lowerStatus.includes('faturado')) return 'default';
        if (lowerStatus.includes('aberto')) return 'secondary';
        if (lowerStatus.includes('em separação')) return 'outline';
        return 'secondary';
    }
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">Buscando pedidos no banco de dados...</p>
                </div>
            )
        }
        
        if (error) {
             return (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro ao Carregar Pedidos</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            );
        }

        if (orders.length === 0) {
            return (
                <div className="text-center text-muted-foreground py-10">
                    <ShoppingCart className="mx-auto h-12 w-12 mb-4" />
                    <p>Nenhum pedido com status de compra encontrado no momento.</p>
                     <p className="text-xs mt-2">Certifique-se de que os pedidos foram importados na tela de <Link href="/mapeamento" className="underline">Mapeamento</Link>.</p>
                </div>
            )
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>ID do Pedido</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-center">Qtd.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={(order as any).order_id || order.id}>
                                <TableCell className="whitespace-nowrap">{formatDate((order as any).payment_approved_date)}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(order.order_status)}>
                                        {order.order_status || 'N/A'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{(order as any).order_code}</TableCell>
                                <TableCell className="font-medium">{(order as any).item_title}</TableCell>
                                <TableCell className="font-mono">{(order as any).item_sku}</TableCell>
                                <TableCell className="text-center font-bold">{(order as any).item_quantity}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Relatório de Compras</h1>
        <p className="text-muted-foreground">
          Pedidos em aberto e faturados que representam a necessidade de compra de estoque.
        </p>
      </div>

       <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <CardTitle>Pedidos com Demanda de Compra</CardTitle>
                    <CardDescription>
                        Exibindo pedidos com status: Aberto, A Faturar, Faturado e Em Separação.
                    </CardDescription>
                </div>
                <Button onClick={() => fetchData()} disabled={isLoading} variant="outline">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}

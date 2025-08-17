
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShoppingCart, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Package, DollarSign, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadAppSettings, findSaleByOrderNumber } from '@/services/firestore';
import { fetchOpenOrdersFromIderis } from '@/services/ideris';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface PurchaseListItem {
  sku: string;
  name: string;
  quantity: number;
}


export default function ComprasPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // State for the purchase list
    const [purchaseList, setPurchaseList] = useState<PurchaseListItem[]>([]);
    const [unitCosts, setUnitCosts] = useState<Map<string, number>>(new Map());
    const [isGenerating, setIsGenerating] = useState(false); 

    
    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const generatePurchaseList = useCallback(async (ordersToProcess: any[]) => {
        setIsGenerating(true);
        setPurchaseList([]);
        
        const productMap = new Map<string, { name: string; quantity: number }>();

        // Processa os pedidos que já foram carregados da Ideris
        ordersToProcess.forEach(order => {
            // Acessa a lista de itens dentro de cada pedido
            if (order && order.items && Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                    const sku = item.sku;
                    if (sku) {
                        const existing = productMap.get(sku);
                        if (existing) {
                            existing.quantity += item.quantity || 1;
                        } else {
                            productMap.set(sku, {
                                name: item.title || 'Produto sem nome',
                                quantity: item.quantity || 1
                            });
                        }
                    }
                });
            }
        });

        const aggregatedList: PurchaseListItem[] = Array.from(productMap.entries()).map(([sku, data]) => ({
            sku,
            name: data.name,
            quantity: data.quantity
        }));

        setPurchaseList(aggregatedList);
        setIsGenerating(false);
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await loadAppSettings();
            if (!settings?.iderisPrivateKey || settings.iderisApiStatus !== 'valid') {
                throw new Error('A chave da API da Ideris não é válida ou não está configurada.');
            }
            
            const openOrders = await fetchOpenOrdersFromIderis(settings.iderisPrivateKey);
            const filteredOrders = openOrders.filter(order => order.statusDescription !== 'PEDIDO_EM_TRANSITO');
            setOrders(filteredOrders);

        } catch (e) {
            console.error("Failed to fetch sales from Ideris:", e);
            setError(e instanceof Error ? e.message : "Ocorreu um erro desconhecido ao carregar os pedidos da Ideris.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const pageCount = Math.ceil(orders.length / pageSize);

    const paginatedOrders = useMemo(() => {
      const startIndex = pageIndex * pageSize;
      return orders.slice(startIndex, startIndex + pageSize);
    }, [orders, pageIndex, pageSize]);
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };
    
    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const handleCostChange = (sku: string, cost: string) => {
        const newCosts = new Map(unitCosts);
        const numericCost = parseFloat(cost);
        if (!isNaN(numericCost)) {
            newCosts.set(sku, numericCost);
        } else {
            newCosts.delete(sku);
        }
        setUnitCosts(newCosts);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">Buscando pedidos na Ideris...</p>
                </div>
            )
        }
        
        if (error) {
             return (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro ao Carregar Pedidos</AlertTitle>
                    <AlertDescription>
                        {error}
                        <br/>
                        Verifique sua conexão e a chave da API na tela de <Link href="/mapeamento" className="underline font-semibold">Mapeamento</Link>.
                    </AlertDescription>
                </Alert>
            );
        }

        if (orders.length === 0) {
            return (
                <div className="text-center text-muted-foreground py-10">
                    <ShoppingCart className="mx-auto h-12 w-12 mb-4" />
                    <p>Nenhum pedido com demanda de compra encontrado.</p>
                </div>
            )
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID do Pedido</TableHead>
                            <TableHead>Data de Aprovação</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Marketplace</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Código do Pedido</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOrders.map((order, index) => (
                            <TableRow key={order.id || index}>
                                <TableCell>{order.id}</TableCell>
                                <TableCell>{formatDate(order.approved)}</TableCell>
                                <TableCell>
                                    <Badge variant={order.statusDescription?.toLowerCase().includes('aberto') ? 'default' : 'secondary'}>
                                        {order.statusDescription}
                                    </Badge>
                                </TableCell>
                                <TableCell>{order.marketplaceName}</TableCell>
                                <TableCell>{order.intermediaryName}</TableCell>
                                <TableCell className="font-mono">{order.code}</TableCell>
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
                        Exibindo a resposta da API em uma tabela. Busca referente aos últimos 5 dias.
                    </CardDescription>
                </div>
                 <div className="flex items-center gap-4">
                    <span className="text-muted-foreground font-semibold">
                        {orders.length} pedidos
                    </span>
                    <Button onClick={() => fetchData()} disabled={isLoading} variant="outline">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            {renderContent()}
        </CardContent>
        <CardFooter className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground">
                Total de {orders.length} pedidos.
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
      
      <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                 <div>
                    <CardTitle>Relação de Produtos para Compra</CardTitle>
                    <CardDescription>
                        Lista agregada de todos os produtos necessários com base nos pedidos acima.
                    </CardDescription>
                </div>
                <Button onClick={() => generatePurchaseList(orders)} disabled={orders.length === 0 || isGenerating}>
                    {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Search className="mr-2 h-4 w-4"/>
                    )}
                    {isGenerating ? 'Buscando...' : 'Buscar produtos'}
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {isGenerating ? (
                 <div className="flex items-center justify-center h-48">
                    <Loader2 className="animate-spin text-primary" size={32} />
                 </div>
            ) : purchaseList.length > 0 ? (
                 <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead className="w-[150px]">Custo Unit.</TableHead>
                                <TableHead className="text-center">Qtd.</TableHead>
                                <TableHead className="text-right">Custo Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {purchaseList.map((item) => {
                                const unitCost = unitCosts.get(item.sku) || 0;
                                const totalCost = unitCost * item.quantity;
                                return (
                                <TableRow key={item.sku}>
                                    <TableCell className="font-mono">{item.sku}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>
                                         <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                className="pl-8"
                                                onChange={(e) => handleCostChange(item.sku, e.target.value)}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(totalCost)}</TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-10">
                    <Package className="mx-auto h-12 w-12 mb-4" />
                    <p>Nenhum produto para comprar com base nos filtros atuais.</p>
                     <p className="text-sm">Clique em "Buscar produtos" para gerar a lista.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

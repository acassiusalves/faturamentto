
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShoppingCart, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Package, Search, DollarSign, Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loadAppSettings, loadProducts, findProductByAssociatedSku, savePurchaseList } from '@/services/firestore';
import { fetchOpenOrdersFromIderis, fetchOrderById } from '@/services/ideris';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Product, PurchaseListItem, PurchaseList } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseHistory } from './purchase-history';


// Interface para a nova lista de exibição
interface DisplayListItem {
  orderId: number;
  title: string;
  sku: string;
  quantity: number;
}

// Interface para a lista agrupada
interface GroupedListItem {
    productName: string;
    sku: string;
    totalQuantity: number;
}


export default function ComprasPage() {
    const { toast } = useToast();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    
    // Novo estado para a lista de produtos a ser exibida
    const [displayList, setDisplayList] = useState<DisplayListItem[]>([]);
    const [isGenerating, setIsGenerating] = useState(false); 
    const [isGrouped, setIsGrouped] = useState(false);
    
    const [costs, setCosts] = useState<Map<string, number>>(new Map());
    const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
    const [isSaving, setIsSaving] = useState(false);


    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const generateDisplayList = useCallback(async (ordersToProcess: any[]) => {
        setIsGenerating(true);
        setError(null);
        setDisplayList([]);
        
        const settings = await loadAppSettings();
        if (!settings?.iderisPrivateKey) {
            setError("A chave da API da Ideris não está configurada.");
            setIsGenerating(false);
            return;
        }

        try {
            const [systemProducts, detailedOrders] = await Promise.all([
                loadProducts(),
                Promise.all(ordersToProcess.map(order => fetchOrderById(settings.iderisPrivateKey, order.id)))
            ]);
            
            const productSkuMap = new Map<string, Product>();
            systemProducts.forEach(p => {
                productSkuMap.set(p.sku, p); // Map main SKU
                p.associatedSkus?.forEach(assocSku => {
                    productSkuMap.set(assocSku, p); // Map associated SKUs to parent product
                });
            });


            const flatItemList: DisplayListItem[] = [];
            
            for (const orderResult of detailedOrders) {
                const items = orderResult?.obj?.items; 

                if (items && Array.isArray(items)) {
                    for (const item of items) {
                        const parentProduct = productSkuMap.get(item.sku);
                        flatItemList.push({
                            orderId: orderResult.obj.id,
                            title: parentProduct?.name || item.title,
                            sku: item.sku,
                            quantity: item.quantity
                        });
                    }
                }
            }

            setDisplayList(flatItemList);

        } catch (err) {
            console.error("Erro ao gerar lista de compras a partir da API da Ideris:", err);
            const errorMessage = err instanceof Error ? err.message : "Ocorreu uma falha desconhecida.";
            setError(`Ocorreu uma falha ao buscar os detalhes dos pedidos na Ideris. Detalhe: ${errorMessage}`);
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const settings = await loadAppSettings();
            if (!settings?.iderisPrivateKey || settings.iderisApiStatus !== 'valid') {
                throw new Error('A chave da API da Ideris não é válida ou não está configurada.');
            }
            
            const [openOrders, products] = await Promise.all([
                fetchOpenOrdersFromIderis(settings.iderisPrivateKey),
                loadProducts()
            ]);

            const filteredOrders = openOrders.filter(order => order.statusDescription !== 'PEDIDO_EM_TRANSITO');
            setOrders(filteredOrders);
            setAllProducts(products);

        } catch (e) {
            console.error("Failed to fetch sales from Ideris:", e);
            setError(e instanceof Error ? e.message : "Ocorreu um erro desconhecido ao carregar os pedidos da Ideris.");
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const productSkuMap = useMemo(() => {
        const map = new Map<string, Product>();
        if (allProducts) {
            allProducts.forEach(p => {
                map.set(p.sku, p);
                p.associatedSkus?.forEach(assocSku => {
                    map.set(assocSku, p);
                });
            });
        }
        return map;
    }, [allProducts]);

    const processedList = useMemo(() => {
        if (!isGrouped) {
            return displayList;
        }

        const groupedMap = new Map<string, GroupedListItem>();
        
        displayList.forEach(item => {
            const parentProduct = productSkuMap.get(item.sku);
            const mainSku = parentProduct?.sku || item.sku;
            const productName = parentProduct?.name || item.title;

            if (groupedMap.has(mainSku)) {
                const existing = groupedMap.get(mainSku)!;
                existing.totalQuantity += item.quantity;
            } else {
                groupedMap.set(mainSku, {
                    productName: productName,
                    sku: mainSku,
                    totalQuantity: item.quantity,
                });
            }
        });

        return Array.from(groupedMap.values());
    }, [displayList, isGrouped, productSkuMap]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleCostChange = (sku: string, value: string) => {
        const newCost = parseFloat(value);
        if (!isNaN(newCost)) {
            setCosts(prev => new Map(prev).set(sku, newCost));
        } else {
             setCosts(prev => {
                const newMap = new Map(prev);
                newMap.delete(sku);
                return newMap;
            });
        }
    };
    
     useEffect(() => {
        if (isGrouped) {
            let total = 0;
            processedList.forEach(item => {
                const cost = costs.get((item as GroupedListItem).sku) || 0;
                total += cost * (item as GroupedListItem).totalQuantity;
            });
            setTotalPurchaseCost(total);
        }
    }, [costs, processedList, isGrouped]);


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

    const handleSavePurchaseList = async () => {
        if (!isGrouped || processedList.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Ação Inválida',
                description: 'Você só pode salvar uma lista de compras agrupada.',
            });
            return;
        }

        setIsSaving(true);
        try {
            const itemsToSave: PurchaseListItem[] = (processedList as GroupedListItem[]).map(item => ({
                productName: item.productName,
                sku: item.sku,
                quantity: item.totalQuantity,
                unitCost: costs.get(item.sku) || 0,
            }));

            const purchaseListToSave: Omit<PurchaseList, 'id'> = {
                createdAt: new Date().toISOString(),
                totalCost: totalPurchaseCost,
                items: itemsToSave,
            };

            await savePurchaseList(purchaseListToSave);
            toast({
                title: 'Lista de Compras Salva!',
                description: 'O histórico de compras foi atualizado.',
            });

            // Reset state after saving
            setDisplayList([]);
            setCosts(new Map());
            setTotalPurchaseCost(0);

        } catch (err) {
            console.error('Error saving purchase list:', err);
            toast({
                variant: 'destructive',
                title: 'Erro ao Salvar',
                description: 'Não foi possível salvar a lista de compras.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveItem = (skuToRemove: string) => {
        setDisplayList(prevList => {
            return prevList.filter(item => {
                const parentProduct = productSkuMap.get(item.sku);
                const mainSku = parentProduct?.sku || item.sku;
                return mainSku !== skuToRemove;
            });
        });
        toast({
            title: "Item Removido",
            description: `O produto com SKU ${skuToRemove} foi removido da lista de compra.`,
        });
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
        
        if (error && !isGenerating) {
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
          Gere listas de compras a partir de pedidos em aberto e consulte seu histórico.
        </p>
      </div>

      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generator">Gerar Nova Lista</TabsTrigger>
            <TabsTrigger value="history">Histórico de Compras</TabsTrigger>
        </TabsList>
        <TabsContent value="generator" className="space-y-8 mt-6">
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
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                            <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
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
                                Lista de todos os produtos necessários com base nos pedidos acima.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="group-switch">Agrupar</Label>
                                <Switch id="group-switch" checked={isGrouped} onCheckedChange={setIsGrouped} />
                            </div>
                            <Button onClick={() => generateDisplayList(orders)} disabled={orders.length === 0 || isGenerating}>
                                {isGenerating ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Search className="mr-2 h-4 w-4"/> )}
                                {isGenerating ? 'Buscando...' : 'Buscar produtos'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isGenerating ? (
                        <div className="flex items-center justify-center h-48"> <Loader2 className="animate-spin text-primary" size={32} /> </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Erro ao Gerar Lista</AlertTitle>
                            <AlertDescription>{error}<br/>Verifique o console (F12) para detalhes.</AlertDescription>
                        </Alert>
                    ) : processedList.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {!isGrouped && <TableHead>ID (id)</TableHead>}
                                        <TableHead>Título do Produto</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead className="text-center">Quantidade</TableHead>
                                        {isGrouped && <TableHead className="text-right">Custo Unitário</TableHead>}
                                        {isGrouped && <TableHead className="text-right">Custo Total</TableHead>}
                                        {isGrouped && <TableHead className="text-center">Ações</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processedList.map((item, index) => {
                                        const sku = 'sku' in item ? item.sku : '';
                                        const quantity = 'quantity' in item ? item.quantity : ('totalQuantity' in item ? item.totalQuantity : 0);
                                        const unitCost = costs.get(sku) || 0;
                                        const totalCost = unitCost * quantity;

                                        return (
                                        <TableRow key={`${'orderId' in item ? item.orderId : ''}-${sku}-${index}`}>
                                            {!isGrouped && 'orderId' in item && <TableCell>{item.orderId}</TableCell>}
                                            <TableCell>{'title' in item ? item.title : ('productName' in item ? item.productName : '')}</TableCell>
                                            <TableCell className="font-mono">{sku}</TableCell>
                                            <TableCell className="text-center font-bold">{quantity}</TableCell>
                                            {isGrouped && (
                                                <>
                                                    <TableCell className="text-right">
                                                        <Input
                                                            type="number"
                                                            placeholder="R$ 0,00"
                                                            className="w-28 ml-auto text-right"
                                                            onChange={(e) => handleCostChange(sku, e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(totalCost)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveItem(sku)}
                                                        >
                                                            <XCircle className="text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            <Package className="mx-auto h-12 w-12 mb-4" />
                            <p>Nenhum produto para comprar.</p>
                            <p className="text-sm">Clique em "Buscar produtos" para gerar a lista a partir dos pedidos acima.</p>
                        </div>
                    )}
                </CardContent>
                {isGrouped && processedList.length > 0 && (
                    <CardFooter className="flex justify-end items-center gap-4 bg-muted/50 p-4 border-t">
                        <Button onClick={handleSavePurchaseList} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar
                        </Button>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-lg">Custo Total da Compra:</span>
                            <span className="font-bold text-2xl text-primary flex items-center gap-2">
                                <DollarSign size={24} />
                                {formatCurrency(totalPurchaseCost)}
                            </span>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
            <PurchaseHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

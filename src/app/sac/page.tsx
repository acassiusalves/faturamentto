
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, FileText, Package, User, MapPin, RefreshCw, Database, Truck, CalendarClock, ListChecks, SearchCheck, Ticket } from 'lucide-react';
import type { Sale } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { findSaleByOrderNumber, saveSales, loadAppSettings } from '@/services/firestore';
import { fetchOrderById, mapIderisOrderToSale } from '@/services/ideris';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrackingTab } from './tracking-tab';
import { TicketTab } from './ticket-tab';


export default function SacPage() {
    const { toast } = useToast();
    const [orderNumber, setOrderNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [foundSale, setFoundSale] = useState<Sale | null>(null);
    const [rawApiResponse, setRawApiResponse] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState("search");
    const [ticketOrder, setTicketOrder] = useState<Sale | null>(null);


    const handleSearchOrder = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!orderNumber.trim()) {
            toast({ variant: 'destructive', title: 'Campo Obrigatório', description: 'Por favor, insira um número de pedido para buscar.' });
            return;
        }
        setIsLoading(true);
        setFoundSale(null);
        setRawApiResponse(null);
        try {
            const sale = await findSaleByOrderNumber(orderNumber.trim());
            if (sale) {
                setFoundSale(sale);
            } else {
                toast({ variant: 'destructive', title: 'Pedido não encontrado', description: 'Nenhuma venda corresponde ao número de pedido inserido.' });
            }
        } catch (error) {
            console.error('Error searching for order:', error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível completar a busca. Tente novamente.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateOrder = async () => {
        if (!foundSale || !(foundSale as any).order_id) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Nenhum pedido válido para atualizar.' });
            return;
        }
        
        setIsUpdating(true);
        setRawApiResponse(null);
        try {
            const settings = await loadAppSettings();
            if (!settings?.iderisPrivateKey) {
                throw new Error("Chave da API da Ideris não configurada.");
            }
            
            const iderisOrderData = await fetchOrderById(settings.iderisPrivateKey, (foundSale as any).order_id);
            setRawApiResponse(iderisOrderData?.obj || { error: 'Nenhum dado retornado' });

            if (iderisOrderData && iderisOrderData.obj) {
                const updatedSale = mapIderisOrderToSale(iderisOrderData.obj, 0);
                await saveSales([updatedSale]); // Save updated data to Firestore
                setFoundSale(updatedSale); // Update the state to reflect changes instantly
                toast({ title: 'Sucesso!', description: 'Os dados do pedido foram atualizados com sucesso.'});
            } else {
                throw new Error("A API da Ideris não retornou dados para este pedido.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
            console.error("Error updating order:", error);
            toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: errorMessage });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleOpenTicketForOrder = (sale: Sale) => {
        setTicketOrder(sale);
        setActiveTab("ticket");
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined || isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };


    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Central de Atendimento ao Cliente (SAC)</h1>
                <p className="text-muted-foreground">Localize pedidos para tratar de devoluções e outros problemas de pós-venda.</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="search">
                        <SearchCheck className="mr-2"/>
                        Buscar Pedido
                    </TabsTrigger>
                    <TabsTrigger value="tracking">
                        <ListChecks className="mr-2"/>
                        Acompanhamento
                    </TabsTrigger>
                     <TabsTrigger value="ticket">
                        <Ticket className="mr-2"/>
                        Ticket
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="mt-6">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Buscar Pedido</CardTitle>
                                <CardDescription>Insira o código do pedido para carregar os detalhes da venda e do cliente.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSearchOrder} className="flex items-end gap-4">
                                    <div className="flex-grow space-y-2">
                                        <Label htmlFor="order-search">Código do Pedido</Label>
                                        <Input
                                            id="order-search"
                                            placeholder="Digite o código do pedido aqui..."
                                            value={orderNumber}
                                            onChange={(e) => setOrderNumber(e.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                                        Buscar
                                    </Button>
                                    {foundSale && (
                                        <Button type="button" variant="outline" onClick={handleUpdateOrder} disabled={isUpdating}>
                                            {isUpdating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                            Atualizar Dados
                                        </Button>
                                    )}
                                </form>
                            </CardContent>
                        </Card>

                        {(isLoading || isUpdating) && (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="animate-spin text-primary" size={32} />
                                <p className="ml-4">{isUpdating ? 'Atualizando dados do pedido...' : 'Buscando informações do pedido...'}</p>
                            </div>
                        )}

                        {foundSale && !isUpdating && (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Card className="lg:col-span-1">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><FileText/> Detalhes da Venda</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div className="flex justify-between"><span>ID do Pedido:</span> <span className="font-semibold">{(foundSale as any).order_id}</span></div>
                                        <div className="flex justify-between"><span>Código:</span> <span className="font-mono">{(foundSale as any).order_code}</span></div>
                                        <div className="flex justify-between"><span>Data da Venda:</span> <span className="font-semibold">{formatDate((foundSale as any).payment_approved_date)}</span></div>
                                        <div className="flex justify-between items-center"><span>Marketplace:</span> <Badge variant="secondary">{(foundSale as any).marketplace_name}</Badge></div>
                                        <div className="flex justify-between items-center"><span>Conta:</span> <Badge variant="outline">{(foundSale as any).auth_name}</Badge></div>
                                        <div className="flex justify-between items-center"><span>Status:</span> <Badge>{(foundSale as any).status}</Badge></div>
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4"/> Data de Envio:</span> 
                                            <span className="font-semibold">{formatDate((foundSale as any).sent_date)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="flex items-center gap-1.5"><Truck className="h-4 w-4"/> Rastreio:</span> 
                                            <span className="font-mono">{(foundSale as any).deliveryTrackingCode || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between"><span>Valor Pago:</span> <span className="font-bold text-primary">{formatCurrency((foundSale as any).paid_amount)}</span></div>
                                    </CardContent>
                                </Card>
                                <Card className="lg:col-span-1">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Package/> Produto Vendido</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <p className="font-semibold text-base leading-tight">{(foundSale as any).item_title}</p>
                                        <div className="flex justify-between"><span>SKU:</span> <span className="font-mono">{(foundSale as any).item_sku}</span></div>
                                        <div className="flex justify-between"><span>Quantidade:</span> <span className="font-semibold">{(foundSale as any).item_quantity}</span></div>
                                    </CardContent>
                                </Card>
                                <Card className="lg:col-span-1">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><User/> Cliente e Entrega</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <div className="flex justify-between items-start gap-2">
                                            <span>Nome:</span> 
                                            <span className="font-semibold text-right">{(foundSale as any).customer_name} {(foundSale as any).customerLastName}</span>
                                        </div>
                                        <div className="flex justify-between"><span>Documento:</span> <span className="font-semibold">{(foundSale as any).document_value}</span></div>
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="whitespace-nowrap flex items-center gap-1.5"><MapPin className="h-4 w-4"/> Endereço:</span> 
                                            <span className="font-semibold text-right">
                                                {(foundSale as any).address_line}, {(foundSale as any).address_district} - {(foundSale as any).address_city}, {(foundSale as any).state_name} - CEP: {(foundSale as any).address_zip_code}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                                {rawApiResponse && (
                                    <Card className="lg:col-span-3">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><Database/> Resposta da API</CardTitle>
                                            <CardDescription>Dados brutos retornados pela API da Ideris para este pedido.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                                                <code>
                                                    {JSON.stringify(rawApiResponse, null, 2)}
                                                </code>
                                            </pre>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="tracking" className="mt-6">
                    <TrackingTab onOpenTicket={handleOpenTicketForOrder} />
                </TabsContent>
                <TabsContent value="ticket" className="mt-6">
                    <TicketTab order={ticketOrder} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

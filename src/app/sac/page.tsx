"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, FileText, Package, User, MapPin } from 'lucide-react';
import type { Sale } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { findSaleByOrderNumber } from '@/services/firestore';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SacPage() {
    const { toast } = useToast();
    const [orderNumber, setOrderNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundSale, setFoundSale] = useState<Sale | null>(null);

    const handleSearchOrder = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!orderNumber.trim()) {
            toast({ variant: 'destructive', title: 'Campo Obrigatório', description: 'Por favor, insira um número de pedido para buscar.' });
            return;
        }
        setIsLoading(true);
        setFoundSale(null);
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
                    </form>
                </CardContent>
            </Card>

            {isLoading && (
                 <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">Buscando informações do pedido...</p>
                </div>
            )}

            {foundSale && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileText/> Detalhes da Venda</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between"><span>ID do Pedido:</span> <span className="font-semibold">{(foundSale as any).order_id}</span></div>
                            <div className="flex justify-between"><span>Código:</span> <span className="font-mono">{(foundSale as any).order_code}</span></div>
                            <div className="flex justify-between"><span>Data da Venda:</span> <span className="font-semibold">{formatDate((foundSale as any).payment_approved_date)}</span></div>
                            <div className="flex justify-between"><span>Marketplace:</span> <Badge variant="secondary">{(foundSale as any).marketplace_name}</Badge></div>
                             <div className="flex justify-between"><span>Status:</span> <Badge>{(foundSale as any).status}</Badge></div>
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
                            <div className="flex justify-between"><span>Documento:</span> <span className="font-semibold">{(foundSale as any).document_value}</span></div>
                            <div className="flex justify-between items-start gap-2">
                                <span className="whitespace-nowrap flex items-center gap-1.5"><MapPin className="h-4 w-4"/> Estado:</span> 
                                <span className="font-semibold text-right">{(foundSale as any).state_name}</span>
                            </div>
                         </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

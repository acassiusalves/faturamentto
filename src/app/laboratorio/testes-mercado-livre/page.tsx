
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MercadoLivreLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, DollarSign, Percent, Database, Package, ExternalLink } from 'lucide-react';
import type { SaleCost, SaleCosts } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface MyItem {
    id: string;
    title: string;
    price: number;
    status: string;
    permalink: string;
    thumbnail: string;
}

export default function TestesMercadoLivrePage() {
    const [listingId, setListingId] = useState('');
    const [isLoadingCosts, setIsLoadingCosts] = useState(false);
    const [costs, setCosts] = useState<SaleCosts | null>(null);
    const [rawResponse, setRawResponse] = useState<any | null>(null);
    
    const [myItems, setMyItems] = useState<MyItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    const { toast } = useToast();

    const handleFetchCosts = async () => {
        if (!listingId.trim()) {
            toast({ variant: 'destructive', title: 'ID do Anúncio é obrigatório' });
            return;
        }

        setIsLoadingCosts(true);
        setCosts(null);
        setRawResponse(null);

        try {
            const response = await fetch('/api/ml/costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingIds: [listingId.trim()] }),
            });

            const data = await response.json();
            setRawResponse(data);

            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar custos');
            }

            if (data.items && data.items.length > 0) {
                 setCosts(data.items[0]);
            } else {
                throw new Error('Nenhum custo encontrado para o anúncio informado.');
            }

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Custos',
                description: error.message,
            });
        } finally {
            setIsLoadingCosts(false);
        }
    };

    const handleFetchMyItems = async () => {
        setIsLoadingItems(true);
        setMyItems([]);
        try {
            const response = await fetch('/api/ml/my-items');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar seus anúncios.');
            }

            setMyItems(data.items || []);
            toast({
                title: 'Sucesso!',
                description: `${data.items?.length || 0} anúncios ativos foram encontrados.`
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Anúncios',
                description: error.message,
            });
        } finally {
            setIsLoadingItems(false);
        }
    };
    
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Testes com API do Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Esta área é dedicada a testes e integrações com o Mercado Livre.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MercadoLivreLogo className="h-6 w-6" />
                        Calculadora de Custos de Anúncio
                    </CardTitle>
                    <CardDescription>
                        Insira o ID de um anúncio (ex: MLB12345678) para ver os custos de venda associados.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-end gap-2">
                        <div className="flex-grow space-y-2">
                            <Label htmlFor="listing-id">ID do Anúncio</Label>
                            <Input
                                id="listing-id"
                                placeholder="MLB1234567890"
                                value={listingId}
                                onChange={(e) => setListingId(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleFetchCosts} disabled={isLoadingCosts}>
                            {isLoadingCosts ? <Loader2 className="animate-spin" /> : <Search />}
                            Calcular
                        </Button>
                    </div>
                </CardContent>
                {costs && !isLoadingCosts && (
                    <CardFooter className="flex-col items-start gap-4">
                         <h3 className="font-semibold text-lg">Resultado para: {costs.id} ({costs.title})</h3>
                         <div className="w-full rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo de Anúncio</TableHead>
                                        <TableHead>Preço de Venda</TableHead>
                                        <TableHead>Custo do Frete</TableHead>
                                        <TableHead>Taxa de Venda (Comissão)</TableHead>
                                        <TableHead>Taxa Fixa</TableHead>
                                        <TableHead className="text-right font-bold">Valor Líquido Recebido</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {costs.costs.map((cost) => (
                                        <TableRow key={cost.listing_type_id}>
                                            <TableCell className="font-medium">{cost.listing_type_name}</TableCell>
                                            <TableCell>{formatCurrency(cost.price)}</TableCell>
                                            <TableCell>{formatCurrency(cost.shipping_cost)}</TableCell>
                                            <TableCell>
                                                {formatCurrency(cost.sale_fee)} ({cost.sale_fee_rate.toFixed(2)}%)
                                            </TableCell>
                                            <TableCell>{formatCurrency(cost.fixed_fee)}</TableCell>
                                            <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(cost.net_amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                    </CardFooter>
                )}
                 {rawResponse && !isLoadingCosts && (
                    <CardFooter>
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="raw-response">
                                <AccordionTrigger>
                                    <span className="flex items-center gap-2 font-semibold">
                                        <Database className="h-4 w-4" />
                                        Ver Resposta Bruta da API
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <pre className="mt-2 p-4 text-xs bg-muted rounded-lg overflow-auto max-h-96">
                                        <code>{JSON.stringify(rawResponse, null, 2)}</code>
                                    </pre>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardFooter>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Listar Meus Anúncios Ativos
                    </CardTitle>
                    <CardDescription>
                        Busca todos os anúncios com status "ativo" da sua conta no Mercado Livre.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleFetchMyItems} disabled={isLoadingItems}>
                        {isLoadingItems ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" />}
                        {isLoadingItems ? 'Buscando anúncios...' : 'Buscar Meus Anúncios'}
                    </Button>
                </CardContent>
                {myItems.length > 0 && !isLoadingItems && (
                     <CardFooter className="flex-col items-start gap-4">
                        <div className="w-full rounded-md border max-h-[600px] overflow-y-auto">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Anúncio</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Preço</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-4">
                                                    <div className="relative h-16 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                                         <Image src={item.thumbnail} alt={item.title} fill className="object-contain"/>
                                                    </div>
                                                    <div className="flex flex-col">
                                                         <Link href={item.permalink} target="_blank" className="font-semibold text-primary hover:underline">
                                                            {item.title}
                                                            <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                         </Link>
                                                         <span className="text-xs text-muted-foreground font-mono">{item.id}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={item.status === 'active' ? 'bg-green-600' : ''}>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg">{formatCurrency(item.price)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                           </Table>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}

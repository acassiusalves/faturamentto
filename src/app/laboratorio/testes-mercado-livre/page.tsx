
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MercadoLivreLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, DollarSign, Percent } from 'lucide-react';
import type { SaleCost, SaleCosts } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TestesMercadoLivrePage() {
    const [listingId, setListingId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [costs, setCosts] = useState<SaleCosts | null>(null);
    const { toast } = useToast();

    const handleFetchCosts = async () => {
        if (!listingId.trim()) {
            toast({ variant: 'destructive', title: 'ID do Anúncio é obrigatório' });
            return;
        }

        setIsLoading(true);
        setCosts(null);

        try {
            const response = await fetch('/api/ml/costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listingIds: [listingId.trim()] }),
            });

            const data = await response.json();

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
            setIsLoading(false);
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
                        <Button onClick={handleFetchCosts} disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                            Calcular
                        </Button>
                    </div>
                </CardContent>
                {costs && !isLoading && (
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
                                                {formatCurrency(cost.sale_fee)} ({cost.sale_fee_rate}%)
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
            </Card>
        </div>
    );
}

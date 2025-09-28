

"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package, ExternalLink, Users } from 'lucide-react';
import type { MyItem, MlAccount, CreateListingResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CreateListingForm } from './create-listing-form';
import { useFormState } from 'react-dom';
import { createCatalogListingAction } from '@/app/actions';


const MyItemsList = ({ accountId, accountName }: { accountId: string, accountName: string }) => {
    const [items, setItems] = useState<MyItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleFetchItems = async () => {
        setIsLoading(true);
        setItems([]);
        try {
            const response = await fetch(`/api/ml/my-items?account=${accountId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar seus anúncios.');
            }

            setItems(data.items || []);
            toast({
                title: 'Sucesso!',
                description: `${data.items?.length || 0} anúncios ativos foram encontrados para ${accountName}.`
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Anúncios',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Anúncios de {accountName}
                </CardTitle>
                <CardDescription>
                    Busca todos os anúncios com status "ativo" da conta no Mercado Livre.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleFetchItems} disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" />}
                    {isLoading ? 'Buscando anúncios...' : 'Buscar Anúncios'}
                </Button>
            </CardContent>
            {items.length > 0 && !isLoading && (
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
                                {items.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <div className="relative h-16 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                                     <Image src={item.thumbnail} alt={item.title} fill className="object-contain" data-ai-hint="product image" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <Link href={item.permalink} target="_blank" className="font-semibold text-primary hover:underline">
                                                        {item.title}
                                                        <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                     </Link>
                                                     <span className="text-xs text-muted-foreground font-mono">Item ID: {item.id}</span>
                                                     {item.catalog_product_id && <span className="text-xs text-muted-foreground font-mono">Catálogo ID: {item.catalog_product_id}</span>}
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
    )
}

const AccountsList = ({ accounts, isLoading, onFetch }: { accounts: MlAccount[], isLoading: boolean, onFetch: () => void }) => {
    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Contas do Mercado Livre
                </CardTitle>
                <CardDescription>
                    Busque as contas cadastradas na coleção `mercadoLivreAccounts` e liste seus respectivos anúncios.
                </CardDescription>
            </CardHeader>
             <CardContent>
                <Button onClick={onFetch} disabled={isLoading}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" />}
                    {isLoading ? 'Buscando...' : 'Buscar Contas Cadastradas'}
                </Button>
            </CardContent>
             {accounts.length > 0 && !isLoading && (
                <CardContent className="space-y-4">
                    <Accordion type="multiple" className="w-full">
                        {accounts.map(account => (
                            <AccordionItem value={account.id} key={account.id}>
                                <AccordionTrigger>
                                    <span className="font-semibold text-lg">{account.nickname || account.id}</span>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <MyItemsList accountId={account.id} accountName={account.nickname || account.id} />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            )}
        </Card>
    )
}


export default function TestesMercadoLivrePage() {
    const [accounts, setAccounts] = useState<MlAccount[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
    const { toast } = useToast();
    
    const handleFetchAccounts = React.useCallback(async () => {
        setIsLoadingAccounts(true);
        try {
            const response = await fetch('/api/ml/accounts');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar as contas.');
            }
            setAccounts(data.accounts || []);
            if (!data.accounts || data.accounts.length === 0) {
                 toast({
                    variant: 'destructive',
                    title: 'Nenhuma Conta Encontrada',
                    description: `Nenhuma conta encontrada. Adicione na página de Mapeamento.`
                });
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Erro ao Buscar Contas',
                description: error.message,
            });
        } finally {
            setIsLoadingAccounts(false);
        }
    }, [toast]);
    
    useEffect(() => {
        handleFetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Testes com API do Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Esta área é dedicada a testes e integrações com o Mercado Livre.
                </p>
            </div>

            <CreateListingForm accounts={accounts} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                 <AccountsList accounts={accounts} isLoading={isLoadingAccounts} onFetch={handleFetchAccounts} />
            </div>
        </div>
    );
}

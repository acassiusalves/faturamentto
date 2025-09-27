
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MercadoLivreLogo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Package, ExternalLink, Users, PlusCircle, ChevronsUpDown } from 'lucide-react';
import type { SaleCost, SaleCosts, MyItem, MlAccount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFormState, useFormStatus } from 'react-dom';
import { createCatalogListingAction } from '@/app/actions';


const listingSchema = z.object({
    catalogProductId: z.string().min(10, 'O ID do produto de catálogo é obrigatório (ex: MLB12345678).'),
    price: z.coerce.number().positive('O preço deve ser maior que zero.'),
    quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
    listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.'}),
    accountId: z.string().min(1, 'Selecione a conta para publicar.'),
});

type ListingFormValues = z.infer<typeof listingSchema>;


function CreateListingForm({ accounts }: { accounts: MlAccount[] }) {
    const { toast } = useToast();
    const [formState, formAction] = useFormState(createCatalogListingAction, { success: false, error: null, result: null });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: '',
            price: undefined,
            quantity: 1,
        }
    });

    const onSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, String(value));
        });
        
        await formAction(formData);
        setIsSubmitting(false);
    }
    
    useState(() => {
        if (formState?.error) {
            toast({ variant: 'destructive', title: 'Erro ao Criar Anúncio', description: formState.error });
        }
        if (formState?.success && formState.result) {
            toast({ title: 'Anúncio Criado com Sucesso!', description: `ID do novo anúncio: ${formState.result.id}` });
            form.reset();
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PlusCircle /> Criar Anúncio de Catálogo</CardTitle>
                <CardDescription>Crie um novo anúncio em uma de suas contas a partir de um ID de produto de catálogo do ML.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="catalogProductId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>ID do Produto de Catálogo</FormLabel>
                                <FormControl><Input placeholder="MLB123456789" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço</FormLabel>
                                    <FormControl><Input type="number" placeholder="299.90" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="quantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estoque</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={form.control} name="listingTypeId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Anúncio</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="gold_special">Clássico</SelectItem>
                                            <SelectItem value="gold_pro">Premium</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="accountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Publicar na Conta</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.nickname || acc.id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                            Criar Anúncio
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    )
}

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
    const { toast } = useToast();
    
    return (
         <Card className="col-span-1 lg:col-span-2">
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
    const [listingId, setListingId] = useState('');
    const [isLoadingCosts, setIsLoadingCosts] = useState(false);
    const [costs, setCosts] = useState<SaleCosts | null>(null);
    const [rawResponse, setRawResponse] = useState<any | null>(null);
    const [accounts, setAccounts] = useState<MlAccount[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

    
    const { toast } = useToast();

    const handleFetchAccounts = async () => {
        setIsLoadingAccounts(true);
        try {
            const response = await fetch('/api/ml/accounts');
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Falha ao buscar as contas.');
            }
            setAccounts(data.accounts || []);
            if (data.accounts?.length > 0) {
                 toast({
                    title: 'Contas Carregadas!',
                    description: `Encontradas ${data.accounts.length} contas do Mercado Livre.`
                });
            } else {
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
    };

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
    
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Testes com API do Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Esta área é dedicada a testes e integrações com o Mercado Livre.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                 <AccountsList accounts={accounts} isLoading={isLoadingAccounts} onFetch={handleFetchAccounts} />
                 <CreateListingForm accounts={accounts} />
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
            </Card>
        </div>
    );
}

    

// src/app/laboratorio/testes-mercado-livre/create-listing-form.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Database, AlertTriangle, Send, Search } from 'lucide-react';
import { useFormState } from 'react-dom';
import { createCatalogListingAction, findAveragePriceAction } from '@/app/actions';
import type { MlAccount, ProductResult, CreateListingPayload, CreateListingResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import { PriceAverageDialog } from './price-average-dialog';

const listingSchema = z.object({
    catalogProductId: z.string().min(10, 'O ID do produto de catálogo é obrigatório (ex: MLB12345678).'),
    title: z.string().optional(),
    price: z.coerce.number().positive('O preço deve ser maior que zero.'),
    quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
    listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.'}),
    accountIds: z.array(z.string()).min(1, 'Selecione pelo menos uma conta para publicar.'),
    condition: z.enum(['new', 'used', 'not_specified'], { required_error: 'Selecione a condição.' }).default('new'),
});

type ListingFormValues = z.infer<typeof listingSchema>;

const initialFormState: CreateListingResult = { success: false, error: null, result: null, payload: undefined };

// Dialog Wrapper
interface CreateListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductResult;
  accounts: MlAccount[];
}

export function CreateListingDialog({ isOpen, onClose, product, accounts }: CreateListingDialogProps) {
    const { toast } = useToast();
    const [formStates, setFormStates] = useState<Record<string, CreateListingResult>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPriceAverageOpen, setIsPriceAverageOpen] = useState(false);
    
    const accountOptions = React.useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.accountName || acc.id })), [accounts]);

    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: product?.catalog_product_id || '',
            title: product?.name || '',
            price: product?.price || undefined,
            quantity: 1,
            listingTypeId: (product?.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
            condition: 'new',
            accountIds: [],
        }
    });

    useEffect(() => {
        if (product) {
            form.reset({
                catalogProductId: product.catalog_product_id || '',
                title: product.name || '',
                price: product.price || undefined,
                quantity: 1,
                listingTypeId: (product.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                accountIds: [],
                condition: 'new',
            });
        }
    }, [product, form]);

    const onSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        setFormStates({}); // Limpa os resultados anteriores

        const results: Record<string, CreateListingResult> = {};
        
        for (const accountId of data.accountIds) {
            const formData = new FormData();
            formData.append('catalog_product_id', data.catalogProductId);
            formData.append('title', data.title || product.name);
            formData.append('price', String(data.price));
            formData.append('available_quantity', String(data.quantity));
            formData.append('listing_type_id', data.listingTypeId);
            formData.append('accountId', accountId); // Ação envia um por um
            formData.append('condition', data.condition);
            formData.append('category_id', product.category_id);
            
            const result = await createCatalogListingAction(initialFormState, formData);
            results[accountId] = result;
            setFormStates(prev => ({...prev, [accountId]: result}));
        }
        
        setIsSubmitting(false);
        const successCount = Object.values(results).filter(r => r.success).length;
        const errorCount = data.accountIds.length - successCount;

        if (successCount > 0) {
            toast({ title: 'Criação Concluída!', description: `${successCount} anúncio(s) criado(s) com sucesso.` });
        }
        if (errorCount > 0) {
             toast({ variant: 'destructive', title: 'Falhas na Criação', description: `${errorCount} anúncio(s) falharam.` });
        }
        if (errorCount === 0) {
            form.reset();
            onClose();
        }
    };
    
    const handlePriceCalculated = (avgPrice: number) => {
        form.setValue('price', avgPrice);
        setIsPriceAverageOpen(false);
        toast({
            title: "Preço Preenchido!",
            description: `O preço médio calculado de ${avgPrice.toFixed(2)} foi inserido no campo.`
        });
    };

    if (!product) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-4xl flex flex-col h-auto max-h-[95vh]">
                    <DialogHeader>
                        <DialogTitle>Criar Anúncio para: {product.name}</DialogTitle>
                        <DialogDescription>
                            Preencha os detalhes abaixo para publicar este produto em uma ou mais de suas contas.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 flex-grow overflow-y-auto">
                        {/* Coluna do Formulário */}
                        <div>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField control={form.control} name="accountIds" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Publicar nas Contas</FormLabel>
                                                <MultiSelect
                                                    options={accountOptions}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Selecione as contas..."
                                                />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="price" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Preço</FormLabel>
                                                <div className="flex items-center gap-2">
                                                    <FormControl><Input type="number" placeholder="299.90" {...field} /></FormControl>
                                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsPriceAverageOpen(true)}>
                                                        <Search className="h-4 w-4" />
                                                    </Button>
                                                </div>
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
                                        <FormField control={form.control} name="condition" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Condição</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="new">Novo</SelectItem>
                                                        <SelectItem value="used">Usado</SelectItem>
                                                        <SelectItem value="not_specified">Não especificado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                    <DialogFooter className="pt-4">
                                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                                        <Button type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                                            Criar Anúncio(s)
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </div>

                        {/* Coluna do Payload e Erro */}
                        <div className="space-y-4">
                           {Object.keys(formStates).length > 0 && (
                                <Card>
                                    <CardHeader className="p-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Send /> Resultados da Publicação
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="p-4 bg-muted rounded-b-md overflow-x-auto text-xs max-h-80 space-y-2">
                                            {Object.entries(formStates).map(([accountId, state]) => {
                                                const accountName = accounts.find(a => a.id === accountId)?.accountName || accountId;
                                                return (
                                                    <div key={accountId}>
                                                        <h4 className="font-semibold">{accountName}: {state.success ? 'Sucesso' : 'Falha'}</h4>
                                                        <pre className="mt-1 w-full rounded-md bg-slate-950 p-2 overflow-x-auto">
                                                            <code className="text-white text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                                {state.result ? JSON.stringify(state.result, null, 2) : state.error}
                                                            </code>
                                                        </pre>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <PriceAverageDialog 
                isOpen={isPriceAverageOpen}
                onClose={() => setIsPriceAverageOpen(false)}
                productName={product.name}
                productSku={product.model || ''} // Usar o modelo como SKU de busca
                onPriceCalculated={handlePriceCalculated}
            />
        </>
    );
}

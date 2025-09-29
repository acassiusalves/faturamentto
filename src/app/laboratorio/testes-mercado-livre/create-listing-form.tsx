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
import { Loader2, PlusCircle, Database, AlertTriangle } from 'lucide-react';
import { useFormState } from 'react-dom';
import { createCatalogListingAction } from '@/app/actions';
import type { MlAccount, ProductResult, CreateListingResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const listingSchema = z.object({
    catalogProductId: z.string().min(10, 'O ID do produto de catálogo é obrigatório (ex: MLB12345678).'),
    price: z.coerce.number().positive('O preço deve ser maior que zero.'),
    quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
    listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.'}),
    accountId: z.string().min(1, 'Selecione a conta para publicar.'),
    buying_mode: z.enum(['buy_it_now'], { required_error: 'O modo de compra é obrigatório.' }).default('buy_it_now'),
    condition: z.enum(['new', 'used', 'not_specified'], { required_error: 'Selecione a condição.' }).default('new'),
});

type ListingFormValues = z.infer<typeof listingSchema>;

interface CreateListingFormProps {
  accounts: MlAccount[];
}

const initialFormState: CreateListingResult = { success: false, error: null, result: null };

export function CreateListingForm({ accounts }: CreateListingFormProps) {
    const { toast } = useToast();
    const [formState, formAction] = useFormState(createCatalogListingAction, initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: '',
            price: undefined,
            quantity: 1,
            buying_mode: 'buy_it_now',
            condition: 'new',
        }
    });

    const onSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('catalog_product_id', data.catalogProductId);
        formData.append('price', String(data.price));
        formData.append('available_quantity', String(data.quantity));
        formData.append('listing_type_id', data.listingTypeId);
        formData.append('accountId', data.accountId);
        formData.append('buying_mode', data.buying_mode);
        formData.append('condition', data.condition);
        
        await formAction(formData);
        setIsSubmitting(false);
    }
    
    useEffect(() => {
        if (formState.success && formState.result) {
            toast({ title: 'Anúncio Criado com Sucesso!', description: `ID do novo anúncio: ${formState.result.id}` });
            form.reset();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formState]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
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
                                                    <SelectItem key={acc.id} value={acc.accountName || acc.id}>{acc.accountName || acc.id}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Database/> Resposta da API</CardTitle>
                    <CardDescription>A resposta da API do Mercado Livre aparecerá aqui após a tentativa de criação.</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs min-h-[300px]">
                        {formState.result ? JSON.stringify(formState.result, null, 2) 
                        : 'Aguardando envio...'}
                    </pre>
                     {formState.error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Erro ao Criar Anúncio</AlertTitle>
                            <AlertDescription className="max-h-48 overflow-y-auto">
                                <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                                    <code className="text-white text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {formState.result ? JSON.stringify(formState.result, null, 2) : formState.error}
                                    </code>
                                </pre>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Dialog Wrapper
interface CreateListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductResult;
  accounts: MlAccount[];
}

export function CreateListingDialog({ isOpen, onClose, product, accounts }: CreateListingDialogProps) {
    const { toast } = useToast();
    const [formState, formAction] = useFormState(createCatalogListingAction, initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: product?.catalog_product_id || '',
            price: product?.price || undefined,
            quantity: 1,
            listingTypeId: (product?.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
            buying_mode: 'buy_it_now',
            condition: 'new',
            accountId: '',
        }
    });

    useEffect(() => {
        if (product) {
            form.reset({
                catalogProductId: product.catalog_product_id || '',
                price: product.price || undefined,
                quantity: 1,
                listingTypeId: (product.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                accountId: '',
                buying_mode: 'buy_it_now',
                condition: 'new',
            });
        }
    }, [product, form]);

    const onSubmit = (data: ListingFormValues) => {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('catalog_product_id', data.catalogProductId);
        formData.append('price', String(data.price));
        formData.append('available_quantity', String(data.quantity));
        formData.append('listing_type_id', data.listingTypeId);
        formData.append('accountId', data.accountId);
        formData.append('buying_mode', data.buying_mode);
        formData.append('condition', data.condition);
        
        formAction(formData); 
    };
    
    useEffect(() => {
        if (!formState.success && !formState.error) return; // Ignore initial state

        if (formState.success && formState.result) {
            toast({ title: 'Anúncio Criado com Sucesso!', description: `ID do novo anúncio: ${formState.result.id}` });
            form.reset();
            onClose();
        }
        
        // Always stop submitting spinner after action is done
        setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formState]);


    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Criar Anúncio para: {product.name}</DialogTitle>
                    <DialogDescription>
                        Preencha os detalhes abaixo para publicar este produto em uma de suas contas.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="accountId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Publicar na Conta</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {accounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.accountName || acc.id}>{acc.accountName || acc.id}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                        <DialogFooter className="flex-col-reverse sm:flex-col-reverse sm:space-x-0 items-stretch gap-2">
                             <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                                    Criar Anúncio
                                </Button>
                             </div>
                             {formState.error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Erro ao Criar Anúncio</AlertTitle>
                                    <AlertDescription className="max-h-48 overflow-y-auto">
                                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                                            <code className="text-white text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                            {formState.result ? JSON.stringify(formState.result, null, 2) : formState.error}
                                            </code>
                                        </pre>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

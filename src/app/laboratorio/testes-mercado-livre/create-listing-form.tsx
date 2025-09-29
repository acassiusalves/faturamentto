// src/app/laboratorio/testes-mercado-livre/create-listing-form.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Database, AlertTriangle, Send, Search, Check, Info, ClipboardCopy } from 'lucide-react';
import { createCatalogListingAction, fetchAllProductsFromFeedAction } from '@/app/actions';
import type { MlAccount, ProductResult, CreateListingPayload, CreateListingResult, FeedEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';


const listingSchema = z.object({
    catalogProductId: z.string().min(10, 'O ID do produto de catálogo é obrigatório (ex: MLB12345678).'),
    title: z.string().optional(),
    sellerSku: z.string().min(1, 'É obrigatório selecionar um produto para obter o SKU.'),
    price: z.coerce.number().positive('O preço deve ser maior que zero.'),
    quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
    listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.'}),
    accountIds: z.array(z.string()).min(1, 'Selecione pelo menos uma conta para publicar.'),
    condition: z.enum(['new', 'used', 'not_specified'], { required_error: 'Selecione a condição.' }).default('new'),
});

type ListingFormValues = z.infer<typeof listingSchema>;

const initialFormState: CreateListingResult = { success: false, error: null, result: null, payload: undefined };

type FeedProduct = FeedEntry['products'][0];


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
    
    const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductInfo, setSelectedProductInfo] = useState<{name: string, sku: string} | null>(null);

    const [allFeedProducts, setAllFeedProducts] = useState<FeedProduct[]>([]);
    const [isFetchingFeedProducts, setIsFetchingFeedProducts] = useState(true);

    const accountOptions = React.useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.accountName || acc.id })), [accounts]);

    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: '',
            title: '',
            sellerSku: '',
            price: undefined,
            quantity: 1,
            listingTypeId: 'gold_special',
            accountIds: [],
            condition: 'new',
        }
    });

    useEffect(() => {
        if (isOpen) {
          const fetchAllProducts = async () => {
            setIsFetchingFeedProducts(true);
            const result = await fetchAllProductsFromFeedAction();
            if (result.products) {
              setAllFeedProducts(result.products);
            }
            setIsFetchingFeedProducts(false);
          }
          fetchAllProducts();
        }
    }, [isOpen]);

    const filteredFeedProducts = React.useMemo(() => {
        if (!searchTerm) return allFeedProducts;
        const lowerSearch = searchTerm.toLowerCase();
        return allFeedProducts.filter(p => 
            p.name?.toLowerCase().includes(lowerSearch) || 
            p.sku?.toLowerCase().includes(lowerSearch)
        );
    }, [allFeedProducts, searchTerm]);

    useEffect(() => {
        if (product) {
            form.reset({
                catalogProductId: product.catalog_product_id || '',
                title: product.name || '',
                sellerSku: '',
                price: product?.price ? parseFloat((product.price * 1.35).toFixed(2)) : undefined,
                quantity: 1,
                listingTypeId: (product.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                accountIds: [],
                condition: 'new',
            });
            setSelectedProductInfo(null);
            setSearchTerm('');
        }
    }, [product, form]);
    
    useEffect(() => {
      if (!isOpen) {
        form.reset();
        setFormStates({});
        setSelectedProductInfo(null);
        setSearchTerm('');
      }
    }, [isOpen, form]);

    const handleProductSelect = (productToSelect: FeedProduct) => {
        form.setValue('sellerSku', productToSelect.sku, { shouldValidate: true });
        setSelectedProductInfo({ name: productToSelect.name, sku: productToSelect.sku });
        setIsSearchPopoverOpen(false);
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copiado!',
            description: 'O conteúdo JSON foi copiado para a área de transferência.',
        });
    };

    const onSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        setFormStates({}); 

        const results: Record<string, CreateListingResult> = {};
        
        for (const accountId of data.accountIds) {
            const formData = new FormData();
            formData.append('catalog_product_id', data.catalogProductId);
            formData.append('sellerSku', data.sellerSku);
            formData.append('price', String(data.price));
            formData.append('available_quantity', String(data.quantity));
            formData.append('listing_type_id', data.listingTypeId);
            formData.append('accountId', accountId);
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
        if (errorCount === 0 && isOpen) { // Only close if all successful
            onClose();
        }
    };
    
    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl flex flex-col h-auto max-h-[95vh]">
                <DialogHeader>
                    <DialogTitle>Criar Anúncio para: {product.name}</DialogTitle>
                    <DialogDescription>
                        Preencha os detalhes abaixo para publicar este produto em uma ou mais de suas contas.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 flex-grow overflow-y-auto">
                    <div>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="accountIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Publicar nas Contas</FormLabel>
                                            <FormControl>
                                                <div className="space-y-2 rounded-md border p-2">
                                                    {accountOptions.map(option => {
                                                        // Verifica se já existe um anúncio para esta conta e tipo de anúncio
                                                        const isAlreadyPosted = product.postedOnAccounts?.some(
                                                            p => p.accountId === option.value && p.listingTypeId === form.watch('listingTypeId')
                                                        );
                                                        
                                                        return (
                                                            <div key={option.value} className={cn("flex items-center space-x-3 space-y-0 p-2 rounded-md", isAlreadyPosted && "opacity-50 cursor-not-allowed")}>
                                                                <Checkbox
                                                                    id={`account-${option.value}`}
                                                                    checked={field.value?.includes(option.value)}
                                                                    disabled={isAlreadyPosted}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...field.value, option.value])
                                                                            : field.onChange(field.value?.filter((value) => value !== option.value));
                                                                    }}
                                                                />
                                                                <Label htmlFor={`account-${option.value}`} className={cn("font-normal", isAlreadyPosted && "cursor-not-allowed")}>
                                                                    {option.label} {isAlreadyPosted && <span className="text-destructive text-xs">(Já postado como {form.watch('listingTypeId') === 'gold_pro' ? 'Premium' : 'Clássico'})</span>}
                                                                </Label>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField control={form.control} name="sellerSku" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Produto (para SKU)</FormLabel>
                                        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                                    >
                                                        <span className="truncate">{selectedProductInfo ? selectedProductInfo.name : "Buscar produto no Feed..."}</span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                 <Command filter={(value, search) => {
                                                    const [name, sku] = value.split('|');
                                                    if (name.toLowerCase().includes(search.toLowerCase())) return 1;
                                                    if (sku.toLowerCase().includes(search.toLowerCase())) return 1;
                                                    return 0;
                                                 }}>
                                                    <CommandInput
                                                        placeholder="Buscar por nome ou SKU..."
                                                        disabled={isFetchingFeedProducts}
                                                    />
                                                    <CommandList>
                                                        {isFetchingFeedProducts ? (
                                                            <div className="p-2 text-center text-sm text-muted-foreground"> <Loader2 className="mx-auto animate-spin" /> </div>
                                                        ) : (
                                                            <>
                                                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {allFeedProducts.map((p, index) => (
                                                                        <CommandItem
                                                                            key={`${p.sku}-${index}`}
                                                                            value={`${p.name}|${p.sku}`}
                                                                            onSelect={() => handleProductSelect(p)}
                                                                        >
                                                                             <Check className={cn("mr-2 h-4 w-4", selectedProductInfo?.sku === p.sku ? "opacity-100" : "opacity-0")} />
                                                                              <div className="flex flex-col text-left">
                                                                                <span className="font-semibold">{p.name}</span>
                                                                                <span className="text-xs text-muted-foreground">{p.sku}</span>
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </>
                                                        )}
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="price" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Preço de Venda</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="299.90" {...field} />
                                            </FormControl>
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

                   <div className="space-y-4">
                       {Object.keys(formStates).length > 0 && (
                            <Card>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Send /> Resultados da Publicação
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="bg-muted rounded-b-md text-xs max-h-80">
                                        <div className="p-4 space-y-4">
                                            {Object.entries(formStates).map(([accountId, state]) => {
                                                const accountName = accounts.find(a => a.id === accountId)?.accountName || accountId;
                                                const payloadStr = JSON.stringify(state.payload, null, 2);
                                                const resultStr = JSON.stringify(state.result, null, 2);
                                                return (
                                                    <div key={accountId} className="space-y-2">
                                                        <h4 className="font-semibold">{accountName}: {state.success ? <span className="text-green-600">Sucesso</span> : <span className="text-destructive">Falha</span>}</h4>
                                                        
                                                        {state.payload && (
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <p className="text-muted-foreground font-semibold">Payload Enviado:</p>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(payloadStr)}>
                                                                        <ClipboardCopy className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                                <pre className="w-full rounded-md bg-slate-950 p-2 overflow-x-auto">
                                                                    <code className="text-white text-[11px] leading-tight" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                                        {payloadStr}
                                                                    </code>
                                                                </pre>
                                                            </div>
                                                        )}

                                                        {state.result && (
                                                             <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <p className="text-muted-foreground font-semibold">Resposta da API:</p>
                                                                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(resultStr)}>
                                                                        <ClipboardCopy className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                                <pre className="w-full rounded-md bg-slate-950 p-2 overflow-x-auto">
                                                                    <code className={cn("text-[11px] leading-tight", state.success ? "text-green-400" : "text-red-400")} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                                        {resultStr}
                                                                    </code>
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

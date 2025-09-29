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
import { Loader2, PlusCircle, Database, AlertTriangle, Send, Search, Check } from 'lucide-react';
import { createCatalogListingAction, findAveragePriceAction, fetchAllProductsFromFeedAction } from '@/app/actions';
import type { MlAccount, ProductResult, CreateListingPayload, CreateListingResult, FeedEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useFormState } from 'react-dom';


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
const initialPriceState = { averagePrice: null, product: null, error: null };

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
    const [searchState, searchAction] = useFormState(findAveragePriceAction, initialPriceState);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProductInfo, setSelectedProductInfo] = useState<{name: string, sku: string} | null>(null);

    const [allFeedProducts, setAllFeedProducts] = useState<FeedProduct[]>([]);
    const [isFetchingFeedProducts, setIsFetchingFeedProducts] = useState(true);
    
    // State to hold the calculated prices for display
    const [calculatedPrices, setCalculatedPrices] = useState<{ averageCost: number | null, finalPrice: number | null }>({ averageCost: null, finalPrice: null });

    const accountOptions = React.useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.accountName || acc.id })), [accounts]);

    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
            catalogProductId: product?.catalog_product_id || '',
            title: product?.name || '',
            sellerSku: '',
            price: product?.price || undefined,
            quantity: 1,
            listingTypeId: (product?.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
            accountIds: [],
            condition: 'new',
        }
    });
    
    useEffect(() => {
        async function fetchAllProducts() {
            setIsFetchingFeedProducts(true);
            const result = await fetchAllProductsFromFeedAction();
            if (result.products) {
                setAllFeedProducts(result.products);
            }
            setIsFetchingFeedProducts(false);
        }
        if (isOpen) {
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
                price: product.price || undefined,
                quantity: 1,
                listingTypeId: (product.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                accountIds: [],
                condition: 'new',
            });
            setSelectedProductInfo(null);
            setSearchTerm('');
            setCalculatedPrices({ averageCost: null, finalPrice: null });
        }
    }, [product, form]);
    
    useEffect(() => {
      if (!isOpen) {
        form.reset();
        setFormStates({});
        setSelectedProductInfo(null);
        setSearchTerm('');
        setCalculatedPrices({ averageCost: null, finalPrice: null });
      }
    }, [isOpen, form]);

    useEffect(() => {
        setIsSearching(false);
        if (searchState.error) {
            toast({ variant: 'destructive', title: 'Erro na Busca', description: searchState.error });
            setCalculatedPrices({ averageCost: null, finalPrice: null });
        }
        if (searchState.averagePrice !== null && searchState.product) {
            const averageCost = searchState.averagePrice;
            const finalPrice = averageCost * 1.35; // Add 35% margin

            form.setValue('price', parseFloat(finalPrice.toFixed(2)));
            form.setValue('sellerSku', searchState.product.sku, { shouldValidate: true });
            setSelectedProductInfo({ name: searchState.product.name, sku: searchState.product.sku });
            setCalculatedPrices({ averageCost, finalPrice });
            
            toast({ title: 'Produto Selecionado!', description: `SKU ${searchState.product.sku} e preço sugerido de ${formatCurrency(finalPrice)} aplicados.` });
            setIsSearchPopoverOpen(false);
        }
    }, [searchState, toast, form]);

    const handleProductSelect = (productToSelect: FeedProduct) => {
        setIsSearching(true);
        const formData = new FormData();
        formData.append('searchTerm', productToSelect.sku || productToSelect.name || '');
        searchAction(formData);
    };


    const onSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        setFormStates({}); 

        const results: Record<string, CreateListingResult> = {};
        
        for (const accountId of data.accountIds) {
            const formData = new FormData();
            formData.append('catalog_product_id', data.catalogProductId);
            formData.append('title', data.title || product.name);
            formData.append('seller_sku', data.sellerSku);
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
        if (errorCount === 0) {
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
                                <FormField control={form.control} name="accountIds" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Publicar nas Contas</FormLabel>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start">
                                                    {field.value?.length > 0 ? `${field.value.length} conta(s) selecionada(s)` : "Selecione as contas..."}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                                {accountOptions.map(option => (
                                                    <DropdownMenuCheckboxItem
                                                        key={option.value}
                                                        checked={field.value.includes(option.value)}
                                                        onCheckedChange={(checked) => {
                                                            const newValue = checked 
                                                                ? [...field.value, option.value]
                                                                : field.value.filter(v => v !== option.value);
                                                            field.onChange(newValue);
                                                        }}
                                                        onSelect={e => e.preventDefault()}
                                                    >
                                                        {option.label}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={form.control} name="sellerSku" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Produto</FormLabel>
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
                                                <Command>
                                                    <CommandInput
                                                        placeholder="Buscar por nome ou SKU..."
                                                        value={searchTerm}
                                                        onValueChange={setSearchTerm}
                                                        disabled={isFetchingFeedProducts || isSearching}
                                                    />
                                                    <CommandList>
                                                        {isFetchingFeedProducts || isSearching ? (
                                                            <div className="p-2 text-center text-sm text-muted-foreground"> <Loader2 className="mx-auto animate-spin" /> </div>
                                                        ) : (
                                                            <>
                                                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {filteredFeedProducts.map((p, index) => (
                                                                        <button
                                                                            key={`${p.sku}-${index}`}
                                                                            type="button"
                                                                            onPointerDown={(e) => e.preventDefault()}
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                            onClick={() => handleProductSelect(p)}
                                                                            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                                                        >
                                                                             <Check className={cn("mr-2 h-4 w-4", selectedProductInfo?.sku === p.sku ? "opacity-100" : "opacity-0")} />
                                                                              <div className="flex flex-col text-left">
                                                                                <span className="font-semibold">{p.name}</span>
                                                                                <span className="text-xs text-muted-foreground">{p.sku}</span>
                                                                            </div>
                                                                        </button>
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
                                            <FormLabel>Preço</FormLabel>
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
                        {isSearching ? (
                             <Card>
                                <CardContent className="p-6 flex items-center justify-center h-full">
                                    <Loader2 className="animate-spin text-primary" />
                                </CardContent>
                             </Card>
                        ) : selectedProductInfo && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Produto Selecionado</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="font-semibold">{selectedProductInfo.name}</p>
                                    <p className="text-sm text-muted-foreground">SKU: {selectedProductInfo.sku}</p>
                                    {calculatedPrices.averageCost !== null && (
                                        <div className="mt-2 text-md">
                                            <span>Custo Médio + Gordura: </span>
                                            <span className="font-bold text-muted-foreground">{formatCurrency(calculatedPrices.averageCost)}</span>
                                        </div>
                                    )}
                                     {calculatedPrices.finalPrice !== null && (
                                        <div className="mt-1 text-lg">
                                            <span>Preço de Venda Sugerido (+35%): </span>
                                            <span className="font-bold text-primary">{formatCurrency(calculatedPrices.finalPrice)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

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
                                                    {state.payload && (
                                                        <>
                                                            <p className="text-muted-foreground mt-1">Payload enviado:</p>
                                                            <pre className="mt-1 w-full rounded-md bg-slate-950 p-2 overflow-x-auto">
                                                                <code className="text-white text-xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                                                    {JSON.stringify(state.payload, null, 2)}
                                                                </code>
                                                            </pre>
                                                        </>
                                                    )}
                                                    <p className="text-muted-foreground mt-1">Resposta da API:</p>
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
    );
}

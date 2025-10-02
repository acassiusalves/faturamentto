// src/app/feed-25/buscar-mercado-livre/create-listing-form.tsx
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
import { Loader2, PlusCircle, Database, AlertTriangle, Send, Search, Check, Info, ClipboardCopy, Copy } from 'lucide-react';
import { createCatalogListingAction } from '@/app/actions';
import type { MlAccount, ProductResult, CreateListingPayload, CreateListingResult, FeedEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { loadProducts } from '@/services/firestore';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';


const listingSchema = z.object({
    title: z.string().optional(),
    sellerSku: z.string().optional(), // Tornou-se opcional
    price: z.coerce.number().positive('O preço deve ser maior que zero.'),
    quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
    listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.'}),
    accountIds: z.array(z.string()).min(1, 'Selecione pelo menos uma conta para publicar.'),
    condition: z.enum(['new', 'used', 'not_specified'], { required_error: 'Selecione a condição.' }).default('new'),
});

type ListingFormValues = z.infer<typeof listingSchema>;

const initialFormState: CreateListingResult = { success: false, error: null, result: null, payload: undefined };

type FeedProduct = Product;

interface ListingResult {
    productName: string;
    accountId: string;
    accountName: string;
    status: 'success' | 'error';
    message: string;
    payload?: any;
    response?: any;
}


// Dialog Wrapper
interface CreateListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductResult[];
  accounts: MlAccount[];
}

export function CreateListingDialog({ isOpen, onClose, products, accounts }: CreateListingDialogProps) {
    const { toast } = useToast();
    const [listingResults, setListingResults] = useState<ListingResult[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductInfo, setSelectedProductInfo] = useState<{name: string, sku: string} | null>(null);

    const [allFeedProducts, setAllFeedProducts] = useState<FeedProduct[]>([]);
    const [isFetchingFeedProducts, setIsFetchingFeedProducts] = useState(true);

    const searchInputRef = React.useRef<HTMLInputElement>(null);
    
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<ListingFormValues | null>(null);
    
    // Bulk creation state
    const [progress, setProgress] = useState(0);
    const [currentTask, setCurrentTask] = useState('');

    useEffect(() => {
      if (isSearchPopoverOpen) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }, [isSearchPopoverOpen]);

    const accountOptions = React.useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.accountName || acc.id })), [accounts]);

    const form = useForm<ListingFormValues>({
        resolver: zodResolver(listingSchema),
        defaultValues: {
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
            const products = await loadProducts();
            if (products) {
              setAllFeedProducts(products);
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

    const isBulkMode = products.length > 1;
    const firstProduct = products[0];

    useEffect(() => {
        if (products.length > 0) {
            form.reset({
                title: isBulkMode ? '' : firstProduct.name || '',
                sellerSku: '',
                price: isBulkMode ? undefined : (firstProduct?.price ? parseFloat((firstProduct.price * 1.35).toFixed(2)) : undefined),
                quantity: 1,
                listingTypeId: (firstProduct.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                accountIds: [],
                condition: 'new',
            });
            setSelectedProductInfo(null);
            setSearchTerm('');
        }
    }, [products, form, isBulkMode, firstProduct]);
    
    useEffect(() => {
      if (!isOpen) {
        form.reset();
        setListingResults([]);
        setSelectedProductInfo(null);
        setSearchTerm('');
        setProgress(0);
        setCurrentTask('');
      }
    }, [isOpen, form]);

    const handleProductSelect = (productToSelect: FeedProduct) => {
        form.setValue('sellerSku', productToSelect.sku, { shouldValidate: true });
        setSelectedProductInfo({ name: productToSelect.name, sku: productToSelect.sku });
        setIsSearchPopoverOpen(false);
        setSearchTerm('');
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copiado!',
            description: 'O conteúdo JSON foi copiado para a área de transferência.',
        });
    };
    
    const proceedWithSubmit = async (data: ListingFormValues) => {
        setIsSubmitting(true);
        setListingResults([]);
        setProgress(0);

        const totalOperations = products.length * data.accountIds.length;
        let completedOperations = 0;
        
        for (const product of products) {
            for (const accountId of data.accountIds) {
                const account = accounts.find(a => a.id === accountId);
                if(!account) continue;
                
                completedOperations++;
                setCurrentTask(`Criando "${product.name}" na conta "${account.accountName || account.id}"...`);

                const formData = new FormData();
                formData.append('catalog_product_id', product.catalog_product_id);
                formData.append('sellerSku', data.sellerSku || (isBulkMode ? '' : product.attributes.find(a => a.id === 'SELLER_SKU')?.value_name || '') );
                formData.append('price', String(isBulkMode ? data.price : (data.price || product.price)));
                formData.append('available_quantity', String(data.quantity));
                formData.append('listing_type_id', data.listingTypeId);
                formData.append('accountId', accountId);
                formData.append('condition', data.condition);
                formData.append('category_id', product.category_id);
                if (!isBulkMode) formData.append('title', data.title || product.name);
                
                const result = await createCatalogListingAction(initialFormState, formData);

                setListingResults(prev => [...prev, {
                    productName: product.name,
                    accountId: accountId,
                    accountName: account.accountName || accountId,
                    status: result.success ? 'success' : 'error',
                    message: result.error || 'Criado com sucesso!',
                    payload: result.payload,
                    response: result.result
                }]);
                
                setProgress((completedOperations / totalOperations) * 100);
            }
        }
        
        setIsSubmitting(false);
        setCurrentTask('Concluído!');

        const successCount = listingResults.filter(r => r.status === 'success').length;
        const errorCount = totalOperations - successCount;

        if (successCount > 0) {
            toast({ title: 'Criação Concluída!', description: `${successCount} anúncio(s) criado(s) com sucesso.` });
        }
        if (errorCount > 0) {
             toast({ variant: 'destructive', title: 'Falhas na Criação', description: `${errorCount} anúncio(s) falharam.` });
        }
    };


    const onSubmit = async (data: ListingFormValues) => {
        if (!isBulkMode && !data.sellerSku) {
            setPendingFormData(data);
            setIsAlertOpen(true);
        } else {
            await proceedWithSubmit(data);
        }
    };
    
    if (products.length === 0) return null;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl flex flex-col h-auto max-h-[95vh]">
                <DialogHeader>
                    <DialogTitle>
                         {isBulkMode ? `Criar ${products.length} Anúncios` : `Criar Anúncio para: ${firstProduct.name}`}
                    </DialogTitle>
                    <DialogDescription>
                        Preencha os detalhes abaixo para publicar este(s) produto(s) em uma ou mais de suas contas.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 flex-grow overflow-y-auto">
                    <div>
                        <Form {...form}>
                            <form id="create-listing-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                 <FormField
                                    control={form.control}
                                    name="accountIds"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Publicar nas Contas</FormLabel>
                                            <FormControl>
                                                <div className="space-y-2 rounded-md border p-2 max-h-40 overflow-y-auto">
                                                    {accountOptions.map(option => {
                                                        const isAlreadyPosted = !isBulkMode && firstProduct.postedOnAccounts?.some(
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
                                
                                {!isBulkMode && (
                                    <FormField control={form.control} name="sellerSku" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Produto (para SKU)</FormLabel>
                                            <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    type="button"
                                                    aria-expanded={isSearchPopoverOpen}
                                                    className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                                >
                                                    <span className="truncate">
                                                    {selectedProductInfo ? selectedProductInfo.name : "Buscar produto no Banco de Dados..."}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                    
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={4}>
                                                <div className="flex flex-col">
                                                <div className="border-b p-2">
                                                    <Input
                                                    ref={searchInputRef}
                                                    placeholder="Buscar por nome ou SKU..."
                                                    disabled={isFetchingFeedProducts}
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="h-9"
                                                    />
                                                </div>
                                                
                                                <div className="max-h-[300px] overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                                                    {isFetchingFeedProducts ? (
                                                    <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
                                                    ) : filteredFeedProducts.length === 0 ? (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
                                                    ) : (
                                                    <div className="p-1">
                                                        {filteredFeedProducts.map((p, index) => (
                                                        <div
                                                            key={`${p.sku}-${index}`}
                                                            onClick={() => handleProductSelect(p)}
                                                            className={cn("flex items-start gap-2 rounded-sm px-2 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors", selectedProductInfo?.sku === p.sku && "bg-accent")}
                                                        >
                                                            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", selectedProductInfo?.sku === p.sku ? "opacity-100" : "opacity-0")} />
                                                            <div className="flex flex-col text-left flex-1 min-w-0">
                                                            <span className="font-semibold text-sm truncate">{p.name}</span>
                                                            <span className="text-xs text-muted-foreground">{p.sku}</span>
                                                            </div>
                                                        </div>
                                                        ))}
                                                    </div>
                                                    )}
                                                </div>
                                                </div>
                                            </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}

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
                            </form>
                        </Form>
                    </div>

                   <div className="space-y-4">
                       {isBulkMode && products.length > 0 && (
                            <Card>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Copy /> Produtos Selecionados
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-48">
                                        <div className="p-4 space-y-3">
                                            {products.map(p => (
                                                <div key={p.id} className="flex items-center gap-2 text-sm p-2 border rounded-md">
                                                    <div className="relative h-10 w-10 bg-muted rounded-sm overflow-hidden flex-shrink-0">
                                                        <Image src={p.thumbnail} alt={p.name} fill className="object-contain"/>
                                                    </div>
                                                    <p className="flex-1 truncate">{p.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                       )}
                       {listingResults.length > 0 && (
                            <Card>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Send /> Resultados da Publicação
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="bg-muted rounded-b-md text-xs max-h-80">
                                        <div className="p-4 space-y-4">
                                            {isSubmitting && (
                                                <div className="space-y-2">
                                                    <Progress value={progress} />
                                                    <p className="text-center text-xs text-muted-foreground">{currentTask}</p>
                                                </div>
                                            )}
                                            {listingResults.map((res, index) => (
                                                <div key={index} className="space-y-2 p-2 border-l-4 rounded-r-md" style={{ borderColor: res.status === 'success' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
                                                    <h4 className="font-semibold">{res.productName} ({res.accountName}): {res.status === 'success' ? <span className="text-green-600">Sucesso</span> : <span className="text-destructive">Falha</span>}</h4>
                                                    <p className="text-muted-foreground text-[11px]">{res.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" form="create-listing-form" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                        Criar Anúncio(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" />
                        Criar anúncio sem SKU?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Você não selecionou um produto do seu banco de dados. O anúncio será criado no Mercado Livre, mas não terá um SKU associado no sistema. Deseja continuar?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                        if (pendingFormData) {
                            await proceedWithSubmit(pendingFormData);
                            setPendingFormData(null);
                        }
                    }}>
                        Sim, criar sem SKU
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
     </>
    );
}


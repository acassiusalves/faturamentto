// src/app/feed-25/buscar-mercado-livre/create-listing-form.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Database, AlertTriangle, Send, Search, Check, Info, ClipboardCopy, Copy, XCircle } from 'lucide-react';
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


const singleListingSchema = z.object({
  productResultId: z.string(),
  name: z.string(),
  sellerSku: z.string().optional(),
  price: z.coerce.number().positive('O preço deve ser maior que zero.'),
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser de pelo menos 1.'),
  listingTypeId: z.enum(['gold_special', 'gold_pro'], { required_error: 'Selecione o tipo de anúncio.' }),
  condition: z.enum(['new', 'used', 'not_specified'], { required_error: 'Selecione a condição.' }).default('new'),
  accountIds: z.array(z.string()).min(1, 'Selecione pelo menos uma conta para publicar.'),
});

const bulkListingSchema = z.object({
    listings: z.array(singleListingSchema)
});

type BulkListingFormValues = z.infer<typeof bulkListingSchema>;
type SingleListingFormValues = z.infer<typeof singleListingSchema>;

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

// Sub-component for each row in the bulk form
function ListingRow({ index, control, remove, accounts, product, allFeedProducts }: {
    index: number;
    control: any;
    remove: (index: number) => void;
    accounts: MlAccount[];
    product: ProductResult;
    allFeedProducts: FeedProduct[];
}) {
    const { toast } = useToast();
    const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const filteredFeedProducts = React.useMemo(() => {
        if (!searchTerm) return allFeedProducts;
        const lowerSearch = searchTerm.toLowerCase();
        return allFeedProducts.filter(p =>
            p.name?.toLowerCase().includes(lowerSearch) ||
            p.sku?.toLowerCase().includes(lowerSearch)
        );
    }, [allFeedProducts, searchTerm]);

    const handleProductSelect = (productToSelect: FeedProduct) => {
        control.setValue(`listings.${index}.sellerSku`, productToSelect.sku, { shouldValidate: true });
        setIsSearchPopoverOpen(false);
        setSearchTerm('');
    };
    
    return (
        <Card className="p-4 space-y-4">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                     <div className="relative h-16 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        <Image src={product.thumbnail} alt={product.name} fill className="object-contain" data-ai-hint="product image"/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" title={product.name}>{product.name}</p>
                        <p className="text-xs text-muted-foreground">ID do Catálogo: {product.catalog_product_id}</p>
                    </div>
                </div>
                 <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                    <XCircle className="h-5 w-5 text-destructive" />
                </Button>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                {/* Produto (para SKU) */}
                 <FormField
                    control={control}
                    name={`listings.${index}.sellerSku`}
                    render={({ field }) => (
                         <FormItem className="w-full">
                            <FormLabel>Produto (para SKU)</FormLabel>
                            <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}>
                                            <span className="truncate">
                                                {field.value ? (allFeedProducts.find(p => p.sku === field.value)?.name || field.value) : "Buscar produto..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={4}>
                                    <div className="flex flex-col">
                                        <div className="border-b p-2">
                                            <Input ref={searchInputRef} placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9"/>
                                        </div>
                                        <ScrollArea className="max-h-60" onWheel={e => e.stopPropagation()}>
                                            <div className="p-1">
                                                {filteredFeedProducts.map(p => (
                                                    <div key={p.id} onClick={() => handleProductSelect(p)} className="flex items-start gap-2 p-2 rounded-sm cursor-pointer hover:bg-accent">
                                                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", field.value === p.sku ? "opacity-100" : "opacity-0")} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm truncate">{p.name}</p>
                                                            <p className="text-xs text-muted-foreground">{p.sku}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                 />

                {/* Preço de Venda */}
                <FormField control={control} name={`listings.${index}.price`} render={({ field }) => (
                    <FormItem><FormLabel>Preço de Venda</FormLabel><FormControl><Input type="number" placeholder="299.90" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                {/* Estoque */}
                 <FormField control={control} name={`listings.${index}.quantity`} render={({ field }) => (
                    <FormItem><FormLabel>Estoque</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                {/* Tipo de Anúncio */}
                <FormField control={control} name={`listings.${index}.listingTypeId`} render={({ field }) => (
                    <FormItem><FormLabel>Tipo de Anúncio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="gold_special">Clássico</SelectItem><SelectItem value="gold_pro">Premium</SelectItem></SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )} />
                
                 {/* Condição */}
                <FormField control={control} name={`listings.${index}.condition`} render={({ field }) => (
                    <FormItem><FormLabel>Condição</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="new">Novo</SelectItem><SelectItem value="used">Usado</SelectItem><SelectItem value="not_specified">Não especificado</SelectItem></SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )} />

             </div>
             {/* Contas */}
            <FormField
                control={control}
                name={`listings.${index}.accountIds`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Publicar nas Contas</FormLabel>
                        <FormControl>
                            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-2">
                                {accounts.map(account => {
                                    const isAlreadyPosted = product.postedOnAccounts?.some(
                                        p => p.accountId === account.id && p.listingTypeId === control.getValues(`listings.${index}.listingTypeId`)
                                    );
                                    return (
                                        <div key={account.id} className={cn("flex items-center space-x-2", isAlreadyPosted && "opacity-50 cursor-not-allowed")}>
                                            <Checkbox
                                                id={`account-${product.id}-${account.id}`}
                                                checked={field.value?.includes(account.id)}
                                                disabled={isAlreadyPosted}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([...field.value, account.id])
                                                        : field.onChange(field.value?.filter(value => value !== account.id));
                                                }}
                                            />
                                            <Label htmlFor={`account-${product.id}-${account.id}`} className={cn("font-normal", isAlreadyPosted && "cursor-not-allowed")}>
                                                {account.accountName || account.id}
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
        </Card>
    );
}


export function CreateListingDialog({ isOpen, onClose, products, accounts }: CreateListingDialogProps) {
    const { toast } = useToast();
    const [listingResults, setListingResults] = useState<ListingResult[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [allFeedProducts, setAllFeedProducts] = useState<FeedProduct[]>([]);
    const [isFetchingFeedProducts, setIsFetchingFeedProducts] = useState(true);

    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<BulkListingFormValues | null>(null);
    
    // Bulk creation state
    const [progress, setProgress] = useState(0);
    const [currentTask, setCurrentTask] = useState('');

    const accountOptions = React.useMemo(() => accounts.map(acc => ({ value: acc.id, label: acc.accountName || acc.id })), [accounts]);

    const form = useForm<BulkListingFormValues>({
        resolver: zodResolver(bulkListingSchema),
        defaultValues: {
            listings: []
        }
    });
    
    const { control, handleSubmit, formState: { errors } } = form;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "listings"
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

          form.reset({
              listings: products.map(p => ({
                  productResultId: p.id,
                  name: p.name,
                  sellerSku: '',
                  price: p?.price ? parseFloat((p.price * 1.35).toFixed(2)) : 0,
                  quantity: 10,
                  listingTypeId: (p.listing_type_id as 'gold_special' | 'gold_pro') || 'gold_special',
                  condition: 'new',
                  accountIds: [],
              }))
          });
          setListingResults([]);
          setProgress(0);
          setCurrentTask('');

        }
    }, [isOpen, products, form]);
    
    
    const proceedWithSubmit = async (data: BulkListingFormValues) => {
        setIsSubmitting(true);
        setListingResults([]);
        setProgress(0);
        
        const operations: { listing: SingleListingFormValues; accountId: string; accountName: string }[] = [];
        data.listings.forEach(listing => {
            listing.accountIds.forEach(accountId => {
                const account = accounts.find(a => a.id === accountId);
                if (account) {
                    operations.push({ listing, accountId, accountName: account.accountName || accountId });
                }
            });
        });

        const totalOperations = operations.length;
        let completedOperations = 0;
        
        for (const op of operations) {
            const { listing, accountId, accountName } = op;
            const product = products.find(p => p.id === listing.productResultId);
            if(!product) continue;
            
            completedOperations++;
            setCurrentTask(`Criando "${listing.name}" na conta "${accountName}"...`);

            const formData = new FormData();
            formData.append('catalog_product_id', product.catalog_product_id);
            formData.append('sellerSku', listing.sellerSku || '');
            formData.append('price', String(listing.price));
            formData.append('available_quantity', String(listing.quantity));
            formData.append('listing_type_id', listing.listingTypeId);
            formData.append('accountId', accountId);
            formData.append('condition', listing.condition);
            formData.append('category_id', product.category_id);
            formData.append('title', listing.name);
            
            const result = await createCatalogListingAction(initialFormState, formData);

            setListingResults(prev => [...prev, {
                productName: listing.name,
                accountId: accountId,
                accountName: accountName,
                status: result.success ? 'success' : 'error',
                message: result.error || 'Criado com sucesso!',
                payload: result.payload,
                response: result.result
            }]);
            
            setProgress((completedOperations / totalOperations) * 100);
        }
        
        setIsSubmitting(false);
        setCurrentTask('Concluído!');
        
        const successCount = operations.length - listingResults.filter(r => r.status === 'error').length;
        const errorCount = listingResults.filter(r => r.status === 'error').length;

        if (successCount > 0) {
            toast({ title: 'Criação Concluída!', description: `${successCount} anúncio(s) criado(s) com sucesso.` });
        }
        if (errorCount > 0) {
             toast({ variant: 'destructive', title: 'Falhas na Criação', description: `${errorCount} anúncio(s) falharam.` });
        }
    };


    const onSubmit = async (data: BulkListingFormValues) => {
        const hasEmptySku = data.listings.some(l => !l.sellerSku);
        if (hasEmptySku) {
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
            <DialogContent className="max-w-6xl flex flex-col h-[95vh]">
                <DialogHeader>
                    <DialogTitle>
                         Criar {products.length} Anúncio(s) em Lote
                    </DialogTitle>
                    <DialogDescription>
                        Configure os detalhes para cada produto selecionado abaixo.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden">
                    <Form {...form}>
                        <form id="create-listing-form" onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
                           <ScrollArea className="flex-grow pr-4">
                            <div className="space-y-6">
                                {fields.map((field, index) => (
                                    <ListingRow
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        remove={remove}
                                        accounts={accounts}
                                        product={products.find(p => p.id === form.getValues(`listings.${index}.productResultId`))!}
                                        allFeedProducts={allFeedProducts}
                                    />
                                ))}
                            </div>
                           </ScrollArea>
                            {isSubmitting && (
                                <div className="mt-4 space-y-2">
                                    <Progress value={progress} />
                                    <p className="text-center text-xs text-muted-foreground">{currentTask}</p>
                                </div>
                            )}

                           {listingResults.length > 0 && (
                                <Card className="mt-4">
                                    <CardHeader className="p-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Send /> Resultados da Publicação
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="bg-muted rounded-b-md text-xs max-h-48">
                                            <div className="p-4 space-y-4">
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
                        </form>
                    </Form>
                </div>
                <DialogFooter className="pt-4 border-t">
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
                        Criar anúncio(s) sem SKU?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Um ou mais produtos não foram associados a um SKU do seu banco de dados. O(s) anúncio(s) será(ão) criado(s) no Mercado Livre, mas não terão um SKU interno no sistema. Deseja continuar?
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

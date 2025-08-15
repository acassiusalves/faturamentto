
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, PackageCheck, FileText, CheckCircle, XCircle, ChevronsUpDown, Check } from 'lucide-react';
import type { PickedItemLog, ProductCategorySettings, ReturnLog, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { findPickLogBySN, loadProductSettings, saveReturnLog, loadTodaysReturnLogs, loadProducts, revertReturnAction } from '@/services/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const returnSchema = z.object({
  serialNumber: z.string().min(1, "O SN do produto é obrigatório."),
  productId: z.string().min(1, "É obrigatório selecionar um produto."),
  productName: z.string().min(1, "O nome do produto é obrigatório."),
  sku: z.string().min(1, "O SKU do produto é obrigatório."),
  orderNumber: z.string().optional(),
  condition: z.string().min(1, "A condição do item é obrigatória."),
  notes: z.string().optional(),
});

type ReturnFormValues = z.infer<typeof returnSchema>;

export function ReturnsForm() {
    const { toast } = useToast();
    const [scannedSn, setScannedSn] = useState("");
    const [isLoadingSn, setIsLoadingSn] = useState(false);
    const [foundLog, setFoundLog] = useState<PickedItemLog | null>(null);
    const [todaysReturns, setTodaysReturns] = useState<ReturnLog[]>([]);
    const [isLoadingReturns, setIsLoadingReturns] = useState(true);
    const [productSettings, setProductSettings] = useState<ProductCategorySettings | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

    const snInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const form = useForm<ReturnFormValues>({
        resolver: zodResolver(returnSchema),
        defaultValues: {
            serialNumber: "",
            productId: "",
            productName: "",
            sku: "",
            orderNumber: "",
            condition: "",
            notes: "",
        },
    });
    
    const { handleSubmit, setValue, reset, formState: { isSubmitting } } = form;

     const fetchTodaysReturns = useCallback(async () => {
        setIsLoadingReturns(true);
        const logs = await loadTodaysReturnLogs();
        setTodaysReturns(logs);
        setIsLoadingReturns(false);
    }, []);

    useEffect(() => {
        async function fetchInitialData() {
            const [settings, loadedProducts] = await Promise.all([
                loadProductSettings('celular'),
                loadProducts()
            ]);
            setProductSettings(settings);
            setProducts(loadedProducts);
            await fetchTodaysReturns();
        }
        fetchInitialData();
    }, [fetchTodaysReturns]);


    const handleSearchSN = useCallback(async (sn: string) => {
        if (!sn) return;
        setIsLoadingSn(true);
        setFoundLog(null);
        reset({ 
            serialNumber: sn,
            productId: "",
            productName: "",
            sku: "",
            orderNumber: "",
            notes: "",
            condition: "" 
        });

        try {
            const log = await findPickLogBySN(sn);
            if (log) {
                setFoundLog(log);
                const parentProduct = products.find(p => p.sku === log.sku);
                setValue("productId", parentProduct?.id || "");
                setValue("productName", log.name);
                setValue("sku", log.sku);
                setValue("orderNumber", log.orderNumber);
                toast({ title: "Registro Encontrado!", description: "Dados do pedido e produto preenchidos." });
            } else {
                toast({ variant: 'destructive', title: "Nenhum Registro de Saída Encontrado", description: "Este SN não foi encontrado no histórico de picking. Preencha os dados manualmente." });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro ao Buscar SN" });
        } finally {
            setIsLoadingSn(false);
        }
    }, [reset, setValue, toast, products]);


    const handleSnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setScannedSn(value);

        if (snInputTimeoutRef.current) {
            clearTimeout(snInputTimeoutRef.current);
        }

        snInputTimeoutRef.current = setTimeout(() => {
            if (value.trim()) {
                handleSearchSN(value.trim());
            }
        }, 800); // 800ms delay for auto-search
    };
    
    const handleProductSelectionChange = (productId: string) => {
        const selectedProduct = products.find(p => p.id === productId);
        if (selectedProduct) {
            setValue('productId', selectedProduct.id, { shouldValidate: true });
            setValue('productName', selectedProduct.name, { shouldValidate: true });
            setValue('sku', selectedProduct.sku, { shouldValidate: true });
        }
        setIsProductSelectorOpen(false);
    };
    
    const onSubmit = async (data: ReturnFormValues) => {
        try {
            await saveReturnLog({
                ...data,
                sku: data.sku,
                originalSaleData: foundLog || undefined,
            });
            toast({ title: "Devolução Registrada!", description: `Produto ${data.productName} retornado ao estoque.`})
            await fetchTodaysReturns(); // Refresh the list
            reset();
            setScannedSn("");
            setFoundLog(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível registrar a devolução.'});
        }
    };
    
    const handleRevertReturn = async (log: ReturnLog) => {
        try {
            await revertReturnAction(log);
            toast({ title: "Ação Revertida!", description: "A devolução foi desfeita e o item removido do estoque." });
            await fetchTodaysReturns(); // Refresh the list
        } catch(error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro ao Reverter', description: 'Não foi possível reverter a ação.'});
        }
    }

    const InfoCard = ({ title, icon: Icon, data, notFoundText }: { title: string, icon: React.ElementType, data: Record<string, any> | null, notFoundText: string }) => {
        return (
            <Card className="flex-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        {title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                    {data ? (
                        <div className="space-y-1">
                            {Object.entries(data).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                    <span className="font-semibold text-right">{value}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-6">
                            {isLoadingSn ? <Loader2 className="animate-spin" /> : (
                                <>
                                    {foundLog === null && scannedSn ? <XCircle className="h-8 w-8 mb-2 text-destructive" /> : <PackageCheck className="h-8 w-8 mb-2" /> }
                                    <p>{isLoadingSn ? "Buscando..." : notFoundText}</p>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

  return (
    <div className="space-y-8">
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Coluna do Formulário */}
                    <div className="lg:col-span-1 space-y-4">
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sn-input">Número de Série (SN) do Produto</Label>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            id="sn-input" 
                                            placeholder="Bipe ou digite o SN..." 
                                            value={scannedSn}
                                            onChange={handleSnInputChange}
                                            autoFocus
                                        />
                                        <Button type="button" size="icon" variant="outline" onClick={() => handleSearchSN(scannedSn)} disabled={isLoadingSn}>
                                            {isLoadingSn ? <Loader2 className="animate-spin" /> : <Search />}
                                        </Button>
                                    </div>
                                </div>

                                 <FormField
                                    control={form.control}
                                    name="productId"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Nome do Produto</FormLabel>
                                            <Popover open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                                        >
                                                        {field.value ? products.find((p) => p.id === field.value)?.name : "Selecione ou digite..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar produto..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                                            <CommandGroup>
                                                                {products.map((p) => (
                                                                    <CommandItem
                                                                        value={p.name}
                                                                        key={p.id}
                                                                        onSelect={() => handleProductSelectionChange(p.id)}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                        {p.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                 <FormField
                                    control={form.control}
                                    name="orderNumber"
                                    render={({ field }) => (
                                       <FormItem>
                                            <FormLabel>Número do Pedido de Venda</FormLabel>
                                            <FormControl><Input id="order-number" placeholder="Preenchido automaticamente ou digite" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="condition"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Condição do Item</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione a condição..." />
                                                </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {productSettings?.attributes.find(a => a.key === 'condicao')?.values.map(v => (
                                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                 <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Informações Adicionais</FormLabel>
                                            <FormControl><Textarea id="notes" placeholder="Detalhes sobre a devolução, avarias, etc." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                         <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Registrar Devolução"}
                         </Button>
                    </div>

                    {/* Coluna das Informações */}
                    <div className="lg:col-span-2 flex flex-col md:flex-row gap-8">
                       <InfoCard 
                            title="Informações do Produto" 
                            icon={PackageCheck} 
                            data={foundLog ? { Nome: foundLog.name, SKU: foundLog.sku, Custo: `R$ ${foundLog.costPrice.toFixed(2)}` } : null}
                            notFoundText="Aguardando a leitura do produto..."
                        />
                        <InfoCard 
                            title="Informações do Pedido" 
                            icon={FileText} 
                            data={foundLog ? { Pedido: foundLog.orderNumber, "Data da Saída": format(parseISO(foundLog.pickedAt), 'dd/MM/yyyy HH:mm') } : null}
                            notFoundText="Aguardando um pedido..."
                        />
                    </div>
                </div>
            </form>
        </Form>
        
        {/* Tabela de Resumo */}
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Resumo das devoluções de Hoje</CardTitle>
                        <CardDescription>Itens que retornaram ao estoque na data de hoje.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Input placeholder="Buscar pelo pedido..." className="w-64"/>
                        <Badge>{todaysReturns.length} registros</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Horário</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Nº de Série (SN)</TableHead>
                                <TableHead>Condição</TableHead>
                                <TableHead>Pedido</TableHead>
                                <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {isLoadingReturns ? (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="animate-spin" />
                                </TableCell>
                            </TableRow>
                           ) : todaysReturns.length > 0 ? (
                            todaysReturns.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{format(parseISO(item.returnedAt), 'HH:mm:ss')}</TableCell>
                                    <TableCell>{item.productName}</TableCell>
                                    <TableCell className="font-mono">{item.serialNumber}</TableCell>
                                    <TableCell><Badge variant="secondary">{item.condition}</Badge></TableCell>
                                    <TableCell>{item.orderNumber}</TableCell>
                                    <TableCell className="text-center">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Reverter esta devolução?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação irá remover permanentemente o registro de devolução do item <strong>(SN: {item.serialNumber})</strong> e o item será excluído do estoque. Você tem certeza?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRevertReturn(item)}>Sim, Reverter</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                           ) : (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Nenhuma devolução registrada hoje.</TableCell>
                            </TableRow>
                           )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

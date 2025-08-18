
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, Product } from '@/lib/types';
import { saveMultipleInventoryItems, loadInventoryItems, deleteInventoryItem, loadProducts, findInventoryItemBySN, loadProductSettings } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, Package, DollarSign, Loader2, Edit, ChevronsUpDown, Check, Layers, ArrowUpDown, Search, XCircle, ScanSearch, Undo2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/context/auth-context';

const inventorySchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "É obrigatório selecionar um produto."),
  sku: z.string().min(1, "SKU é obrigatório."),
  costPrice: z.coerce.number().min(0, "Preço de custo deve ser positivo."),
  origin: z.string().min(1, "A origem é obrigatória"),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;
type SortKey = 'quantity' | 'totalCost';
type SortDirection = 'ascending' | 'descending';

export default function EstoquePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [availableConditions, setAvailableConditions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all');
  
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [currentSN, setCurrentSN] = useState("");
  const snInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      productId: '',
      sku: '',
      costPrice: 0,
      origin: '',
    },
  });

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        const [items, loadedProducts, productSettings] = await Promise.all([
          loadInventoryItems(),
          loadProducts(),
          loadProductSettings('celular')
        ]);
        setInventory(items);
        setProducts(loadedProducts);
        if (productSettings) {
            const originAttribute = productSettings.attributes.find(attr => attr.key === 'origem');
            if (originAttribute) {
                setOrigins(originAttribute.values);
            }
            const conditionAttribute = productSettings.attributes.find(attr => attr.key === 'condicao');
            if (conditionAttribute) {
                setAvailableConditions(conditionAttribute.values);
            }
        }
        setIsLoading(false);
    }
    loadData();
  }, []);

  const handleProductSelectionChange = (productId: string) => {
    form.setValue('productId', productId, { shouldValidate: true });
    const selectedProduct = products.find(p => p.id === productId);
    if (selectedProduct) {
        form.setValue('sku', selectedProduct.sku, { shouldValidate: true });
    } else {
        form.setValue('sku', '', { shouldValidate: true });
    }
    setIsProductSelectorOpen(false);
  };
  
  const handleOriginSelectionChange = (origin: string) => {
    form.setValue('origin', origin, { shouldValidate: true });
  }

  const handleAddSerialNumber = async (snValue?: string) => {
    const snToAdd = (snValue || currentSN).trim();
    if (!snToAdd) return;

    if (serialNumbers.includes(snToAdd)) {
        toast({ variant: "destructive", title: "SN Duplicado", description: "Este número de série já foi adicionado à lista."});
        setCurrentSN("");
        return;
    }
    
    const existingItem = await findInventoryItemBySN(snToAdd);
    if (existingItem) {
      toast({ variant: "destructive", title: "SN já existe no estoque", description: `O SN ${snToAdd} já está cadastrado no produto ${existingItem.name}.` });
      setCurrentSN("");
      return;
    }

    setSerialNumbers(prev => [...prev, snToAdd]);
    setCurrentSN("");
  };
  
  const handleSNInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentSN(value);

    if (snInputTimeoutRef.current) {
      clearTimeout(snInputTimeoutRef.current);
    }

    snInputTimeoutRef.current = setTimeout(() => {
        if (value.trim()) {
            handleAddSerialNumber(value);
        }
    }, 500); // 500ms delay to auto-submit
  }

  const handleRemoveSerialNumber = (snToRemove: string) => {
    setSerialNumbers(prev => prev.filter(sn => sn !== snToRemove));
  };

  const onSubmit = async (data: InventoryFormValues) => {
    if (serialNumbers.length === 0) {
      toast({ variant: 'destructive', title: 'Nenhum SN Adicionado', description: 'Por favor, adicione pelo menos um número de série.' });
      return;
    }

    setIsSubmitting(true);
    
    const selectedProduct = products.find(p => p.id === data.productId);
    if (!selectedProduct) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Produto selecionado não encontrado.' });
        setIsSubmitting(false);
        return;
    }

    const newItems: Omit<InventoryItem, 'id'>[] = serialNumbers.map(sn => ({
      productId: data.productId,
      name: selectedProduct.name,
      sku: data.sku,
      costPrice: data.costPrice,
      quantity: 1,
      serialNumber: sn,
      origin: data.origin || '',
      condition: 'Novo',
      createdAt: new Date().toISOString(),
    }));

    try {
      const savedItems = await saveMultipleInventoryItems(newItems as any);
      setInventory(prev => [...savedItems, ...prev]);
      toast({
        title: `${newItems.length} Itens Adicionados!`,
        description: `Os produtos "${selectedProduct.name}" foram salvos com sucesso.`,
      });
      form.reset({ productId: '', sku: '', costPrice: 0, origin: '' });
      setSerialNumbers([]);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar os itens.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteInventoryItem(itemId);
      setInventory(prev => prev.filter(item => item.id !== itemId));
      toast({ title: 'Item Removido', description: 'O item foi removido do seu estoque.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Remover', description: 'Não foi possível remover o item.' });
    }
  };
  
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedInventory = useMemo(() => {
      let itemsToDisplay: (InventoryItem & {count?: number; totalCost?: number})[] = inventory;

      if (searchTerm) {
          const lowercasedTerm = searchTerm.toLowerCase();
          itemsToDisplay = itemsToDisplay.filter(item =>
              item.name.toLowerCase().includes(lowercasedTerm) ||
              item.sku.toLowerCase().includes(lowercasedTerm) ||
              item.serialNumber.toLowerCase().includes(lowercasedTerm)
          );
      }
      
      if (!isGrouped) {
          return itemsToDisplay;
      }
      
      const grouped: Record<string, InventoryItem & { count: number; totalCost: number }> = {};

      itemsToDisplay.forEach(item => {
        if (!grouped[item.sku]) {
          grouped[item.sku] = {
            ...item,
            id: item.sku, 
            quantity: 0,
            count: 0,
            totalCost: 0
          };
        }
        grouped[item.sku].quantity += item.quantity;
        grouped[item.sku].totalCost += item.costPrice * item.quantity;
        grouped[item.sku].count += 1;
      });

      let groupedArray = Object.values(grouped).map(group => ({
        ...group,
        costPrice: group.totalCost / group.quantity,
      }));
      
      if (sortConfig !== null) {
        groupedArray.sort((a, b) => {
          let aValue = 0;
          let bValue = 0;

          if (sortConfig.key === 'quantity') {
            aValue = a.quantity;
            bValue = b.quantity;
          } else if (sortConfig.key === 'totalCost') {
            aValue = a.costPrice * a.quantity;
            bValue = b.costPrice * b.quantity;
          }

          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        });
      }
      
      return groupedArray;
  }, [inventory, isGrouped, sortConfig, searchTerm]);

  const totals = useMemo(() => {
    const itemsToSum = conditionFilter === 'all'
      ? inventory
      : inventory.filter(item => item.condition === conditionFilter);

    const totalItems = itemsToSum.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = itemsToSum.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    return { totalItems, totalValue };
  }, [inventory, conditionFilter]);
  
  const getConditionBadgeVariant = (condition?: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline' | null | undefined, className: string } => {
    switch (condition) {
        case 'Novo':
            return { variant: 'default', className: '' };
        case 'Seminovo':
            return { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-800/30 dark:text-yellow-300' };
        case 'Lacrado':
            return { variant: 'secondary', className: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-800/30 dark:text-green-300' };
        default:
            return { variant: 'secondary', className: '' };
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
          return 'Data inválida';
      }
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando estoque...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline">Gerenciador de Estoque</h1>
          <p className="text-muted-foreground">Adicione itens ao seu inventário selecionando um modelo de produto.</p>
        </div>
        <Button asChild>
            <Link href="/estoque/devolucoes">
                <Undo2 />
                Devoluções
            </Link>
        </Button>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                  <CardTitle>Adicionar Item ao Estoque</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Produto</FormLabel>
                        <Popover open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                       {field.value ? products.find((p) => p.id === field.value)?.name : "Selecione um produto..."}
                                       <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar produto..." autoFocus />
                                    <CommandList>
                                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {products.map((p) => (
                                                <CommandItem
                                                    value={p.name}
                                                    key={p.id}
                                                    onSelect={() => handleProductSelectionChange(p.id)}
                                                >
                                                    <Check
                                                        className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")}
                                                    />
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
                  <FormField control={form.control} name="sku" render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl><Input placeholder="Selecione um produto acima" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )} />
                   <FormField control={form.control} name="costPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Custo (R$)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="Ex: 12.50" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )} />
                   <div className="space-y-2">
                      <Label htmlFor="serial-numbers-input">SN (Código do Fabricante)</Label>
                      <Input
                          id="serial-numbers-input"
                          placeholder="Bipe ou digite o SN"
                          value={currentSN}
                          onChange={handleSNInputChange}
                          autoComplete="off"
                      />
                      <div className="p-2 border rounded-md min-h-[60px] max-h-[120px] overflow-y-auto bg-muted/50">
                          {serialNumbers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                  {serialNumbers.map(sn => (
                                      <Badge key={sn} variant="secondary" className="flex items-center gap-1.5 pr-1">
                                          {sn}
                                          <button type="button" onClick={() => handleRemoveSerialNumber(sn)} className="rounded-full hover:bg-muted-foreground/20">
                                              <XCircle className="h-3 w-3" />
                                          </button>
                                      </Badge>
                                  ))}
                              </div>
                          ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhum SN adicionado.</p>
                          )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                          Contagem: <span className="font-semibold text-primary">{serialNumbers.length}</span>
                      </div>
                  </div>

                   <FormField
                      control={form.control}
                      name="origin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem</FormLabel>
                          <Select onValueChange={handleOriginSelectionChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma origem..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {origins.map((origin) => (
                                <SelectItem key={origin} value={origin}>
                                  {origin}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin"/> : <PlusCircle />}
                        Adicionar ao Estoque
                    </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
            <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Itens em Estoque</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.totalItems}</div>
                        <p className="text-xs text-muted-foreground">Unidades totais de todos os produtos.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estoque Imobilizado Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</div>
                         <div className="flex items-center gap-2 mt-1">
                            <Label htmlFor="condition-filter" className="text-xs text-muted-foreground whitespace-nowrap">Filtrar por:</Label>
                            <Select value={conditionFilter} onValueChange={setConditionFilter}>
                                <SelectTrigger id="condition-filter" className="h-7 text-xs">
                                    <SelectValue placeholder="Filtrar por condição..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {availableConditions.map(cond => (
                                        <SelectItem key={cond} value={cond}>{cond}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>
          <Card>
            <CardHeader>
               <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <CardTitle>Produtos em Estoque</CardTitle>
                    <CardDescription>Lista de todos os produtos cadastrados no seu inventário.</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                     <Button asChild variant="outline">
                        <Link href="/estoque/conferencia">
                            <ScanSearch />
                            Conferir Estoque
                        </Link>
                     </Button>
                     <div className="flex items-center space-x-2">
                        <Layers className="h-5 w-5" />
                        <Label htmlFor="group-switch">Agrupar por SKU</Label>
                        <Switch id="group-switch" checked={isGrouped} onCheckedChange={setIsGrouped} />
                    </div>
                  </div>
               </div>
               <div className="relative mt-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por Nome, SKU ou SN..." 
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                   />
               </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                       {!isGrouped && <TableHead>SN</TableHead>}
                      <TableHead className="text-right">
                         <Button variant="ghost" onClick={() => isGrouped && handleSort('quantity')} disabled={!isGrouped}>
                            Qtd.
                            {isGrouped && <ArrowUpDown className="ml-2 h-4 w-4" />}
                         </Button>
                      </TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">
                         <Button variant="ghost" onClick={() => isGrouped && handleSort('totalCost')} disabled={!isGrouped}>
                           Custo Total
                           {isGrouped && <ArrowUpDown className="ml-2 h-4 w-4" />}
                         </Button>
                      </TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedInventory.length > 0 ? (
                      filteredAndSortedInventory.map(item => {
                        const badgeStyle = getConditionBadgeVariant(item.condition);
                        return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                                <span>{item.name}</span>
                                {!isGrouped && (
                                    <>
                                        <span className="text-xs text-muted-foreground">Adicionado em: {formatDate(item.createdAt)}</span>
                                        <Badge variant={badgeStyle.variant} className={cn('w-fit mt-1', badgeStyle.className)}>
                                          {item.condition || 'N/A'}
                                        </Badge>
                                    </>
                                )}
                            </div>
                           </TableCell>
                          <TableCell className="font-mono">{item.sku}</TableCell>
                          {!isGrouped && <TableCell className="font-mono text-xs">{item.serialNumber}</TableCell>}
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.costPrice * item.quantity)}</TableCell>
                          <TableCell className="text-center space-x-1">
                             {!isGrouped && (user?.role === 'admin' || user?.role === 'financeiro') && (
                                <>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação não pode ser desfeita. Isso removerá permanentemente o item
                                                do seu estoque.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(item.id)}>Continuar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                             )}
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isGrouped ? 6 : 7} className="h-24 text-center">
                          Nenhum produto encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

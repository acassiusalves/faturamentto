
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import type { InventoryItem, Product, ProductCategorySettings } from '@/lib/types';
import { saveInventoryItem, saveMultipleInventoryItems, loadInventoryItems, deleteInventoryItem, loadProducts, findInventoryItemBySN, loadProductSettings } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, Package, DollarSign, Loader2, Edit, ChevronsUpDown, Check, Layers, ArrowUpDown, Search, XCircle, ScanSearch, Undo2, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns, View, PackageMinus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/context/auth-context';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { DetailedEntryHistory } from './conferencia/detailed-entry-history';
import { FullIcon } from '@/components/icons';


const inventorySchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "É obrigatório selecionar um produto."),
  sku: z.string().min(1, "SKU é obrigatório."),
  name: z.string().optional(), // Added for display
  costPrice: z.coerce.number().min(0, "Preço de custo deve ser positivo."),
  origin: z.string().min(1, "A origem é obrigatória"),
  condition: z.string().min(1, "A condição é obrigatória"),
  serialNumber: z.string().optional(),
});

const generalProductEntrySchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "É obrigatório selecionar um produto."),
  name: z.string().optional(),
  costPrice: z.coerce.number().min(0, "Preço de custo deve ser positivo."),
  quantity: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  marca: z.string().optional(), 
  modelo: z.string().optional(),
  condition: z.string().min(1, "A condição é obrigatória."),
  eanOrCode: z.string().optional(),
  sku: z.string().min(1, "SKU é obrigatório."),
});


type InventoryFormValues = z.infer<typeof inventorySchema>;
type GeneralProductFormValues = z.infer<typeof generalProductEntrySchema>;
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
  
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [currentSN, setCurrentSN] = useState("");
  const snInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = useState(false);

  // New states for general products entry
  const [isGeneralProductMode, setIsGeneralProductMode] = useState(false);
  const [eanCode, setEanCode] = useState("");
  const eanInputRef = useRef<HTMLInputElement>(null);

  // Pagination State
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // Category Filter State
  const [showCellular, setShowCellular] = useState(true);
  const [showGeneral, setShowGeneral] = useState(true);


  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    product: true,
    sku: true,
    sn: true,
    quantity: true,
    costPrice: true,
    totalCost: true,
    actions: true,
  });

  const form = useForm<InventoryFormValues | GeneralProductFormValues>({
    resolver: zodResolver(isGeneralProductMode ? generalProductEntrySchema : inventorySchema),
    defaultValues: {
      productId: '',
      sku: '',
      name: '',
      costPrice: 0,
      origin: '',
      condition: 'Novo',
      serialNumber: '',
      quantity: 1,
    },
  });
  
  const fetchInventory = useCallback(async () => {
    console.log("Buscando itens do inventário...");
    const items = await loadInventoryItems();
    setInventory(items);
  }, []);

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        const [loadedProducts, productSettings] = await Promise.all([
          loadProducts(),
          loadProductSettings('celular'),
          fetchInventory()
        ]);
        setProducts(loadedProducts);
        if (productSettings) {
            const originAttribute = productSettings.attributes.find(attr => attr.key === 'origem');
            if (originAttribute) {
                setOrigins(originAttribute.values);
            }
            const conditionAttribute = productSettings.attributes.find(attr => attr.key === 'condicao');
            if (conditionAttribute) {
                setAvailableConditions(conditionAttribute.values);
                setSelectedConditions(conditionAttribute.values); // Seleciona todos por padrão
            }
        }
        setIsLoading(false);
    }
    loadData();
  }, [fetchInventory]);

  useEffect(() => {
    const handleStorageChange = () => {
        if (localStorage.getItem('stockDataDirty') === 'true') {
            fetchInventory();
            localStorage.removeItem('stockDataDirty');
        }
    };
    window.addEventListener('focus', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('focus', handleStorageChange);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchInventory]);


  const handleProductSelectionChange = (productId: string) => {
    form.setValue('productId', productId, { shouldValidate: true });
    const selectedProduct = products.find(p => p.id === productId);
    if (selectedProduct) {
        form.setValue('sku', selectedProduct.sku, { shouldValidate: true });
        form.setValue('name', selectedProduct.name, { shouldValidate: true });
    } else {
        form.setValue('sku', '', { shouldValidate: true });
        form.setValue('name', '', { shouldValidate: true });
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

  const onSubmit = async (data: InventoryFormValues | GeneralProductFormValues) => {
    setIsSubmitting(true);

    try {
        const selectedProduct = products.find(p => p.id === data.productId);
        if (!selectedProduct) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Produto selecionado não encontrado.' });
            setIsSubmitting(false);
            return;
        }

        if (isGeneralProductMode) {
            const generalData = data as GeneralProductFormValues;
            const quantity = generalData.quantity || 1;

            if (quantity <= 0) {
                 toast({ variant: 'destructive', title: 'Quantidade Inválida', description: 'A quantidade deve ser pelo menos 1.' });
                 setIsSubmitting(false);
                 return;
            }

            const newItem: Omit<InventoryItem, 'id'> = {
                productId: data.productId,
                name: selectedProduct.name,
                sku: data.sku,
                costPrice: data.costPrice,
                quantity: quantity,
                serialNumber: generalData.eanOrCode || '',
                origin: selectedProduct.attributes.marca || 'Geral',
                condition: data.condition || 'Novo',
                createdAt: new Date().toISOString(),
                category: 'Geral'
            };
            await saveInventoryItem(newItem as any);
            await fetchInventory();

            toast({
                title: `${quantity} Item(ns) Adicionado(s)!`,
                description: `O produto "${selectedProduct.name}" foi adicionado ao estoque.`,
            });
        } else {
            if (serialNumbers.length === 0) {
                toast({ variant: 'destructive', title: 'Nenhum item para adicionar', description: 'Por favor, adicione pelo menos um número de série.' });
                setIsSubmitting(false);
                return;
            }

            const originToSave = (data as InventoryFormValues).origin || '';
            const newItems: Omit<InventoryItem, 'id'>[] = serialNumbers.map(sn => ({
                productId: data.productId,
                name: selectedProduct.name,
                sku: data.sku,
                costPrice: data.costPrice,
                quantity: 1, 
                serialNumber: sn,
                origin: originToSave,
                condition: data.condition || 'Novo',
                createdAt: new Date().toISOString(),
                category: 'Celular' // AQUI é onde a categoria é definida para celulares
            }));

            await saveMultipleInventoryItems(newItems as any);
            await fetchInventory();
             toast({
                title: `${newItems.length} Item(ns) Adicionado(s)!`,
                description: `O(s) produto(s) "${selectedProduct.name}" foram salvos com sucesso.`,
            });
        }
        
        localStorage.setItem('stockDataDirty', 'true');
        
        form.reset({ productId: '', sku: '', name: '', costPrice: 0, origin: '', condition: 'Novo', serialNumber: '', marca: '', modelo: '', quantity: 1, eanOrCode: '' });
        setSerialNumbers([]);
        setEanCode('');
        
        if (isGeneralProductMode) {
            eanInputRef.current?.focus();
        } else {
            setIsNewEntryDialogOpen(false);
        }

    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar os itens.' });
    } finally {
        setIsSubmitting(false);
    }
};
  
  const handleEanCodeSearch = (code: string) => {
    if (!code) return;
    const lowerCode = code.toLowerCase();
    
    const product = products.find(p => 
        (p.attributes.ean && p.attributes.ean.toLowerCase() === lowerCode) || 
        p.sku.toLowerCase() === lowerCode
    );

    if (product) {
        form.setValue('productId', product.id);
        form.setValue('name', product.name, { shouldValidate: true });
        form.setValue('sku', product.sku, { shouldValidate: true });
        form.setValue('marca' as any, product.attributes.marca || '');
        form.setValue('modelo' as any, product.attributes.modelo || '');
        form.setValue('eanOrCode' as any, code);

        toast({ title: 'Produto Encontrado!', description: `Dados de "${product.name}" carregados.`});
    } else {
        form.reset({ productId: '', sku: '', name: '', costPrice: 0, origin: '', condition: 'Novo', serialNumber: '', quantity: 1, eanOrCode: code, marca: '', modelo: '' });
        toast({ variant: 'destructive', title: 'Produto não encontrado', description: 'Verifique o código ou cadastre o produto.'});
    }
  }


  const handleDelete = async (itemId: string) => {
    try {
      await deleteInventoryItem(itemId);
      setInventory(prev => prev.filter(item => item.id !== itemId));
      localStorage.setItem('stockDataDirty', 'true');
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
  
  const handleConditionFilterChange = (condition: string, checked: boolean) => {
    setSelectedConditions(prev => {
        if (checked) {
            return [...prev, condition];
        } else {
            return prev.filter(c => c !== condition);
        }
    });
  }

  const filteredAndSortedInventory = useMemo(() => {
    let itemsToDisplay: (InventoryItem & { count?: number; totalCost?: number })[] = inventory;

    // Filter by category (Celular/Geral)
    itemsToDisplay = itemsToDisplay.filter(item => {
        const category = (item as any).category || 'Celular'; // Default old items to Celular
        if (showCellular && !showGeneral) return category === 'Celular';
        if (!showCellular && showGeneral) return category === 'Geral';
        if (showCellular && showGeneral) return true;
        return false;
    });

    if (selectedConditions.length > 0 && selectedConditions.length < availableConditions.length) {
      itemsToDisplay = itemsToDisplay.filter(item => {
          const condition = item.condition || 'Novo';
          return selectedConditions.includes(condition);
      });
    }

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        itemsToDisplay = itemsToDisplay.filter(item =>
            item.name.toLowerCase().includes(lowercasedTerm) ||
            item.sku.toLowerCase().includes(lowercasedTerm) ||
            (item.serialNumber && item.serialNumber.toLowerCase().includes(lowercasedTerm))
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
            bValue = b.costPrice * a.quantity;
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
  }, [inventory, isGrouped, sortConfig, searchTerm, selectedConditions, showCellular, showGeneral, availableConditions.length]);

  const pageCount = useMemo(() => Math.ceil(filteredAndSortedInventory.length / pageSize), [filteredAndSortedInventory.length, pageSize]);
  
  const paginatedItems = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return filteredAndSortedInventory.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedInventory, pageIndex, pageSize]);

  useEffect(() => {
    if (pageIndex >= pageCount && pageCount > 0) {
        setPageIndex(pageCount - 1);
    } else if (pageCount === 0) {
        setPageIndex(0);
    }
  }, [filteredAndSortedInventory, pageIndex, pageCount]);


  const summaryStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {};
    
    availableConditions.forEach(cond => {
        stats[cond] = { count: 0, value: 0 };
    });
    stats['total'] = { count: 0, value: 0 };

    filteredAndSortedInventory.forEach(item => {
        const condition = item.condition || 'Novo';
        const quantity = isGrouped ? item.quantity : (item as InventoryItem).quantity;
        const value = isGrouped ? (item as any).totalCost : (item as InventoryItem).costPrice * (item as InventoryItem).quantity;

        if (stats[condition]) {
            stats[condition].count += quantity;
            stats[condition].value += value;
        }
        stats['total'].count += quantity;
        stats['total'].value += value;
    });

    return stats;
  }, [filteredAndSortedInventory, availableConditions, isGrouped]);
  
  const getConditionBadgeVariant = (condition?: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline' | null | undefined, className: string } => {
    switch (condition || 'Novo') { // Default to 'Novo' for styling
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

  const resetDialog = () => {
    form.reset({ productId: '', sku: '', name: '', costPrice: 0, origin: '', condition: 'Novo', serialNumber: '', marca: '', modelo: '', quantity: 1, eanOrCode: '' });
    setSerialNumbers([]);
    setCurrentSN("");
    setEanCode("");
    setIsGeneralProductMode(false);
  };
  
  const StatCard = ({ title, count, value, ...props }: { title: string, count: number, value: number } & React.HTMLAttributes<HTMLDivElement>) => (
    <Card {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Package className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <p className="text-xs text-green-600 bg-green-100/50 dark:bg-green-900/50 rounded-full px-2 py-1 font-semibold w-fit mt-1">{formatCurrency(value)}</p>
      </CardContent>
    </Card>
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando estoque...</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-8 p-4 md:p-8">
       <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline">Gerenciador de Estoque</h1>
          <p className="text-muted-foreground">Adicione itens ao seu inventário selecionando um modelo de produto.</p>
        </div>
        <div className="flex items-center gap-2">
             <Button asChild variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700">
                <Link href="/estoque/retiradas-full">
                    <span className="flex items-center gap-1">
                         Retiradas <FullIcon className="h-5" />
                    </span>
                </Link>
            </Button>
            <Button asChild>
                <Link href="/estoque/devolucoes">
                    <Undo2 />
                    Devoluções
                </Link>
            </Button>
            <Dialog open={isNewEntryDialogOpen} onOpenChange={(open) => {
                if(!open) resetDialog();
                setIsNewEntryDialogOpen(open);
            }}>
                <DialogTrigger asChild>
                     <Button>
                        <PlusCircle className="mr-2"/>
                        Nova Entrada
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                     <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="general-product-switch" className="text-sm font-medium">
                                    Produtos Gerais
                                </Label>
                                <Switch 
                                    id="general-product-switch" 
                                    checked={isGeneralProductMode}
                                    onCheckedChange={setIsGeneralProductMode}
                                />
                            </div>
                        </div>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            {isGeneralProductMode ? (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="ean-code-input">EAN / Código</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="ean-code-input"
                                                ref={eanInputRef}
                                                placeholder="Bipe ou digite o código/EAN"
                                                value={eanCode}
                                                onChange={(e) => setEanCode(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if(e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleEanCodeSearch(eanCode);
                                                    }
                                                }}
                                            />
                                            <Button type="button" variant="secondary" onClick={() => handleEanCodeSearch(eanCode)}><Search /></Button>
                                        </div>
                                    </div>
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome do Produto</FormLabel>
                                            <FormControl><Input placeholder="Preenchido pela busca" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                     <FormField control={form.control} name="sku" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>SKU do Produto</FormLabel>
                                            <FormControl><Input placeholder="Preenchido pela busca" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="marca" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Marca</FormLabel>
                                                <FormControl><Input placeholder="-" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="modelo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Modelo</FormLabel>
                                                <FormControl><Input placeholder="-" {...field} readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </>
                            ) : (
                                <>
                                <FormField
                                    control={form.control}
                                    name="productId"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome do Produto</FormLabel>
                                        <Popover open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen} modal={false}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        type="button"
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
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[9999] pointer-events-auto" align="start" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
                                                <Command>
                                                    <CommandInput placeholder="Buscar produto..." />
                                                    <CommandList className="pointer-events-auto">
                                                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                                        <CommandGroup>
                                                            {products.map((p) => (
                                                                <CommandItem
                                                                    value={p.name}
                                                                    key={p.id}
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onSelect={() => handleProductSelectionChange(p.id)}
                                                                    className="cursor-pointer"
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
                                </>
                            )}
                             <FormField control={form.control} name="costPrice" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço de Custo (R$)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="Ex: 12.50" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            {isGeneralProductMode && (
                                <FormField control={form.control} name="quantity" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantidade</FormLabel>
                                        <FormControl><Input type="number" min="1" placeholder="1" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                            {!isGeneralProductMode && (
                                <FormField
                                    control={form.control}
                                    name="origin"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Origem</FormLabel>
                                        <Select onValueChange={handleOriginSelectionChange} defaultValue={field.value} value={field.value}>
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
                            )}
                             <FormField
                                control={form.control}
                                name="condition"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Condição</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione uma condição..." />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {availableConditions.map((cond) => (
                                            <SelectItem key={cond} value={cond}>
                                            {cond}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                 <Button type="button" variant="ghost" onClick={() => setIsNewEntryDialogOpen(false)}>Cancelar</Button>
                                 <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin"/> : <PlusCircle />}
                                    Adicionar ao Estoque
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      </div>
      
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Total em Estoque" count={summaryStats.total.count} value={summaryStats.total.value} className="col-span-full sm:col-span-1 lg:col-span-1" />
            {Object.entries(summaryStats).filter(([key]) => key !== 'total').map(([condition, data]) => (
                <StatCard key={condition} title={condition} count={data.count} value={data.value} />
            ))}
       </div>
      
        <div className="space-y-8">
          <Card>
            <CardHeader>
               <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <CardTitle>Produtos em Estoque</CardTitle>
                    <CardDescription>Lista de todos os produtos cadastrados no seu inventário.</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch id="cellular-switch" checked={showCellular} onCheckedChange={setShowCellular} />
                          <Label htmlFor="cellular-switch">Apenas celular</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                          <Switch id="general-switch" checked={showGeneral} onCheckedChange={setShowGeneral} />
                          <Label htmlFor="general-switch">Produtos Gerais</Label>
                        </div>
                      </div>
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline"><View className="mr-2" />Exibir</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuLabel>Exibir/Ocultar Colunas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem checked={columnVisibility.product} onCheckedChange={(c) => setColumnVisibility(p => ({...p, product: !!c}))}>Produto</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.sku} onCheckedChange={(c) => setColumnVisibility(p => ({...p, sku: !!c}))}>SKU</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.sn} onCheckedChange={(c) => setColumnVisibility(p => ({...p, sn: !!c}))}>SN</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.quantity} onCheckedChange={(c) => setColumnVisibility(p => ({...p, quantity: !!c}))}>Qtd.</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.costPrice} onCheckedChange={(c) => setColumnVisibility(p => ({...p, costPrice: !!c}))}>Custo Unit.</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.totalCost} onCheckedChange={(c) => setColumnVisibility(p => ({...p, totalCost: !!c}))}>Custo Total</DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem checked={columnVisibility.actions} onCheckedChange={(c) => setColumnVisibility(p => ({...p, actions: !!c}))}>Ações</DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                     </DropdownMenu>
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
                      {columnVisibility.product && <TableHead>Produto</TableHead>}
                      {columnVisibility.sku && <TableHead>SKU</TableHead>}
                      {columnVisibility.sn && !isGrouped && <TableHead>SN</TableHead>}
                      {columnVisibility.quantity && (
                        <TableHead className="text-right">
                          <Button variant="ghost" onClick={() => isGrouped && handleSort('quantity')} disabled={!isGrouped}>
                              Qtd.
                              {isGrouped && <ArrowUpDown className="ml-2 h-4 w-4" />}
                          </Button>
                        </TableHead>
                      )}
                      {columnVisibility.costPrice && <TableHead className="text-right">Custo Unit.</TableHead>}
                      {columnVisibility.totalCost && (
                         <TableHead className="text-right">
                           <Button variant="ghost" onClick={() => isGrouped && handleSort('totalCost')} disabled={!isGrouped}>
                             Custo Total
                             {isGrouped && <ArrowUpDown className="ml-2 h-4 w-4" />}
                           </Button>
                        </TableHead>
                      )}
                      {columnVisibility.actions && <TableHead className="text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map(item => {
                        const condition = item.condition || 'Novo';
                        const badgeStyle = getConditionBadgeVariant(condition);
                        return (
                        <TableRow key={item.id}>
                           {columnVisibility.product && (
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                    <span>{item.name}</span>
                                    {!isGrouped && (
                                        <>
                                            <span className="text-xs text-muted-foreground">Adicionado em: {formatDate(item.createdAt)}</span>
                                            <Badge variant={badgeStyle.variant} className={cn('w-fit mt-1', badgeStyle.className)}>
                                              {condition}
                                            </Badge>
                                        </>
                                    )}
                                </div>
                              </TableCell>
                           )}
                           {columnVisibility.sku && <TableCell className="font-mono">{item.sku}</TableCell>}
                           {columnVisibility.sn && !isGrouped && <TableCell className="font-mono text-xs">{item.serialNumber}</TableCell>}
                           {columnVisibility.quantity && <TableCell className="text-right">{item.quantity}</TableCell>}
                           {columnVisibility.costPrice && <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>}
                           {columnVisibility.totalCost && <TableCell className="text-right font-semibold">{formatCurrency(item.costPrice * item.quantity)}</TableCell>}
                           {columnVisibility.actions && (
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
                           )}
                        </TableRow>
                      )})
                    ) : (
                      <TableRow>
                        <TableCell colSpan={Object.values(columnVisibility).filter(v => v).length} className="h-24 text-center">
                          Nenhum produto encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
             <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-muted-foreground">
                    Total de {filteredAndSortedInventory.length} itens.
                </div>
                <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Itens por página</p>
                        <Select
                            value={`${pageSize}`}
                            onValueChange={(value) => {
                                setPageSize(Number(value));
                                setPageIndex(0);
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={pageSize.toString()} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 50, 100].map((size) => (
                                    <SelectItem key={size} value={`${size}`}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="text-sm font-medium">
                        Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                    </div>
                </div>
            </CardFooter>
          </Card>
        </div>
      <DetailedEntryHistory />
    </div>
    </>
  );
}

    
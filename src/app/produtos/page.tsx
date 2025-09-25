

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import type { Product, ProductCategorySettings, ProductAttribute } from '@/lib/types';
import { saveProduct, loadProducts, deleteProduct, loadProductSettings, saveProducts } from '@/services/firestore';
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
import { PlusCircle, Trash2, Package, DollarSign, Loader2, Edit, ChevronsUpDown, Check, Layers, ArrowUpDown, Search, XCircle, ScanSearch, Undo2, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns, View, Link2, Hash, AlertTriangle, Upload, Download, Settings } from 'lucide-react';
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
import { SkuAssociationDialog } from '@/components/sku-association-dialog';
import { ProductBulkImportDialog } from './product-bulk-import-dialog';
import { SkuBulkAssociationDialog } from './sku-bulk-association-dialog';
import { ConflictCheckDialog, type SkuConflict } from '@/components/conflict-check-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSettings } from '@/components/product-settings';


const attributeOrder: string[] = ['marca', 'modelo', 'armazenamento', 'memoria', 'cor', 'rede'];

const generalProductSchema = z.object({
    name: z.string().min(3, "O nome do produto é obrigatório."),
    sku: z.string().min(1, "O SKU é obrigatório."),
    marca: z.string().min(1, "A marca é obrigatória."),
    modelo: z.string().min(1, "O modelo é obrigatório."),
    cor: z.string().min(1, "A cor é obrigatória."),
    ean: z.string().optional(),
});
type GeneralProductFormValues = z.infer<typeof generalProductSchema>;

interface ProductListTableProps {
  productList: Product[];
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  hasConflicts: boolean;
  isCheckingConflicts: boolean;
  onOpenConflictDialog: () => void;
  onBulkImportOpen: () => void;
  onBulkAssociateOpen: () => void;
  onOpenSkuDialog: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  formatDate: (date: any) => string;
}

const ProductListTable = ({ 
    productList, 
    searchTerm, 
    onSearchTermChange, 
    hasConflicts, 
    isCheckingConflicts, 
    onOpenConflictDialog,
    onBulkImportOpen,
    onBulkAssociateOpen,
    onOpenSkuDialog,
    onDeleteProduct,
    formatDate
}: ProductListTableProps) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <CardTitle>Produtos Cadastrados</CardTitle>
            <CardDescription>Lista de todos os produtos que você já criou.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                className="pl-9 w-full sm:w-auto"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
              />
            </div>
            {productList.some(p => p.category === 'Celular') && (
                <Button variant="outline" onClick={onBulkImportOpen}>
                    <Upload className="mr-2 h-4 w-4" /> Importar
                </Button>
            )}
            <Button variant="outline" onClick={onBulkAssociateOpen}>
              <Link2 className="mr-2 h-4 w-4" /> Associar
            </Button>
            {hasConflicts && (
              <Button variant="destructive" onClick={onOpenConflictDialog} disabled={isCheckingConflicts}>
                {isCheckingConflicts ? <Loader2 className="animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                Verificar Conflitos
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productList.length ? (
                productList.map(product => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{product.name}</span>
                        {!!product.associatedSkus?.length && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="flex items-center text-sm text-primary font-semibold cursor-pointer">
                                <Link2 className="h-4 w-4" />
                                <span>{product.associatedSkus.length}</span>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-[9999]">
                              <div className="p-3 space-y-2">
                                <p className="text-sm font-semibold text-foreground">SKUs associados</p>
                                <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-2">
                                  {product.associatedSkus.map(sku => (
                                    <Badge key={sku} variant="secondary" className="font-mono justify-center">{sku}</Badge>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{product.sku}</TableCell>
                    <TableCell>{formatDate(product.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onOpenSkuDialog(product)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>Isso removerá permanentemente o modelo.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteProduct(product.id)}>Continuar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Nenhum produto encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
);

export default function EstoquePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductCategorySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkAssociateOpen, setIsBulkAssociateOpen] = useState(false);
  const [selectedProductForSku, setSelectedProductForSku] = useState<Product | null>(null);
  
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictResults, setConflictResults] = useState<SkuConflict[]>([]);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const cellularForm = useForm<Record<string, string>>({
    defaultValues: {},
  });
  
  const generalProductForm = useForm<GeneralProductFormValues>({
    resolver: zodResolver(generalProductSchema),
    defaultValues: { name: "", sku: "", marca: "", modelo: "", cor: "", ean: "" }
  });

  const runConflictCheck = useCallback((productsToCheck: Product[], showToast: boolean) => {
    const skuMap = new Map<string, { sku: string; name: string; productId: string }[]>();
    productsToCheck.forEach(p => {
      p.associatedSkus?.forEach(childSku => {
        if (!skuMap.has(childSku)) skuMap.set(childSku, []);
        skuMap.get(childSku)!.push({ sku: p.sku, name: p.name, productId: p.id });
      });
    });

    const conflicts: SkuConflict[] = [];
    skuMap.forEach((parentProducts, childSku) => {
      if (parentProducts.length > 1) conflicts.push({ childSku, parentProducts });
    });

    setConflictResults(conflicts);
    setHasConflicts(conflicts.length > 0);
    if (showToast && conflicts.length > 0) {
      toast({
        variant: "destructive",
        title: "Conflitos de SKU Encontrados!",
        description: "Um ou mais SKUs de anúncio estão associados a múltiplos produtos. Use a verificação para corrigir.",
      });
    }
  }, [toast]);
  
  const fetchProducts = useCallback(async () => {
    const loadedProducts = await loadProducts();
    setProducts(loadedProducts);
    runConflictCheck(loadedProducts, false); // Run check silently on load
  }, [runConflictCheck]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [loadedSettings] = await Promise.all([
        loadProductSettings('celular'),
        fetchProducts()
      ]);
      setSettings(loadedSettings);
      if (loadedSettings) {
        const initialFormState: Record<string, string> = {};
        loadedSettings.attributes.forEach(attr => { initialFormState[attr.key] = ""; });
        cellularForm.reset(initialFormState);
      }
      setIsLoading(false);
    }
    loadData();
  }, [fetchProducts, cellularForm.reset]);


  const handleOpenSkuDialog = (product: Product) => {
    setSelectedProductForSku(product);
    setIsSkuDialogOpen(true);
  };
  const handleSkuDialogClose = () => {
    setSelectedProductForSku(null);
    setIsSkuDialogOpen(false);
  };
  const handleSkuSave = async (product: Product, newSkus: string[]) => {
    const updatedProduct: Product = { ...product, associatedSkus: newSkus };
    await saveProduct(updatedProduct);
    await fetchProducts(); // Refetch all products to update the state
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const results = term
      ? products.filter(p =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.associatedSkus?.some(s => s.toLowerCase().includes(term))
        )
      : products;

    return results.sort((a, b) => (b.associatedSkus?.length || 0) - (a.associatedSkus?.length || 0));
  }, [products, searchTerm]);
  
  const filteredCellularProducts = useMemo(() => {
    return filteredProducts.filter(p => p.category === 'Celular');
  }, [filteredProducts]);

  const filteredGeneralProducts = useMemo(() => {
    return filteredProducts.filter(p => p.category !== 'Celular');
  }, [filteredProducts]);

  const orderedAttributes = useMemo(() => {
    if (!settings) return [];
    return attributeOrder
      .map(key => settings.attributes.find(attr => attr.key === key))
      .filter((attr): attr is ProductAttribute => !!attr);
  }, [settings]);

  const generatedCellularName = useMemo(() => {
    if (!settings) return "";
    return orderedAttributes
      .map(attr => cellularForm.watch(attr.key))
      .filter(Boolean)
      .join(" ");
  }, [cellularForm, orderedAttributes, settings]);
  
  const canSubmitCellular = useMemo(() => {
    if (!settings || !orderedAttributes.length) return false;
    const allRequiredFilled = orderedAttributes.every(attr => !!cellularForm.watch(attr.key));
    return allRequiredFilled && generatedCellularName.length > 0;
  }, [settings, cellularForm, generatedCellularName, orderedAttributes]);

  const generatedCellularSku = useMemo(() => {
    if (!canSubmitCellular) return "";
    
    const baseName = orderedAttributes
      .filter(attr => attr.key !== 'cor')
      .map(attr => cellularForm.watch(attr.key))
      .filter(Boolean)
      .join(" ");

    const existingProductWithSameBase = products.find(p => {
        const pBaseName = attributeOrder
            .filter(key => key !== 'cor')
            .map(key => p.attributes[key])
            .filter(Boolean)
            .join(" ");
        return pBaseName === baseName;
    });

    let sequentialNumberPart: string;

    if (existingProductWithSameBase?.sku) {
        sequentialNumberPart = existingProductWithSameBase.sku.replace(/[^0-9]/g, '');
    } else {
        const maxSkuNum = products.reduce((max, p) => {
            if (!p.sku) return max;
            const num = parseInt(p.sku.replace(/[^0-9]/g, ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        sequentialNumberPart = (maxSkuNum + 1).toString();
    }
    
    const color = cellularForm.watch('cor') || '';
    const colorCode = color.length > 2 && color.includes(' ') 
      ? color.split(' ').map(w => w.charAt(0)).join('').toUpperCase() 
      : color.charAt(0).toUpperCase();

    return `#${sequentialNumberPart}${colorCode}`;
  }, [products, cellularForm, canSubmitCellular, orderedAttributes]);

  const onCellularSubmit = async (data: Record<string, string>) => {
    if (!canSubmitCellular || !generatedCellularSku) return;
    if (products.some(p => p.name.toLowerCase() === generatedCellularName.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Produto Duplicado', description: `Um produto com o nome "${generatedCellularName}" já existe.` });
      return;
    }
    if (products.some(p => p.sku === generatedCellularSku)) {
      toast({ variant: 'destructive', title: 'SKU Duplicado', description: `O SKU "${generatedCellularSku}" já está sendo usado.` });
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      category: 'Celular',
      name: generatedCellularName,
      sku: generatedCellularSku,
      attributes: data,
      createdAt: new Date().toISOString(),
      associatedSkus: [],
    };
    try {
      await saveProduct(newProduct);
      setProducts(prev => {
        const np = [newProduct, ...prev];
        runConflictCheck(np, false);
        return np;
      });
      toast({ title: "Produto Criado!", description: `O modelo "${generatedCellularName}" foi salvo com sucesso.` });
      if (settings) {
        const initialFormState: Record<string, string> = {};
        settings.attributes.forEach(attr => { initialFormState[attr.key] = ""; });
        cellularForm.reset(initialFormState);
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o modelo do produto.' });
    }
  };
  
  const onGeneralSubmit = async (data: GeneralProductFormValues) => {
    if (products.some(p => p.name.toLowerCase() === data.name.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Produto Duplicado', description: `Um produto com o nome "${data.name}" já existe.` });
      return;
    }
    if (products.some(p => p.sku === data.sku)) {
      toast({ variant: 'destructive', title: 'SKU Duplicado', description: `O SKU "${data.sku}" já está sendo usado.` });
      return;
    }
    
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      category: 'Geral', // Differentiate category
      name: data.name,
      sku: data.sku,
      attributes: {
        marca: data.marca,
        modelo: data.modelo,
        cor: data.cor,
        ean: data.ean || ''
      },
      createdAt: new Date().toISOString(),
      associatedSkus: [],
    };
    
    try {
      await saveProduct(newProduct);
      setProducts(prev => {
        const np = [newProduct, ...prev];
        runConflictCheck(np, false);
        return np;
      });
      toast({ title: "Produto Criado!", description: `O produto "${data.name}" foi salvo com sucesso.` });
      generalProductForm.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o produto.' });
    }
  };


  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(prev => {
        const np = prev.filter(p => p.id !== productId);
        runConflictCheck(np, false);
        return np;
      });
      toast({ title: 'Modelo Removido', description: 'O modelo de produto foi removido.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao Remover', description: 'Não foi possível remover o modelo.' });
    }
  };

  const handleBulkImportSave = async (imported: Omit<Product, 'id' | 'createdAt'>[]) => {
    const toSave: Product[] = [];
    let skipped = 0;
    imported.forEach(p => {
      const dupName = products.some(x => x.name.toLowerCase() === p.name.toLowerCase());
      const dupSku  = products.some(x => x.sku === p.sku);
      if (dupName || dupSku) { skipped++; return; }
      toSave.push({ ...p, id: `prod-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() });
    });
    if (toSave.length) {
      await saveProducts(toSave);
      const np = [...toSave, ...products];
      setProducts(np);
      runConflictCheck(np, false);
    }
    toast({ title: "Importação Concluída", description: `${toSave.length} importados. ${skipped} ignorados por duplicidade.` });
    setIsBulkImportOpen(false);
  };

  const handleBulkAssociateSave = async (associations: Map<string, string[]>) => {
    const updated: Product[] = [];
    let count = 0;
    const map = new Map(products.map(p => [p.sku, p]));
    associations.forEach((childSkus, parentSku) => {
      const prod = map.get(parentSku);
      if (!prod) return;
      const set = new Set(prod.associatedSkus || []);
      childSkus.forEach(s => { if (!set.has(s)) { set.add(s); count++; } });
      const upd = { ...prod, associatedSkus: Array.from(set) };
      updated.push(upd);
      map.set(parentSku, upd);
    });
    if (updated.length) {
      await saveProducts(updated);
      const np = Array.from(map.values());
      setProducts(np);
      runConflictCheck(np, true);
    }
    toast({ title: "Associação em Massa", description: `${count} associações novas salvas.` });
    setIsBulkAssociateOpen(false);
  };

  const handleOpenConflictDialog = () => setIsConflictDialogOpen(true);

  const handleSaveCorrections = async (corrections: Map<string, string>) => {
    setIsCheckingConflicts(true);
    const toUpdate: Product[] = [];
    const np = products.map(p => {
      const filteredSkus = (p.associatedSkus || []).filter(childSku => {
        const correctParentId = corrections.get(childSku);
        return !(correctParentId && correctParentId !== p.id);
      });
      if (filteredSkus.length !== (p.associatedSkus?.length || 0)) {
        const upd = { ...p, associatedSkus: filteredSkus };
        toUpdate.push(upd);
        return upd;
      }
      return p;
    });
    if (toUpdate.length) {
      await saveProducts(toUpdate);
      setProducts(np);
      runConflictCheck(np, false);
      toast({ title: "Conflitos Resolvidos!", description: "Associações corrigidas com sucesso." });
    }
    setIsCheckingConflicts(false);
    setIsConflictDialogOpen(false);
  };

  const formatDate = (val: any) => {
    try {
      const d =
        val instanceof Date ? val
        : typeof val === 'string' ? new Date(val)
        : (val && typeof val.seconds === 'number') ? new Date(val.seconds * 1000)
        : null;

      return d && !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '-';
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando dados de produtos...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8 p-4 md:p-8">
        <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold font-headline">Gerenciador de Produtos</h1>
              <p className="text-muted-foreground">Crie e gerencie os modelos de produtos (produtos pai) do seu sistema.</p>
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Settings />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Configurações de Produtos</DialogTitle>
                        <DialogDescription>Gerencie atributos e opções para as categorias de produtos.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-y-auto -mx-6 px-6">
                        <ProductSettings />
                    </div>
                </DialogContent>
            </Dialog>
        </div>


        <Tabs defaultValue="celular" className="w-full">
            <TabsList>
                <TabsTrigger value="celular">Modelos (Celular)</TabsTrigger>
                <TabsTrigger value="geral">Produtos Gerais</TabsTrigger>
            </TabsList>

            {/* Aba para Celulares (formulário complexo existente) */}
            <TabsContent value="celular" className="mt-6">
                <div className="grid md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1 space-y-4">
                        <Form {...cellularForm}>
                            <form onSubmit={cellularForm.handleSubmit(onCellularSubmit)}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Criar Novo Modelo de Celular</CardTitle>
                                    <CardDescription>Selecione os atributos para gerar o nome padronizado.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {settings ? orderedAttributes.map(attr => (
                                        <FormField
                                        key={attr.key}
                                        control={cellularForm.control}
                                        name={attr.key}
                                        rules={{ required: true }}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>{attr.label}</FormLabel>
                                            {attr.key === 'modelo' ? (
                                                <Popover open={openPopovers[attr.key]} onOpenChange={(isOpen) => setOpenPopovers(prev => ({...prev, [attr.key]: isOpen}))} modal={false}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        type="button"
                                                        role="combobox"
                                                        className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                                    >
                                                        {field.value ? field.value : `Selecione ${attr.label.toLowerCase()}...`}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999] pointer-events-auto" align="start" sideOffset={4} onOpenAutoFocus={(e) => e.preventDefault()}>
                                                    <Command>
                                                    <CommandInput placeholder={`Buscar ${attr.label.toLowerCase()}...`} />
                                                    <CommandList className="pointer-events-auto">
                                                        <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                                                        <CommandGroup>
                                                        {attr.values.map(val => (
                                                            <CommandItem
                                                            key={val}
                                                            value={val}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onSelect={() => {
                                                                field.onChange(val);
                                                                setOpenPopovers(prev => ({...prev, [attr.key]: false}));
                                                            }}
                                                            className="cursor-pointer"
                                                            >
                                                            <Check className={cn("mr-2 h-4 w-4", field.value === val ? "opacity-100" : "opacity-0")} />
                                                            {val}
                                                            </CommandItem>
                                                        ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                    <SelectValue placeholder={`Selecione ${attr.label.toLowerCase()}...`} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {attr.values.map(val => (
                                                    <SelectItem key={val} value={val}>{val}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                                </Select>
                                            )}
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                    )) : <p>Carregando atributos...</p>}

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        <div className="space-y-2 col-span-2">
                                        <Label className="text-muted-foreground">Nome Gerado</Label>
                                        <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                                            <span className={generatedCellularName ? "text-primary font-semibold" : "text-muted-foreground"}>
                                            {generatedCellularName || "Selecione as opções acima..."}
                                            </span>
                                        </div>
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                        <Label className="text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> SKU Gerado</Label>
                                        <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                                            <span className={generatedCellularSku ? "text-accent font-semibold" : "text-muted-foreground"}>
                                            {generatedCellularSku || "Selecione as opções..."}
                                            </span>
                                        </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" className="w-full" disabled={cellularForm.formState.isSubmitting || !canSubmitCellular}>
                                    {cellularForm.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                                    Criar Modelo de Produto
                                    </Button>
                                </CardFooter>
                            </Card>
                            </form>
                        </Form>
                    </div>

                    <div className="md:col-span-2">
                        <ProductListTable
                            productList={filteredCellularProducts}
                            searchTerm={searchTerm}
                            onSearchTermChange={setSearchTerm}
                            hasConflicts={hasConflicts}
                            isCheckingConflicts={isCheckingConflicts}
                            onOpenConflictDialog={handleOpenConflictDialog}
                            onBulkImportOpen={() => setIsBulkImportOpen(true)}
                            onBulkAssociateOpen={() => setIsBulkAssociateOpen(true)}
                            onOpenSkuDialog={handleOpenSkuDialog}
                            onDeleteProduct={handleDelete}
                            formatDate={formatDate}
                        />
                    </div>
                </div>
            </TabsContent>

            {/* Aba para Produtos Gerais (novo formulário simples) */}
            <TabsContent value="geral" className="mt-6">
                 <div className="grid md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1">
                       <Form {...generalProductForm}>
                            <form onSubmit={generalProductForm.handleSubmit(onGeneralSubmit)}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Criar Novo Produto Geral</CardTitle>
                                        <CardDescription>Use este formulário para cadastrar produtos que não são celulares.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                         <FormField
                                            control={generalProductForm.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nome do Produto</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Capa para iPhone 15" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                         <FormField
                                            control={generalProductForm.control}
                                            name="sku"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Código/SKU</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: CAPA-IP15-BLK" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={generalProductForm.control}
                                            name="marca"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Marca</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecione a marca..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {settings?.attributes.find(a => a.key === 'marca')?.values.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                         <FormField
                                            control={generalProductForm.control}
                                            name="modelo"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Modelo</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Silicone Case" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                          <FormField
                                            control={generalProductForm.control}
                                            name="cor"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cor</FormLabel>
                                                     <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecione a cor..." /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {settings?.attributes.find(a => a.key === 'cor')?.values.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                         <FormField
                                            control={generalProductForm.control}
                                            name="ean"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>EAN / SN (Opcional)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Código de barras ou serial" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                     <CardFooter>
                                        <Button type="submit" className="w-full" disabled={generalProductForm.formState.isSubmitting}>
                                            {generalProductForm.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                                            Criar Produto
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </form>
                        </Form>
                    </div>
                     <div className="md:col-span-2">
                        <ProductListTable 
                           productList={filteredGeneralProducts}
                           searchTerm={searchTerm}
                           onSearchTermChange={setSearchTerm}
                           hasConflicts={hasConflicts}
                           isCheckingConflicts={isCheckingConflicts}
                           onOpenConflictDialog={handleOpenConflictDialog}
                           onBulkImportOpen={() => setIsBulkImportOpen(true)}
                           onBulkAssociateOpen={() => setIsBulkAssociateOpen(true)}
                           onOpenSkuDialog={handleOpenSkuDialog}
                           onDeleteProduct={handleDelete}
                           formatDate={formatDate}
                        />
                    </div>
                </div>
            </TabsContent>
        </Tabs>
      </div>

      {selectedProductForSku && (
        <SkuAssociationDialog
          isOpen={isSkuDialogOpen}
          onClose={handleSkuDialogClose}
          product={selectedProductForSku}
          onSave={handleSkuSave}
        />
      )}

      {settings && (
        <ProductBulkImportDialog
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          category={'Celular'}
          settings={settings}
          onSave={handleBulkImportSave}
        />
      )}

      <SkuBulkAssociationDialog
        isOpen={isBulkAssociateOpen}
        onClose={() => setIsBulkAssociateOpen(false)}
        onSave={handleBulkAssociateSave}
      />

      <ConflictCheckDialog
        isOpen={isConflictDialogOpen}
        onClose={() => setIsConflictDialogOpen(false)}
        conflicts={conflictResults}
        onSave={handleSaveCorrections}
        isSaving={isCheckingConflicts}
      />
    </>
  );
}


"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductCategorySettings, ProductAttribute } from '@/lib/types';
import { saveProduct, loadProducts, deleteProduct, loadProductSettings, saveProducts } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, Search, Download, Link2, Upload, AlertTriangle, ChevronsUpDown, Check, Hash } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { SkuAssociationDialog } from '@/components/sku-association-dialog';
import { Badge } from '@/components/ui/badge';
import { ProductBulkImportDialog } from './product-bulk-import-dialog';
import { SkuBulkAssociationDialog } from './sku-bulk-association-dialog';
import { ConflictCheckDialog, type SkuConflict } from '@/components/conflict-check-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSettings } from '@/components/product-settings';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const attributeOrder: string[] = ['marca', 'modelo', 'armazenamento', 'tipo', 'memoria', 'cor', 'rede'];

export default function ProductsPage() {
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductCategorySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkAssociateOpen, setIsBulkAssociateOpen] = useState(false);
  const [selectedProductForSku, setSelectedProductForSku] = useState<Product | null>(null);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictResults, setConflictResults] = useState<SkuConflict[]>([]);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);

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

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [loadedProducts, loadedSettings] = await Promise.all([
        loadProducts(),
        loadProductSettings('celular'),
      ]);
      setProducts(loadedProducts.filter(p => p.category === 'Celular'));
      runConflictCheck(loadedProducts, false);
      setSettings(loadedSettings);
      if (loadedSettings) {
        const initialFormState: Record<string, string> = {};
        loadedSettings.attributes.forEach(attr => { initialFormState[attr.key] = ""; });
        setFormState(initialFormState);
      }
      setIsLoading(false);
    }
    loadData();
  }, [runConflictCheck]);

  const handleAttributeSelect = (key: string, value: string) => {
    setFormState(prev => ({ ...prev, [key]: value }));
    setOpenPopovers(prev => ({...prev, [key]: false}));
  };

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
    setProducts(prev => {
      const newProducts = prev.map(p => (p.id === product.id ? updatedProduct : p));
      runConflictCheck(newProducts, true);
      return newProducts;
    });
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

  const orderedAttributes = useMemo(() => {
    if (!settings) return [];
    return attributeOrder
      .map(key => settings.attributes.find(attr => attr.key === key))
      .filter((attr): attr is ProductAttribute => !!attr);
  }, [settings]);

  const generatedName = useMemo(() => {
    if (!settings) return "";
    return orderedAttributes
      .map(attr => formState[attr.key])
      .filter(Boolean)
      .join(" ");
  }, [formState, orderedAttributes, settings]);

  const canSubmit = useMemo(() => {
    if (!settings) return false;
    const allRequiredFilled = settings.attributes.every(attr => !!formState[attr.key]);
    return allRequiredFilled && generatedName.length > 0;
  }, [settings, formState, generatedName]);

  const generatedSku = useMemo(() => {
    if (!canSubmit || !formState['cor']) return "";
    const baseName = orderedAttributes
      .filter(attr => attr.key !== 'cor')
      .map(attr => formState[attr.key])
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
        return isNaN(num) ? max : (num > max ? num : max);
      }, 0);
      sequentialNumberPart = (maxSkuNum + 1).toString();
    }
    const color = formState['cor'] || '';
    const colorCode = color.length > 2 && color.includes(' ')
      ? color.split(' ').map(w => w.charAt(0)).join('').toUpperCase()
      : color.charAt(0).toUpperCase();
    return `#${sequentialNumberPart}${colorCode}`;
  }, [products, formState, canSubmit, orderedAttributes]);

  const resetForm = () => {
    if (!settings) return;
    const initialFormState: Record<string, string> = {};
    settings.attributes.forEach(attr => { initialFormState[attr.key] = ""; });
    setFormState(initialFormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !generatedSku) return;
    if (products.some(p => p.name.toLowerCase() === generatedName.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Produto Duplicado', description: `Um produto com o nome "${generatedName}" já existe.` });
      return;
    }
    if (products.some(p => p.sku === generatedSku)) {
      toast({ variant: 'destructive', title: 'SKU Duplicado', description: `O SKU "${generatedSku}" já está sendo usado.` });
      return;
    }
    setIsSubmitting(true);
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      category: 'Celular',
      name: generatedName,
      sku: generatedSku,
      attributes: formState,
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
      toast({ title: "Produto Criado!", description: `O modelo "${generatedName}" foi salvo com sucesso.` });
      resetForm();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o modelo do produto.' });
    } finally {
      setIsSubmitting(false);
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

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

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
        <div>
          <h1 className="text-3xl font-bold font-headline">Gerenciador de Produtos</h1>
          <p className="text-muted-foreground">Crie e gerencie os modelos de produtos (produtos pai) do seu sistema.</p>
        </div>

        <Tabs defaultValue="models" className="w-full">
          <TabsList>
            <TabsTrigger value="models">Modelos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="mt-6">
            <div className="grid md:grid-cols-3 gap-8 items-start">
              <div className="md:col-span-1 space-y-4">
                  <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                          <CardTitle>Criar Novo Modelo de Celular</CardTitle>
                          <CardDescription>Selecione os atributos para gerar o nome padronizado.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {settings ? orderedAttributes.map(attr => (
                                <div key={attr.key} className="space-y-2">
                                    <Label>{attr.label}</Label>
                                    {attr.key === 'modelo' ? (
                                      <Popover open={openPopovers[attr.key]} onOpenChange={(isOpen) => setOpenPopovers(prev => ({ ...prev, [attr.key]: isOpen }))}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openPopovers[attr.key]}
                                            className="w-full justify-between font-normal"
                                          >
                                            <span className="truncate">
                                              {formState[attr.key] ? formState[attr.key] : `Selecione ${attr.label.toLowerCase()}...`}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                          <Command>
                                            <CommandInput
                                              placeholder={`Buscar ${attr.label.toLowerCase()}...`}
                                            />
                                            <CommandList>
                                              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                                              <CommandGroup>
                                                {attr.values.map((val) => (
                                                  <CommandItem
                                                    key={val}
                                                    value={val}
                                                    onSelect={() => handleAttributeSelect(attr.key, val)}
                                                  >
                                                    <Check className={cn("mr-2 h-4 w-4", formState[attr.key] === val ? "opacity-100" : "opacity-0")} />
                                                    {val}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <Select onValueChange={(value) => handleAttributeSelect(attr.key, value)} value={formState[attr.key]}>
                                        <SelectTrigger>
                                          <SelectValue placeholder={`Selecione ${attr.label.toLowerCase()}...`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {attr.values.map((val) => (
                                            <SelectItem key={val} value={val}>
                                              {val}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                </div>
                           )) : <p>Carregando atributos...</p>}

                          <div className="grid grid-cols-2 gap-4 pt-4">
                              <div className="space-y-2 col-span-2">
                                <Label className="text-muted-foreground">Nome Gerado</Label>
                                <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                                  <span className={generatedName ? "text-primary font-semibold" : "text-muted-foreground"}>
                                    {generatedName || "Selecione as opções acima..."}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label className="text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> SKU Gerado</Label>
                                <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                                  <span className={generatedSku ? "text-accent font-semibold" : "text-muted-foreground"}>
                                    {generatedSku || "Selecione as opções..."}
                                  </span>
                                </div>
                              </div>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                            Criar Modelo de Produto
                          </Button>
                        </CardFooter>
                    </Card>
                  </form>
              </div>

              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <CardTitle>Modelos Cadastrados</CardTitle>
                        <CardDescription>Lista de todos os modelos de produtos que você já criou.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por nome ou SKU..."
                            className="pl-9 w-full sm:w-auto"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                          <Upload className="mr-2 h-4 w-4" /> Importar
                        </Button>
                        <Button variant="outline" onClick={() => setIsBulkAssociateOpen(true)}>
                          <Link2 className="mr-2 h-4 w-4" /> Associar
                        </Button>
                        {hasConflicts && (
                          <Button variant="destructive" onClick={handleOpenConflictDialog} disabled={isCheckingConflicts}>
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
                          {filteredProducts.length ? (
                            filteredProducts.map(product => (
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
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenSkuDialog(product)}>
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
                                        <AlertDialogAction onClick={() => handleDelete(product.id)}>Continuar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center">Nenhum modelo encontrado.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ProductSettings />
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

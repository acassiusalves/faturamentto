
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductCategorySettings, ProductAttribute } from '@/lib/types';
import { saveProduct, loadProducts, deleteProduct, loadProductSettings, saveProducts } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, ChevronsUpDown, Check, Hash, Search, Download, Link2, Upload, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SkuAssociationDialog } from '@/components/sku-association-dialog';
import { Badge } from '@/components/ui/badge';
import { ProductBulkImportDialog } from './product-bulk-import-dialog';
import { SkuBulkAssociationDialog } from './sku-bulk-association-dialog';
import { ConflictCheckDialog, type SkuConflict } from '@/components/conflict-check-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductSettings } from '@/components/product-settings';
import Link from 'next/link';

const attributeOrder: string[] = ['marca', 'modelo', 'armazenamento', 'tipo', 'memoria', 'cor', 'rede'];

export default function ProductsPage() {
  const { toast } = useToast();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductCategorySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkAssociateOpen, setIsBulkAssociateOpen] = useState(false);
  const [selectedProductForSku, setSelectedProductForSku] = useState<Product | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictResults, setConflictResults] = useState<SkuConflict[]>([]);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [formState, setFormState] = useState<Record<string, string>>({});

  const runConflictCheck = useCallback((productsToCheck: Product[], showToast: boolean) => {
    const skuMap = new Map<string, { sku: string; name: string; productId: string }[]>();
    productsToCheck.forEach(p => {
        if (p.associatedSkus && p.associatedSkus.length > 0) {
            p.associatedSkus.forEach(childSku => {
                if (!skuMap.has(childSku)) {
                    skuMap.set(childSku, []);
                }
                skuMap.get(childSku)?.push({ sku: p.sku, name: p.name, productId: p.id });
            });
        }
    });
    const conflicts: SkuConflict[] = [];
    skuMap.forEach((parentProducts, childSku) => {
        if (parentProducts.length > 1) {
            conflicts.push({ childSku, parentProducts });
        }
    });
    setConflictResults(conflicts);
    if (conflicts.length > 0) {
      setHasConflicts(true);
      if (showToast) {
         toast({
            variant: "destructive",
            title: "Conflitos de SKU Encontrados!",
            description: "Um ou mais SKUs de anúncio estão associados a múltiplos produtos. Use a ferramenta de verificação para corrigir.",
        });
      }
    } else {
        setHasConflicts(false);
    }
  }, [toast]);

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        let [loadedProducts, loadedSettings] = await Promise.all([
            loadProducts(),
            loadProductSettings('celular'),
        ]);
        setProducts(loadedProducts.filter(p => p.category === 'Celular'));
        runConflictCheck(loadedProducts, false);
        setSettings(loadedSettings);
        if (loadedSettings) {
            const initialFormState: Record<string, string> = {};
            loadedSettings.attributes.forEach(attr => {
                initialFormState[attr.key] = "";
            });
            setFormState(initialFormState);
        }
        setIsLoading(false);
    }
    loadData();
  }, [runConflictCheck]);

  const handleAttributeSelect = (key: string, value: string) => {
    setFormState(prev => ({ ...prev, [key]: value }));
    setOpenPopovers(prev => ({ ...prev, [key]: false }));
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
  }, [formState, orderedAttributes]);
  
  const canSubmit = useMemo(() => {
     if (!settings) return false;
     return settings.attributes.every(attr => !!formState[attr.key]) && generatedName.length > 0;
  }, [settings, formState, generatedName])

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
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        sequentialNumberPart = (maxSkuNum + 1).toString();
    }
    const color = formState['cor'] || '';
    const colorCode = color.length > 2 && color.includes(' ') ? 
        color.split(' ').map(word => word.charAt(0)).join('').toUpperCase() : 
        color.slice(0, 2).toUpperCase();
    return `#${sequentialNumberPart}${colorCode}`;
}, [products, formState, canSubmit, orderedAttributes]);

  const filteredProducts = useMemo(() => {
    let results = products;
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      results = results.filter(product =>
        product.name.toLowerCase().includes(lowercasedTerm) ||
        product.sku.toLowerCase().includes(lowercasedTerm) ||
        product.associatedSkus?.some(sku => sku.toLowerCase().includes(lowercasedTerm))
      );
    }
    return results.sort((a, b) => (b.associatedSkus?.length || 0) - (a.associatedSkus?.length || 0));
  }, [products, searchTerm]);

  const resetForm = () => {
    if (!settings) return;
    const initialFormState: Record<string, string> = {};
    settings.attributes.forEach(attr => {
        initialFormState[attr.key] = "";
    });
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
        toast({ variant: 'destructive', title: 'SKU Duplicado', description: `O SKU gerado "${generatedSku}" já está em uso.` });
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
        const newProducts = [newProduct, ...prev];
        runConflictCheck(newProducts, false);
        return newProducts;
      });
      toast({ title: "Produto Criado!", description: `O modelo "${generatedName}" foi salvo.` });
      resetForm();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o modelo do produto.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(prev => {
        const newProducts = prev.filter(p => p.id !== productId);
        runConflictCheck(newProducts, false);
        return newProducts;
      });
      toast({ title: 'Modelo Removido', description: 'O modelo de produto foi removido.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao Remover', description: 'Não foi possível remover o modelo.' });
    }
  };
  
  const handleBulkImportSave = async (importedProducts: Omit<Product, 'id' | 'createdAt'>[]) => {
    const productsToSave: Product[] = [];
    let skippedCount = 0;
    const productsWithNoDuplicates = importedProducts.filter(newProd => {
        const nameExists = products.some(p => p.name.toLowerCase() === newProd.name.toLowerCase());
        const skuExists = products.some(p => p.sku === newProd.sku);
        if (nameExists || skuExists) {
            skippedCount++;
            return false;
        }
        return true;
    });
    productsWithNoDuplicates.forEach(p => {
        productsToSave.push({ ...p, id: `prod-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() });
    });
    if (productsToSave.length > 0) {
      await saveProducts(productsToSave);
      setProducts(prev => {
        const newProducts = [...productsToSave, ...prev];
        runConflictCheck(newProducts, false);
        return newProducts;
      });
    }
    toast({ title: "Importação Concluída", description: `${productsToSave.length} produtos importados. ${skippedCount} duplicados ignorados.` });
    setIsBulkImportOpen(false);
  }
  
  const handleBulkAssociateSave = async (associations: Map<string, string[]>) => {
    const productsToUpdate: Product[] = [];
    let associationsCount = 0;
    const notFoundSkus: string[] = [];
    const updatedProducts = products.map(p => {
      if (associations.has(p.sku)) {
        const productToUpdate = { ...p };
        const currentSkus = new Set(productToUpdate.associatedSkus || []);
        const skusToAdd = associations.get(p.sku) || [];
        skusToAdd.forEach(childSku => {
          if (!currentSkus.has(childSku)) {
            currentSkus.add(childSku);
            associationsCount++;
          }
        });
        productToUpdate.associatedSkus = Array.from(currentSkus);
        productsToUpdate.push(productToUpdate);
        return productToUpdate;
      }
      return p;
    });

    if (productsToUpdate.length > 0) {
      await saveProducts(productsToUpdate);
      setProducts(updatedProducts);
      runConflictCheck(updatedProducts, true);
    }
    
    associations.forEach((_, parentSku) => {
        if (!products.some(p => p.sku === parentSku)) {
            notFoundSkus.push(parentSku);
        }
    });

    toast({ title: "Associação em Massa Concluída", description: `${associationsCount} novas associações salvas. ${notFoundSkus.length} SKUs pais não encontrados.` });
    setIsBulkAssociateOpen(false);
  };

  const handleOpenConflictDialog = () => {
    setIsConflictDialogOpen(true);
  };

  const handleSaveCorrections = async (corrections: Map<string, string>) => {
    setIsCheckingConflicts(true);
    const productsToUpdate: Product[] = [];
    const updatedProducts = products.map(p => {
        let wasModified = false;
        const newSkus = (p.associatedSkus || []).filter(childSku => {
            const correctParentId = corrections.get(childSku);
            if (correctParentId && correctParentId !== p.id) {
                wasModified = true;
                return false; 
            }
            return true;
        });
        if (wasModified) {
            const updatedProduct = { ...p, associatedSkus: newSkus };
            productsToUpdate.push(updatedProduct);
            return updatedProduct;
        }
        return p;
    });

    if (productsToUpdate.length > 0) {
        await saveProducts(productsToUpdate);
        setProducts(updatedProducts);
        runConflictCheck(updatedProducts, false);
        toast({ title: "Conflitos Resolvidos!", description: "As associações de SKU foram corrigidas." });
    }
    setIsConflictDialogOpen(false);
    setIsCheckingConflicts(false);
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
                <div className="space-y-4">
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
                              <Input placeholder="Buscar por nome ou SKU..." className="pl-9 w-full sm:w-auto" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Importar</Button>
                            <Button variant="outline" onClick={() => setIsBulkAssociateOpen(true)}><Link2 className="mr-2 h-4 w-4" />Associar</Button>
                            {hasConflicts && <Button variant="destructive" onClick={handleOpenConflictDialog} disabled={isCheckingConflicts}>{isCheckingConflicts ? <Loader2 className="animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}Verificar Conflitos</Button>}
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
                            {filteredProducts.length > 0 ? (
                              filteredProducts.map(product => (
                                <TableRow key={product.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <span>{product.name}</span>
                                      {product.associatedSkus && product.associatedSkus.length > 0 && (
                                        <Popover>
                                          <PopoverTrigger asChild><div className="flex items-center text-sm text-primary font-semibold cursor-pointer"><Link2 className="h-4 w-4" /><span>{product.associatedSkus.length}</span></div></PopoverTrigger>
                                          <PopoverContent className="w-auto p-0">
                                            <div className="p-3 space-y-2">
                                              <p className="text-sm font-semibold text-foreground">SKUs associados</p>
                                              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-2">
                                                {product.associatedSkus.map(sku => (<Badge key={sku} variant="secondary" className="font-mono justify-center">{sku}</Badge>))}
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
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenSkuDialog(product)}><Download className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta ação não pode ser desfeita. Isso removerá permanentemente o modelo do produto.</AlertDialogDescription>
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
                            ) : (<TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum modelo encontrado.</TableCell></TableRow>)}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="mt-6">
                  <ProductSettings />
              </TabsContent>
          </Tabs>
      </div>
      
      {selectedProductForSku && <SkuAssociationDialog isOpen={isSkuDialogOpen} onClose={handleSkuDialogClose} product={selectedProductForSku} onSave={handleSkuSave} />}
      {settings && <ProductBulkImportDialog isOpen={isBulkImportOpen} onClose={() => setIsBulkImportOpen(false)} category={'Celular'} settings={settings} onSave={handleBulkImportSave} />}
      <SkuBulkAssociationDialog isOpen={isBulkAssociateOpen} onClose={() => setIsBulkAssociateOpen(false)} onSave={handleBulkAssociateSave} />
      <ConflictCheckDialog isOpen={isConflictDialogOpen} onClose={() => setIsConflictDialogOpen(false)} conflicts={conflictResults} onSave={handleSaveCorrections} isSaving={isCheckingConflicts} />
    </>
  );
}

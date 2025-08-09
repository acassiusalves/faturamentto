"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductCategorySettings, ProductAttribute, InventoryItem } from '@/lib/types';
import { saveProduct, loadProducts, deleteProduct, loadProductSettings, saveProducts } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, ChevronsUpDown, Check, Hash, Package, Search, Download, Link2, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { SkuAssociationDialog } from './sku-association-dialog';
import { Badge } from './ui/badge';
import { ProductBulkImportDialog } from './product-bulk-import-dialog';


interface ProductCreatorProps {
  category: "Celular"; // Expandable in the future
}

// Define a ordem correta dos atributos aqui
const attributeOrder: string[] = ['marca', 'modelo', 'armazenamento', 'tipo', 'memoria', 'cor', 'rede'];

export function ProductCreator({ category }: ProductCreatorProps) {
  const { toast } = useToast();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ProductCategorySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSkuDialogOpen, setIsSkuDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedProductForSku, setSelectedProductForSku] = useState<Product | null>(null);


  // Form state
  const [formState, setFormState] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadData() {
        setIsLoading(true);
        let [loadedProducts, loadedSettings] = await Promise.all([
            loadProducts(),
            loadProductSettings(category.toLowerCase()),
        ]);
        
        setProducts(loadedProducts.filter(p => p.category === category));
        setSettings(loadedSettings);
        if (loadedSettings) {
            // Initialize form state
            const initialFormState: Record<string, string> = {};
            loadedSettings.attributes.forEach(attr => {
                initialFormState[attr.key] = "";
            });
            setFormState(initialFormState);
        }
        setIsLoading(false);
    }
    loadData();
  }, [category, toast]);

  const handleAttributeSelect = (key: string, value: string) => {
    setFormState(prev => {
        const newValue = prev[key] === value ? "" : value;
        return {...prev, [key]: newValue };
    });
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
  
  const handleSkuSave = (product: Product, newSkus: string[]) => {
    const updatedProduct: Product = { ...product, associatedSkus: newSkus };
    
    // Optimistically update UI
    setProducts(prev => prev.map(p => (p.id === product.id ? updatedProduct : p)));
    
    // Save to mock service
    saveProduct(updatedProduct);
  };

  const orderedAttributes = useMemo(() => {
    if (!settings) return [];
    // This now correctly forces the form fields to render in the specified order
    return attributeOrder
      .map(key => settings.attributes.find(attr => attr.key === key))
      .filter((attr): attr is ProductAttribute => !!attr);
  }, [settings]);

  const generatedName = useMemo(() => {
    if (!settings) return "";
    // Gera o nome respeitando a ordem definida em `orderedAttributes`
    return orderedAttributes
      .map(attr => formState[attr.key])
      .filter(Boolean)
      .join(" ");
  }, [settings, formState, orderedAttributes]);
  
  const canSubmit = useMemo(() => {
     if (!settings) return false;
     const allRequiredFilled = settings.attributes.every(attr => {
       // Only check required attributes if you define them, for now, all are required
       return !!formState[attr.key];
     });
     return allRequiredFilled && generatedName.length > 0;
  }, [settings, formState, generatedName])

 const generatedSku = useMemo(() => {
    if (!canSubmit || !formState['cor']) return "";
    
    // 1. Create the base name (without color)
    const baseName = orderedAttributes
        .filter(attr => attr.key !== 'cor')
        .map(attr => formState[attr.key])
        .filter(Boolean)
        .join(" ");

    // 2. Find an existing product with the same base name to get the numeric part
    const existingProductWithSameBase = products.find(p => {
        const pBaseName = attributeOrder
            .filter(key => key !== 'cor')
            .map(key => p.attributes[key])
            .filter(Boolean)
            .join(" ");
        return pBaseName === baseName;
    });

    let sequentialNumberPart: string;

    if (existingProductWithSameBase && existingProductWithSameBase.sku) {
        // Extract number from existing SKU
        sequentialNumberPart = existingProductWithSameBase.sku.replace(/[^0-9]/g, '');
    } else {
        // Generate a new sequential number
        const maxSkuNum = products.reduce((max, p) => {
            if (!p.sku) return max;
            const num = parseInt(p.sku.replace(/[^0-9]/g, ''), 10);
            return isNaN(num) ? max : (num > max ? num : max);
        }, 0);
        sequentialNumberPart = (maxSkuNum + 1).toString();
    }
    
    const color = formState['cor'] || '';
    const colorCode = color.length > 2 && color.includes(' ') ? 
        color.split(' ').map(word => word.charAt(0)).join('').toUpperCase() : 
        color.charAt(0).toUpperCase();


    return `#${sequentialNumberPart}${colorCode}`;
}, [products, formState, canSubmit, orderedAttributes]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(lowercasedTerm);
      const skuMatch = product.sku.toLowerCase().includes(lowercasedTerm);
      const associatedSkuMatch = product.associatedSkus?.some(sku => sku.toLowerCase().includes(lowercasedTerm));
      return nameMatch || skuMatch || associatedSkuMatch;
    });
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

     // Rule: Check if product with the same name already exists
    const isProductDuplicate = products.some(p => p.name.toLowerCase() === generatedName.toLowerCase());
    if (isProductDuplicate) {
        toast({
            variant: 'destructive',
            title: 'Produto Duplicado',
            description: `Um produto com o nome "${generatedName}" já existe.`,
        });
        return;
    }

    // Rule: Check if SKU is already in use
    const existingProductWithSku = products.find(p => p.sku === generatedSku);
    if (existingProductWithSku) {
         toast({
            variant: 'destructive',
            title: 'SKU Duplicado',
            description: `O SKU "${generatedSku}" já está sendo usado pelo produto "${existingProductWithSku.name}".`,
        });
        return;
    }


    setIsSubmitting(true);

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      category,
      name: generatedName,
      sku: generatedSku,
      attributes: formState,
      createdAt: new Date().toISOString(),
      associatedSkus: [],
    };

    try {
      await saveProduct(newProduct);
      setProducts(prev => [newProduct, ...prev]);
      toast({
        title: "Produto Criado!",
        description: `O modelo "${generatedName}" foi salvo com sucesso.`,
      });
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
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast({ title: 'Modelo Removido', description: 'O modelo de produto foi removido.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Remover', description: 'Não foi possível remover o modelo.' });
    }
  };
  
  const handleBulkImportSave = async (importedProducts: Omit<Product, 'id' | 'createdAt'>[]) => {
    const productsToSave: Product[] = [];
    let skippedCount = 0;
    
    // Filter out duplicates before saving
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
        const newProduct: Product = {
            ...p,
            id: `prod-${Date.now()}-${Math.random()}`,
            createdAt: new Date().toISOString(),
        };
        productsToSave.push(newProduct);
    });

    if (productsToSave.length > 0) {
      await saveProducts(productsToSave);
      setProducts(prev => [...productsToSave, ...prev]);
    }
    
    toast({
        title: "Importação Concluída",
        description: `${productsToSave.length} produtos foram importados. ${skippedCount} produtos já existentes foram ignorados.`
    });
    setIsBulkImportOpen(false);
  }
  
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando dados de produtos...</p>
      </div>
    );
  }

  if (!settings || settings.attributes.length === 0) {
    return (
        <Card className="md:col-span-3">
            <CardHeader>
                <CardTitle>Configuração Necessária</CardTitle>
                <CardDescription>
                    Antes de criar um produto, você precisa definir os atributos e suas opções na aba de "Configurações".
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }


  return (
    <>
    <div className="grid md:grid-cols-3 gap-8 items-start">
      <div className="md:col-span-1 space-y-4">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Criar Novo Modelo de {category}</CardTitle>
              <CardDescription>Selecione os atributos para gerar o nome padronizado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderedAttributes.map(attr => (
                 <div key={attr.key} className="space-y-2">
                    <Label>{attr.label}</Label>
                    <Popover open={openPopovers[attr.key]} onOpenChange={(isOpen) => setOpenPopovers(prev => ({ ...prev, [attr.key]: isOpen }))}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={openPopovers[attr.key]} className="w-full justify-between font-normal">
                                <span className="truncate">
                                    {formState[attr.key] ? formState[attr.key] : `Selecione ${attr.label.toLowerCase()}...`}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0" style={{width: 'var(--radix-popover-trigger-width)'}}>
                            <Command>
                                <CommandInput placeholder={`Buscar ${attr.label.toLowerCase()}...`} />
                                <CommandList>
                                    <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                                    <CommandGroup>
                                        {attr.values.map(val => (
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
                 </div>
              ))}
              
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
          </form>
        </Card>
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
                       <Upload className="mr-2 h-4 w-4" />
                       Importar em Massa
                   </Button>
                   <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted p-2 rounded-md whitespace-nowrap">
                      <Hash className="h-4 w-4" />
                      <span>{filteredProducts.length} de {products.length} Modelos</span>
                  </div>
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
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Carregando...</TableCell></TableRow>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{product.name}</span>
                            {product.associatedSkus && product.associatedSkus.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <Link2 className="h-4 w-4 text-primary" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto max-w-xs p-3">
                                  <div className="space-y-2">
                                    <h4 className="font-medium leading-none text-sm">SKUs Associados</h4>
                                    <div className="flex flex-wrap gap-1">
                                      {product.associatedSkus.map(sku => (
                                        <Badge key={sku} variant="secondary">{sku}</Badge>
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
                                  <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. Isso removerá permanentemente o modelo do produto. Você não poderá mais adicioná-lo ao estoque.
                                  </AlertDialogDescription>
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
                      <TableCell colSpan={4} className="h-24 text-center">Nenhum modelo de produto encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
             </div>
          </CardContent>
        </Card>
      </div>
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
            category={category}
            settings={settings}
            onSave={handleBulkImportSave}
        />
    )}
    </>
  );
}


"use client";

import { useState, useMemo } from 'react';
import type { ProductDetail, UnprocessedItem, Product } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from './ui/button';
import { Download, Search, PackageCheck, PackageX, ArrowUpDown, BrainCircuit, CheckCircle, AlertTriangle } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import * as XLSX from 'xlsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ProductTableProps {
  products: ProductDetail[];
  allProducts: Product[]; // Pass all products for verification
  unprocessedItems?: UnprocessedItem[];
}

type SkuSortOrder = 'default' | 'sem_codigo_first' | 'com_codigo_first';
type VerificationStatus = 'ok' | 'divergent' | 'not_found' | 'unchecked';

export function ProductTable({ products, unprocessedItems = [], allProducts }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [skuSortOrder, setSkuSortOrder] = useState<SkuSortOrder>('default');
  const [verificationResults, setVerificationResults] = useState<Map<string, VerificationStatus>>(new Map());

  const allProductsMap = useMemo(() => {
      return new Map(allProducts.map(p => [p.sku, p]));
  }, [allProducts]);

  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach(p => {
      const brand = p.name.split(' ')[0];
      if (brand) {
        brandSet.add(brand);
      }
    });
    return Array.from(brandSet);
  }, [products]);
  
  const handleSortBySku = () => {
    setSkuSortOrder(prev => {
        if (prev === 'default') return 'sem_codigo_first';
        if (prev === 'sem_codigo_first') return 'com_codigo_first';
        return 'default';
    });
  }

  const handleVerifyResults = () => {
    const results = new Map<string, VerificationStatus>();
    products.forEach(product => {
      if (product.sku === 'SEM CÓDIGO') {
        results.set(product.name, 'not_found'); // Use name as key for no-sku items
        return;
      }

      const dbProduct = allProductsMap.get(product.sku);
      if (!dbProduct) {
        results.set(product.sku, 'not_found');
        return;
      }
      
      // Simple name similarity check
      const resultNameNorm = product.name.toLowerCase().replace(/[\s\W]/g, '');
      const dbNameNorm = dbProduct.name.toLowerCase().replace(/[\s\W]/g, '');

      if (dbNameNorm.includes(resultNameNorm) || resultNameNorm.includes(dbNameNorm)) {
        results.set(product.sku, 'ok');
      } else {
        results.set(product.sku, 'divergent');
      }
    });
    setVerificationResults(results);
  };


  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const lowerCaseSearch = searchTerm.toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(lowerCaseSearch);
      const skuMatch = product.sku?.toLowerCase().includes(lowerCaseSearch);

      const brand = product.name.split(' ')[0];
      const brandMatch = brandFilter === 'all' || brand.toLowerCase() === brandFilter.toLowerCase();
      
      return (nameMatch || skuMatch) && brandMatch;
    });

    if (skuSortOrder !== 'default') {
        filtered.sort((a, b) => {
            const aHasCode = a.sku !== 'SEM CÓDIGO';
            const bHasCode = b.sku !== 'SEM CÓDIGO';

            if (skuSortOrder === 'sem_codigo_first') {
                if (aHasCode && !bHasCode) return 1;
                if (!aHasCode && bHasCode) return -1;
            } else if (skuSortOrder === 'com_codigo_first') {
                if (aHasCode && !bHasCode) return -1;
                if (!aHasCode && bHasCode) return 1;
            }
            
            // For items with code, sort them alphabetically
            if(aHasCode && bHasCode) {
                return a.sku.localeCompare(b.sku);
            }

            return 0;
        });
    }

    return filtered;

  }, [products, searchTerm, brandFilter, skuSortOrder]);

  const notFoundCount = useMemo(() => {
    const withoutSku = products.filter(p => p.sku === 'SEM CÓDIGO').length;
    return withoutSku + (unprocessedItems?.length || 0);
  }, [products, unprocessedItems]);

  const foundCount = useMemo(() => {
      return products.filter(p => p.sku !== 'SEM CÓDIGO').length;
  }, [products]);
  
  const formatCurrencyForTable = (value: string | undefined): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    let numericString = String(value).replace(/[^\d,.]/g, '');
    if (numericString.includes(',')) {
        numericString = numericString.replace(/\./g, '').replace(',', '.');
    }
    const numericValue = parseFloat(numericString);
    if (isNaN(numericValue)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
  };
  
  const handleExportXLSX = () => {
    const dataToExport = filteredAndSortedProducts.map(p => {
        let numericString = String(p.costPrice || '0').replace(/[^\d,.]/g, '');
        if (numericString.includes(',')) {
            numericString = numericString.replace(/\./g, '').replace(',', '.');
        }
        const numericValue = parseFloat(numericString);

        return {
            'SKU': p.sku,
            'Nome do Produto': p.name,
            'Preço de Custo': isNaN(numericValue) ? 0 : numericValue
        }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 70 }, // Nome do Produto
      { wch: 20 }, // Preço de Custo
    ];
    
    // Format currency column
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell_address = { c: 2, r: R }; // C é a coluna do preço
        const cell = XLSX.utils.encode_cell(cell_address);
        if (ws[cell]) {
            ws[cell].z = 'R$ #,##0.00';
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'lista_de_produtos.xlsx');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Produtos Detalhada</CardTitle>
        <CardDescription>Navegue, filtre e exporte os dados extraídos da sua lista de produtos.</CardDescription>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <PackageCheck className="h-6 w-6 text-green-600"/>
                    <div>
                        <p className="font-bold text-lg">{foundCount} Produtos Encontrados</p>
                        <p className="text-xs text-muted-foreground">Itens com SKU correspondente no BD.</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <PackageX className="h-6 w-6 text-destructive"/>
                    <div>
                        <p className="font-bold text-lg">{notFoundCount} Produtos Sem Código</p>
                        <p className="text-xs text-muted-foreground">Itens não localizados no BD.</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-4">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Todas as Marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              {brands.map(brand => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleVerifyResults}>
            <BrainCircuit className="mr-2 h-4 w-4" />
            Analisar Resultado
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportXLSX}>
            <Download className="mr-2 h-4 w-4" />
            Exportar XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <TooltipProvider>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        <Button variant="ghost" onClick={handleSortBySku}>
                            SKU
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </TableHead>
                    <TableHead>Nome do Produto (Conforme Banco de Dados)</TableHead>
                    <TableHead className="text-right">Preço de Custo</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredAndSortedProducts.length > 0 ? (
                filteredAndSortedProducts.map((product, index) => {
                    const verificationKey = product.sku === 'SEM CÓDIGO' ? product.name : product.sku;
                    const status = verificationResults.get(verificationKey) || 'unchecked';
                    return (
                        <TableRow key={index}>
                            <TableCell className="font-mono">
                                <div className="flex items-center gap-2">
                                  {status === 'ok' && <Tooltip><TooltipTrigger><CheckCircle className="h-4 w-4 text-green-500" /></TooltipTrigger><TooltipContent><p>O nome do produto corresponde ao do banco de dados.</p></TooltipContent></Tooltip>}
                                  {status === 'divergent' && <Tooltip><TooltipTrigger><AlertTriangle className="h-4 w-4 text-amber-500" /></TooltipTrigger><TooltipContent><p>O nome do produto diverge do que está no banco de dados para este SKU.</p></TooltipContent></Tooltip>}
                                  {status === 'not_found' && product.sku !== 'SEM CÓDIGO' && <Tooltip><TooltipTrigger><AlertTriangle className="h-4 w-4 text-red-500" /></TooltipTrigger><TooltipContent><p>Este SKU não foi encontrado no banco de dados.</p></TooltipContent></Tooltip>}
                                  <span>{product.sku}</span>
                                </div>
                            </TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrencyForTable(product.costPrice)}</TableCell>
                        </TableRow>
                    );
                })
                ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                    Nenhum produto encontrado.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

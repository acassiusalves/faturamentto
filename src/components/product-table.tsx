
"use client";

import { useState, useMemo } from 'react';
import type { ProductDetail, UnprocessedItem } from '@/lib/types';
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
import { Download, Search, PackageCheck, PackageX, ArrowUpDown } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import * as XLSX from 'xlsx';

interface ProductTableProps {
  products: ProductDetail[];
  unprocessedItems?: UnprocessedItem[];
}

type SkuSortOrder = 'default' | 'sem_codigo_first' | 'com_codigo_first';


export function ProductTable({ products, unprocessedItems = [] }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [skuSortOrder, setSkuSortOrder] = useState<SkuSortOrder>('default');

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
    const numericValue = parseFloat(String(value).replace(".", "").replace(",", "."));
    if (isNaN(numericValue)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
  };
  
  const handleExportXLSX = () => {
    const dataToExport = filteredAndSortedProducts.map(p => ({
      'SKU': p.sku,
      'Nome do Produto': p.name,
      'Preço de Custo': p.costPrice ? parseFloat(String(p.costPrice).replace(',', '.')) : 0
    }));

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
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportXLSX}>
            <Download className="mr-2 h-4 w-4" />
            Exportar XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
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
                filteredAndSortedProducts.map((product, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrencyForTable(product.costPrice)}</TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                    Nenhum produto encontrado.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}

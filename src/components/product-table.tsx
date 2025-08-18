
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
import { Download, Search, PackageCheck, PackageX } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ProductTableProps {
  products: ProductDetail[];
  unprocessedItems?: UnprocessedItem[];
}

export function ProductTable({ products, unprocessedItems = [] }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');

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

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const lowerCaseSearch = searchTerm.toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(lowerCaseSearch);
      const skuMatch = product.sku?.toLowerCase().includes(lowerCaseSearch);

      const brand = product.name.split(' ')[0];
      const brandMatch = brandFilter === 'all' || brand.toLowerCase() === brandFilter.toLowerCase();
      
      return (nameMatch || skuMatch) && brandMatch;
    });
  }, [products, searchTerm, brandFilter]);

  const notFoundCount = useMemo(() => {
    // Count items from the main list that have 'SEM CÓDIGO' and add items that failed standardization.
    const withoutSku = products.filter(p => p.sku === 'SEM CÓDIGO').length;
    return withoutSku + (unprocessedItems?.length || 0);
  }, [products, unprocessedItems]);

  const foundCount = useMemo(() => {
      return products.length - notFoundCount;
  }, [products, notFoundCount]);
  
  const formatCurrency = (value: string | undefined): string => {
    if (value === undefined || value === null) return 'R$ 0,00';
    // Remove all characters except digits and comma, then replace comma with dot for parsing
    const numericValue = parseFloat(String(value).replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(numericValue)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
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
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nome do Produto (Conforme Banco de Dados)</TableHead>
                <TableHead className="text-right">Preço de Custo</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(product.costPrice)}</TableCell>
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

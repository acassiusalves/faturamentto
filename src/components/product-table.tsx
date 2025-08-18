
"use client";

import type { ProductDetail } from '@/lib/types';
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
import { Download } from 'lucide-react';

interface ProductTableProps {
  products: ProductDetail[];
}

export function ProductTable({ products }: ProductTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
            <CardTitle>Lista de Produtos Detalhada</CardTitle>
            <CardDescription>Navegue, filtre e exporte os dados extraídos da sua lista de produtos.</CardDescription>
        </div>
        <Button variant="outline"><Download className="mr-2"/>Exportar CSV</Button>
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
                {products.length > 0 ? (
                products.map((product, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right font-semibold">{product.costPrice}</TableCell>
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

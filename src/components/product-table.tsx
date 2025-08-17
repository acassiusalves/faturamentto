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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductTableProps {
  products: ProductDetail[];
  brands: string[];
}

export function ProductTable({ products, brands }: ProductTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos Encontrados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Preço Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.length > 0 ? (
                products.map((product, index) => (
                    <TableRow key={index}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono">{product.sku}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">{product.unitPrice}</TableCell>
                    <TableCell className="text-right font-semibold">{product.totalPrice}</TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
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

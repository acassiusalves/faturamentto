"use client";

import type { UnprocessedItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';

interface UnprocessedItemsTableProps {
  items: UnprocessedItem[];
}

export function UnprocessedItemsTable({ items }: UnprocessedItemsTableProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div>
            <CardTitle>Itens Não Processados ({items.length})</CardTitle>
            <CardDescription>
              A IA não conseguiu padronizar ou entender as linhas abaixo. Verifique e tente novamente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Linha Original</TableHead>
                <TableHead>Motivo</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item, index) => (
                <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{item.line}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}

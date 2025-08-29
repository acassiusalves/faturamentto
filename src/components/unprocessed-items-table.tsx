
"use client";

import type { UnprocessedItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface UnprocessedItemsTableProps {
  items: UnprocessedItem[];
}

export function UnprocessedItemsTable({ items }: UnprocessedItemsTableProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-destructive/50">
       <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="p-6 hover:no-underline">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                  <CardTitle className="text-left">Itens Não Processados ({items.length})</CardTitle>
                  <CardDescription className="text-left">
                    A IA não conseguiu padronizar ou entender as linhas abaixo. Clique para ver os detalhes.
                  </CardDescription>
                </div>
              </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

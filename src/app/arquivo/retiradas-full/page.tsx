
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { loadFullRemittanceLogs } from '@/services/firestore';
import type { FullRemittanceLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, History, PackageMinus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RetiradasFullHistoryPage() {
  const { toast } = useToast();

  const [allPicks, setAllPicks] = useState<FullRemittanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFullPicks = useCallback(async () => {
    setIsLoading(true);
    try {
      const picks = await loadFullRemittanceLogs();
      setAllPicks(picks);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Histórico',
        description: 'Não foi possível buscar os registros de retirada.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFullPicks();
  }, [fetchFullPicks]);

  const filteredPicks = useMemo(() => {
    if (!searchTerm) return allPicks;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return allPicks.filter(pick =>
      pick.name?.toLowerCase().includes(lowerCaseSearch) ||
      pick.sku?.toLowerCase().includes(lowerCaseSearch) ||
      pick.eanOrCode?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [allPicks, searchTerm]);

  const groupedPicksByDate = useMemo(() => {
    const groups = new Map<string, FullRemittanceLog[]>();
    filteredPicks.forEach(pick => {
      // Garantir que remittedAt seja uma string antes de usar
      const remittedAtString = typeof pick.remittedAt === 'string' ? pick.remittedAt : new Date(pick.remittedAt).toISOString();
      try {
        const pickedDate = parseISO(remittedAtString);
        const dateKey = format(pickedDate, 'yyyy-MM-dd');
        if (!groups.has(dateKey)) {
          groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(pick);
      } catch (e) {
        console.error("Data de remessa inválida para o item:", pick);
      }
    });
    return Array.from(groups.entries()).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredPicks]);

  const formatDateTime = (dateValue: string | Date) => {
    try {
      const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
       if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "HH:mm:ss");
    } catch {
      return 'Data inválida';
    }
  };
  
  const formatDateOnly = (dateString: string) => {
    try {
        // Adiciona T00:00:00 para tratar a data como local e evitar problemas de fuso
        return format(parseISO(`${dateString}T00:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando histórico de retiradas...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Histórico de Retiradas para o Full</h1>
        <p className="text-muted-foreground">
          Consulte todas as remessas de produtos que foram enviadas para o Fulfillment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2"><History /> Remessas Salvas</CardTitle>
              <CardDescription>
                Exibindo {filteredPicks.length} registros de retirada.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Buscar por produto, SKU ou EAN..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {groupedPicksByDate.length > 0 ? (
             <Accordion type="multiple" className="w-full space-y-4">
                {groupedPicksByDate.map(([date, picks]) => {
                    const totalItems = picks.reduce((acc, p) => acc + p.quantity, 0);
                    const totalCost = picks.reduce((acc, p) => acc + (p.costPrice * p.quantity), 0);
                    return (
                         <AccordionItem key={date} value={date} className="border-b-0">
                             <Card>
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold w-full justify-between">
                                    <span className="text-lg">{formatDateOnly(date)}</span>
                                     <div className="flex items-center gap-4 text-sm font-medium">
                                        <span>Total Itens: <Badge variant="secondary">{totalItems}</Badge></span>
                                        <span>Custo Total: <Badge variant="default">{formatCurrency(totalCost)}</Badge></span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                     <div className="rounded-md border mt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Horário</TableHead>
                                                    <TableHead>Produto</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>EAN/Código</TableHead>
                                                    <TableHead className="text-center">Quantidade</TableHead>
                                                    <TableHead className="text-right">Custo Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {picks.map(pick => (
                                                    <TableRow key={pick.id}>
                                                        <TableCell>{formatDateTime(pick.remittedAt)}</TableCell>
                                                        <TableCell>{pick.name}</TableCell>
                                                        <TableCell><Badge variant="outline">{pick.sku}</Badge></TableCell>
                                                        <TableCell className="font-mono">{pick.eanOrCode}</TableCell>
                                                        <TableCell className="text-center font-bold">{pick.quantity}</TableCell>
                                                        <TableCell className="text-right font-semibold">{formatCurrency(pick.costPrice * pick.quantity)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                     </div>
                                </AccordionContent>
                             </Card>
                         </AccordionItem>
                    )
                })}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 border-2 border-dashed rounded-lg">
              <PackageMinus className="h-16 w-16 mb-4" />
              <p className="font-semibold">Nenhuma retirada encontrada.</p>
              <p className="text-sm">Os registros de retirada para o Fulfillment aparecerão aqui.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

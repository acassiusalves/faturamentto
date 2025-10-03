
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { loadFullRemittanceLogs, deleteFullRemittance } from '@/services/firestore';
import type { FullRemittanceLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, History, PackageMinus, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function RetiradasFullHistoryPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canDelete = useMemo(() => user?.role === 'admin' || user?.role === 'socio', [user]);

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
  
  const handleDeleteRemittance = async (remittanceId: string) => {
    try {
      await deleteFullRemittance(remittanceId);
      toast({
        title: "Remessa Apagada!",
        description: "Os registros desta remessa foram removidos."
      });
      fetchFullPicks(); // Refresh the data
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao Apagar",
        description: "Não foi possível apagar a remessa selecionada."
      });
    }
  };

  const filteredPicks = useMemo(() => {
    if (!searchTerm) return allPicks;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return allPicks.filter(pick =>
      pick.name?.toLowerCase().includes(lowerCaseSearch) ||
      pick.sku?.toLowerCase().includes(lowerCaseSearch) ||
      pick.eanOrCode?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [allPicks, searchTerm]);
  
  const groupedPicksByRemittance = useMemo(() => {
      const groups = new Map<string, FullRemittanceLog[]>();
      filteredPicks.forEach(pick => {
          const remittanceId = pick.remittanceId || `unknown-${pick.id}`;
          if (!groups.has(remittanceId)) {
              groups.set(remittanceId, []);
          }
          groups.get(remittanceId)!.push(pick);
      });
      // Sort groups by the date of the first item in each group, descending
      return Array.from(groups.entries()).sort((a, b) => {
          const dateA = a[1][0]?.remittedAt ? new Date(a[1][0].remittedAt).getTime() : 0;
          const dateB = b[1][0]?.remittedAt ? new Date(b[1][0].remittedAt).getTime() : 0;
          return dateB - dateA;
      });
  }, [filteredPicks]);


  const formatDateTime = (dateValue: string | Date) => {
    try {
      const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
       if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch {
      return 'Data inválida';
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
                Exibindo {groupedPicksByRemittance.length} remessas.
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
          {groupedPicksByRemittance.length > 0 ? (
             <Accordion type="multiple" className="w-full space-y-4">
                {groupedPicksByRemittance.map(([remittanceId, picks]) => {
                    const firstPick = picks[0];
                    if (!firstPick) return null;

                    const totalItems = picks.reduce((acc, p) => acc + p.quantity, 0);
                    const totalCost = picks.reduce((acc, p) => acc + (p.costPrice * p.quantity), 0);
                    return (
                         <AccordionItem key={remittanceId} value={remittanceId} className="border-b-0">
                             <Card>
                                <div className="flex items-center w-full p-4">
                                  <AccordionTrigger className="p-0 hover:no-underline font-semibold flex-1">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-lg">{formatDateTime(firstPick.remittedAt)}</span>
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                          <span>Total Itens: <Badge variant="secondary">{totalItems}</Badge></span>
                                          <span>Custo Total: <Badge variant="default">{formatCurrency(totalCost)}</Badge></span>
                                        </div>
                                    </div>
                                  </AccordionTrigger>
                                  {canDelete && (
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="ml-4 text-destructive hover:text-destructive flex-shrink-0" onClick={e => e.stopPropagation()}>
                                              <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Apagar esta remessa?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Esta ação removerá permanentemente todos os {picks.length} registros desta remessa. Isso NÃO estornará os itens ao estoque. Deseja continuar?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteRemittance(remittanceId)}>Sim, Apagar</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  )}
                                </div>
                                <AccordionContent className="p-4 pt-0">
                                     <div className="rounded-md border mt-2">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
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


"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays, Plus, Minus, Undo } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs, loadEntryLogs } from "@/services/firestore";
import { startOfDay, endOfDay, format, parseISO, isToday, subDays, differenceInDays } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DetailedEntryHistory } from "./detailed-entry-history";
import type { InventoryItem, PickedItemLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface DailyStats {
  initialStock: number;
  entriesToday: number;
  exitsToday: number;
  currentStock: number;
  returnedToday: number;
}

interface DailyHistoryRow {
    date: string;
    initialStock: number;
    entries: number;
    returns: number;
    exits: number;
    finalStock: number;
}

const StatsCard = ({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
);

export function StockConference() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    // CORREÇÃO: Usar loadEntryLogs para o histórico e loadInventoryItems para o estoque atual.
    const [entryLogs, pickingLogs, currentInventory] = await Promise.all([
      loadEntryLogs(),
      loadAllPickingLogs(),
      loadInventoryItems() 
    ]);
    
    const currentStock = currentInventory.length;

    // --- History Calculation (New Logic) ---
    const history: DailyHistoryRow[] = [];
    let rollingStock = currentStock;

    // Calculate for the last 7 days (including today)
    for (let i = 0; i < 7; i++) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        // CORREÇÃO: Calcular entradas e retornos com base no log de entradas (entryLogs)
        const newEntriesOnDate = entryLogs.filter(item => {
            if (!item.createdAt) return false;
            const itemDate = parseISO(item.createdAt);
            const condition = item.condition || 'Novo';
            return itemDate >= dayStart && itemDate <= dayEnd && condition === 'Novo';
        }).length;
        
        const returnsOnDate = entryLogs.filter(item => {
            if (!item.createdAt) return false;
            const itemDate = parseISO(item.createdAt);
            const condition = item.condition; // Não usar padrão 'Novo' aqui
            return itemDate >= dayStart && itemDate <= dayEnd && condition !== 'Novo';
        }).length;

        const exitsOnDate = pickingLogs.filter(log => {
            if (!log.pickedAt) return false;
            const logDate = parseISO(log.pickedAt);
            return logDate >= dayStart && logDate <= dayEnd;
        }).length;
        
        const finalStock = rollingStock;
        const totalEntriesOnDate = newEntriesOnDate + returnsOnDate;
        const initialStock = finalStock - totalEntriesOnDate + exitsOnDate;
        
        history.push({
            date: format(date, "dd/MM/yyyy"),
            initialStock,
            entries: newEntriesOnDate,
            returns: returnsOnDate,
            exits: exitsOnDate,
            finalStock,
        });

        rollingStock = initialStock;
    }
    
    const finalHistory = history.reverse();
    setDailyHistory(finalHistory);
    
    // --- Daily Stats Calculation ---
    const todayHistory = finalHistory.find(h => h.date === format(new Date(), "dd/MM/yyyy"));
    
    setStats({
      initialStock: todayHistory?.initialStock || 0,
      entriesToday: todayHistory?.entries || 0,
      returnedToday: todayHistory?.returns || 0,
      exitsToday: todayHistory?.exits || 0,
      currentStock: currentStock,
    });
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="ml-4">Calculando indicadores de estoque...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Resumo do Estoque de Hoje</h2>
                    <p className="text-muted-foreground">Visão geral da movimentação de estoque no dia atual.</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatsCard title="Estoque Inicial do dia (TOTAL)" value={stats.initialStock} icon={Warehouse} />
                <StatsCard title="Entradas (Novo)" value={stats.entriesToday} icon={ArrowDownToDot} />
                <StatsCard title="Retornos (Lacrado/Seminovo/Usado)" value={stats.returnedToday} icon={Undo} />
                <StatsCard title="Saidas do dia (TOTAL)" value={stats.exitsToday} icon={ArrowUpFromDot} />
                <StatsCard title="Estoque atual (TOTAL)" value={stats.currentStock} icon={Boxes} />
            </div>
        </div>
        
        <Separator />

        <Card>
            <CardHeader>
                <CardTitle>Histórico de Atividades do Estoque</CardTitle>
                <CardDescription>Analise diário da movimentação de produtos.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Estoque Inicial</TableHead>
                                <TableHead>Entradas (Novo)</TableHead>
                                <TableHead>Retornos</TableHead>
                                <TableHead>Saídas</TableHead>
                                <TableHead>Estoque Final</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dailyHistory.map(row => (
                                <TableRow key={row.date}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                                        {row.date}
                                    </TableCell>
                                    <TableCell>{row.initialStock}</TableCell>
                                    <TableCell>
                                        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                                            <Plus className="mr-1 h-3 w-3" />
                                            {row.entries}
                                        </Badge>
                                    </TableCell>
                                     <TableCell>
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                            <Undo className="mr-1 h-3 w-3" />
                                            {row.returns}
                                        </Badge>
                                    </TableCell>
                                     <TableCell>
                                        <Badge variant="destructive">
                                            <Minus className="mr-1 h-3 w-3" />
                                            {row.exits}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-bold">{row.finalStock}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
        
        <Separator />
        
        <DetailedEntryHistory /> 
    </div>
  );
}

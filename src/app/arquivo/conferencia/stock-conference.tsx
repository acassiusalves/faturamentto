
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays, Plus, Minus } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs } from "@/services/firestore";
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
}

interface DailyHistoryRow {
    date: string;
    initialStock: number;
    entries: number;
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
    
    const [inventoryItems, pickingLogs] = await Promise.all([
      loadInventoryItems(),
      loadAllPickingLogs()
    ]);

    // Calculate Today's Stats
    const entriesToday = inventoryItems.filter(item => isToday(parseISO(item.createdAt))).length;
    const exitsToday = pickingLogs.filter(log => isToday(parseISO(log.pickedAt))).length;
    const currentStock = inventoryItems.length;
    const initialStockToday = currentStock - entriesToday + exitsToday;

    setStats({
      initialStock: initialStockToday,
      entriesToday,
      exitsToday,
      currentStock,
    });

    // Calculate Daily History for the last 7 days
    const history: DailyHistoryRow[] = [];
    let rollingStock = currentStock;

    for (let i = 0; i < 7; i++) {
        const date = subDays(new Date(), i);
        
        const entriesOnDate = inventoryItems.filter(item => isToday(parseISO(item.createdAt), date)).length;
        const exitsOnDate = pickingLogs.filter(log => isToday(parseISO(log.pickedAt), date)).length;
        
        const finalStock = rollingStock;
        const initialStock = finalStock - entriesOnDate + exitsOnDate;
        
        history.push({
            date: format(date, "dd/MM/yyyy"),
            initialStock,
            entries: entriesOnDate,
            exits: exitsOnDate,
            finalStock,
        });

        rollingStock = initialStock;
    }
    setDailyHistory(history);
    
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Estoque Inicial do Dia" value={stats.initialStock} icon={Warehouse} />
                <StatsCard title="Entradas no Dia" value={stats.entriesToday} icon={ArrowDownToDot} />
                <StatsCard title="Saídas no Dia" value={stats.exitsToday} icon={ArrowUpFromDot} />
                <StatsCard title="Estoque Atual" value={stats.currentStock} icon={Boxes} />
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
                                <TableHead>Entradas</TableHead>
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

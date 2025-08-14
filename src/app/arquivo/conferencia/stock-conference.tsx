
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs } from "@/services/firestore";
import { startOfDay, endOfDay, format, parseISO, startOfToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

interface DailyStats {
  initialStock: number;
  entriesToday: number;
  exitsToday: number;
  currentStock: number;
}

interface HistoricalData {
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
  const [history, setHistory] = useState<HistoricalData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    const [inventoryItems, pickingLogs] = await Promise.all([
      loadInventoryItems(),
      loadAllPickingLogs()
    ]);

    const todayStart = startOfDay(new Date());

    const entriesToday = inventoryItems.filter(item => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= todayStart;
    }).length;

    const exitsToday = pickingLogs.filter(log => {
      const pickedAt = new Date(log.pickedAt);
      return pickedAt >= todayStart;
    }).length;

    const currentStock = inventoryItems.length;
    
    const initialStockToday = currentStock - entriesToday + exitsToday;

    setStats({
      initialStock: initialStockToday,
      entriesToday,
      exitsToday,
      currentStock,
    });
    
    // --- History Calculation ---
    const entriesByDate: Record<string, number> = {};
    inventoryItems.forEach(item => {
        const date = format(parseISO(item.createdAt), 'yyyy-MM-dd');
        entriesByDate[date] = (entriesByDate[date] || 0) + 1;
    });

    const exitsByDate: Record<string, number> = {};
    pickingLogs.forEach(log => {
        const date = format(parseISO(log.pickedAt), 'yyyy-MM-dd');
        exitsByDate[date] = (exitsByDate[date] || 0) + 1;
    });
    
    const allDates = [...Object.keys(entriesByDate), ...Object.keys(exitsByDate)];
    const uniqueDates = [...new Set(allDates)].sort((a,b) => new Date(b).getTime() - new Date(a).getTime());

    let runningStock = currentStock;
    const historicalRecords: HistoricalData[] = [];

    uniqueDates.forEach(dateStr => {
        const entries = entriesByDate[dateStr] || 0;
        const exits = exitsByDate[dateStr] || 0;
        const finalStock = runningStock;
        const initialStock = finalStock - entries + exits;
        
        historicalRecords.push({
            date: format(new Date(dateStr), 'dd/MM/yyyy'),
            initialStock,
            entries,
            exits,
            finalStock
        });
        
        runningStock = initialStock;
    });

    setHistory(historicalRecords);
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
        
        <div className="space-y-4">
             <div>
                <h2 className="text-2xl font-bold">Histórico de Atividades do Estoque</h2>
                <p className="text-muted-foreground">Análise diária da movimentação de produtos.</p>
            </div>
             <Card>
                <CardContent className="p-0">
                    <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                             <TableHeader className="sticky top-0 bg-card">
                                <TableRow>
                                    <TableHead className="w-[150px]">Data</TableHead>
                                    <TableHead className="text-center">Estoque Inicial</TableHead>
                                    <TableHead className="text-center">Entradas</TableHead>
                                    <TableHead className="text-center">Saídas</TableHead>
                                    <TableHead className="text-center">Estoque Final</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.length > 0 ? history.map(item => (
                                    <TableRow key={item.date}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                            {item.date}
                                        </TableCell>
                                        <TableCell className="text-center">{item.initialStock}</TableCell>
                                        <TableCell className="text-center text-green-600 font-semibold">+{item.entries}</TableCell>
                                        <TableCell className="text-center text-destructive font-semibold">-{item.exits}</TableCell>
                                        <TableCell className="text-center font-bold text-primary">{item.finalStock}</TableCell>
                                    </TableRow>
                                )) : (
                                     <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">Nenhuma atividade histórica encontrada.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
             </Card>
        </div>
    </div>
  );
}

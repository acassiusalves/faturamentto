
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays, Plus, Minus, Undo } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs, loadEntryLogs } from "@/services/firestore";
import { startOfDay, endOfDay, format, parseISO, isToday, subDays } from "date-fns";
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
    
    const [entryLogs, pickingLogs, currentInventory] = await Promise.all([
      loadEntryLogs(),
      loadAllPickingLogs(),
      loadInventoryItems() 
    ]);
    
    const currentStock = currentInventory.length;

    // --- History Calculation (from current stock backwards) ---
    const history: DailyHistoryRow[] = [];
    let rollingStock = currentStock;

    // Calculate for the last 7 days, starting from yesterday (i=1) up to 7 days ago
    for (let i = 1; i <= 7; i++) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        const newEntriesOnDate = entryLogs.filter(item => {
            if (!item.createdAt) return false;
            const itemDate = parseISO(item.createdAt);
            const condition = item.condition || 'Novo';
            return itemDate >= dayStart && itemDate <= dayEnd && condition === 'Novo';
        }).length;
        
        const returnsOnDate = entryLogs.filter(item => {
            if (!item.createdAt) return false;
            const itemDate = parseISO(item.createdAt);
            const condition = item.condition;
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
    
    // --- Daily Stats Calculation ---
    const yesterdayHistory = finalHistory.find(h => h.date === format(subDays(new Date(), 1), "dd/MM/yyyy"));
    const initialStockForToday = yesterdayHistory ? yesterdayHistory.finalStock : (currentStock - (entryLogs.filter(item => isToday(parseISO(item.createdAt))).length - pickingLogs.filter(log => isToday(parseISO(log.pickedAt))).length));


    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const entriesToday = entryLogs.filter(item => {
        if (!item.createdAt) return false;
        const itemDate = parseISO(item.createdAt);
        const condition = item.condition || 'Novo';
        return itemDate >= todayStart && itemDate <= todayEnd && condition === 'Novo';
    }).length;

    const returnedToday = entryLogs.filter(item => {
        if (!item.createdAt) return false;
        const itemDate = parseISO(item.createdAt);
        const condition = item.condition;
        return itemDate >= todayStart && itemDate <= todayEnd && condition !== 'Novo';
    }).length;
    
    const exitsToday = pickingLogs.filter(log => {
        if (!log.pickedAt) return false;
        const logDate = parseISO(log.pickedAt);
        return logDate >= todayStart && logDate <= todayEnd;
    }).length;

    const todayFinalStock = initialStockForToday + entriesToday + returnedToday - exitsToday;

    const todayHistoryEntry: DailyHistoryRow = {
        date: format(new Date(), "dd/MM/yyyy"),
        initialStock: initialStockForToday,
        entries: entriesToday,
        returns: returnedToday,
        exits: exitsToday,
        finalStock: todayFinalStock,
    };
    
    setDailyHistory([...finalHistory, todayHistoryEntry].slice(-7));
    
    setStats({
      initialStock: initialStockForToday,
      entriesToday: entriesToday,
      returnedToday: returnedToday,
      exitsToday: exitsToday,
      currentStock: currentStock, // This remains the real-time count
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Entradas (Novo)" value={stats.entriesToday} icon={ArrowDownToDot} />
                <StatsCard title="Retornos (Lacrado/Seminovo/Usado)" value={stats.returnedToday} icon={Undo} />
                <StatsCard title="Saidas do dia (TOTAL)" value={stats.exitsToday} icon={ArrowUpFromDot} />
                <StatsCard title="Estoque atual (TOTAL)" value={stats.currentStock} icon={Boxes} />
            </div>
        </div>
        
        <Separator />
        
        <DetailedEntryHistory /> 
    </div>
  );
}

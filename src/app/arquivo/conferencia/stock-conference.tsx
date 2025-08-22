
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays, Plus, Minus, Undo, AlertTriangle } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs, loadEntryLogs, loadInitialStockForToday } from "@/services/firestore";
import { startOfDay, endOfDay, format, parseISO, isToday, subDays } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DetailedEntryHistory } from "./detailed-entry-history";
import type { InventoryItem, PickedItemLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface Stats {
    entries: Record<string, number>;
    exits: Record<string, number>;
    currentStock: Record<string, number>;
    initialStock: number;
}

const SummaryCard = ({ title, data }: { title: string, data: Record<string, number> }) => {
    const total = useMemo(() => Object.values(data).reduce((acc, count) => acc + count, 0), [data]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle>{title}</CardTitle>
                <div className="text-sm font-semibold text-muted-foreground">
                    Total {total}
                </div>
            </CardHeader>
            <CardContent>
                {Object.keys(data).length > 0 ? (
                    <ul className="space-y-2">
                        {Object.entries(data).map(([condition, count]) => (
                            <li key={condition} className="flex justify-between items-center text-lg">
                                <span className="font-medium text-muted-foreground">{condition}</span>
                                <span className="font-bold text-primary">{count}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-center text-sm py-4">Nenhum item hoje.</p>
                )}
            </CardContent>
        </Card>
    );
};

export function StockConference() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    const [entryLogs, pickingLogs, currentInventory, initialStock] = await Promise.all([
      loadEntryLogs(),
      loadAllPickingLogs(),
      loadInventoryItems(),
      loadInitialStockForToday(),
    ]);

    const todayStart = startOfDay(new Date());

    const entriesToday = entryLogs
      .filter(item => item.createdAt && new Date(item.createdAt) >= todayStart)
      .reduce((acc, item) => {
        const condition = item.condition || 'Novo';
        acc[condition] = (acc[condition] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
    const exitsToday = pickingLogs
      .filter(log => log.pickedAt && new Date(log.pickedAt) >= todayStart)
      .reduce((acc, log) => {
          // Assume 'Novo' if condition is missing, which is common for older picked items.
          const condition = log.condition || 'Novo';
          acc[condition] = (acc[condition] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);

    const currentStockSummary = currentInventory.reduce((acc, item) => {
      const condition = item.condition || 'Novo';
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    
    setStats({
      entries: entriesToday,
      exits: exitsToday,
      currentStock: currentStockSummary,
      initialStock,
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
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold font-headline">Resumo do Estoque de Hoje</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 font-semibold text-muted-foreground bg-muted/50 p-2 rounded-md">
                        <AlertTriangle className="h-5 w-5 text-amber-500"/>
                        Estoque Inicial {stats.initialStock}
                    </div>
                    <Button onClick={fetchData} variant="outline" disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard title="Entradas" data={stats.entries} />
                <SummaryCard title="Saídas" data={stats.exits} />
                <SummaryCard title="Estoque Atual" data={stats.currentStock} />
            </div>
        </div>

      <DetailedEntryHistory />
    </div>
  );
}

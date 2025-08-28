
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
import type { InventoryItem, PickedItemLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface Stats {
    entries: number;
    exits: number;
    currentStock: number;
    initialStock: number;
}

const SummaryCard = ({ title, value, icon: Icon }: { title: string, value: number, icon: React.ElementType }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

export function StockConference() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    const todayRange = { from: startOfDay(new Date()), to: endOfDay(new Date()) };
    
    const [entryLogsToday, pickingLogs, currentInventory, initialStock] = await Promise.all([
      loadEntryLogs(todayRange),
      loadAllPickingLogs(),
      loadInventoryItems(),
      loadInitialStockForToday(),
    ]);

    const toDate = (x:any) => typeof x?.toDate==="function" ? x.toDate() : new Date(x);

    const exitsToday = pickingLogs
      .filter(log => log.pickedAt && toDate(log.pickedAt) >= todayRange.from)
      .reduce((acc, log) => acc + (log.quantity || 1), 0);

    const currentStockTotal = currentInventory.reduce((acc, item) => acc + (item.quantity || 1), 0);

    setStats({
      entries: entryLogsToday.length,
      exits: exitsToday,
      currentStock: currentStockTotal,
      initialStock,
    });
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
        if (localStorage.getItem('stockDataDirty') === 'true') {
            fetchData();
            localStorage.removeItem('stockDataDirty');
        }
    };
    fetchData();
    window.addEventListener('focus', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('focus', handleStorageChange);
        window.removeEventListener('storage', handleStorageChange);
    };
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
                <SummaryCard title="Entradas" value={stats.entries} icon={ArrowDownToDot} />
                <SummaryCard title="Saídas" value={stats.exits} icon={ArrowUpFromDot} />
                <SummaryCard title="Estoque Atual" value={stats.currentStock} icon={Boxes} />
            </div>
        </div>
    </div>
  );
}

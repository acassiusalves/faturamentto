
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToDot, ArrowUpFromDot, Boxes, Warehouse, Loader2, RefreshCw, CalendarDays } from "lucide-react";
import { loadInventoryItems, loadAllPickingLogs } from "@/services/firestore";
import { startOfDay, endOfDay, format, parseISO, startOfToday, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { DetailedEntryHistory } from "./detailed-entry-history"; // Import the new component

interface DailyStats {
  initialStock: number;
  entriesToday: number;
  exitsToday: number;
  currentStock: number;
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    const [inventoryItems, pickingLogs] = await Promise.all([
      loadInventoryItems(),
      loadAllPickingLogs()
    ]);

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
        
        {/* Replace the old history table with the new detailed entry history component */}
        <DetailedEntryHistory /> 
    </div>
  );
}

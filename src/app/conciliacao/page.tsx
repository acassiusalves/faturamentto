
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { Loader2, DollarSign, FileSpreadsheet, Percent, Link, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { loadSales } from '@/services/firestore';
import type { Sale } from '@/lib/types';
import { SalesTable } from '@/components/sales-table'; // Reutilizando a tabela de vendas

export default function ConciliationPage() {
    const router = useRouter();
    const [sales, setSales] = useState<Sale[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const salesData = await loadSales();
            setSales(salesData);
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const filteredSales = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        return sales.filter(sale => {
            try {
                const saleDate = new Date((sale as any).payment_approved_date);
                return saleDate >= dateRange.from! && saleDate <= dateRange.to!;
            } catch {
                return false;
            }
        });
    }, [sales, dateRange]);

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const calculateNetRevenue = (sale: Sale): number => {
        const baseProfit = (sale as any).left_over || 0;
        const manuallyAddedCosts = sale.costs?.reduce((acc, cost) => {
            const costValue = cost.isPercentage ? (((sale as any).value_with_shipping || 0) * cost.value) / 100 : cost.value;
            return acc + costValue;
        }, 0) || 0;
        return baseProfit - manuallyAddedCosts;
    };
    
    const calculateTotalCost = (sale: Sale): number => {
        return 0; // Placeholder
    };
    
    const updateSaleCosts = (saleId: string, newCosts: Sale['costs']) => {
        // Placeholder
    };


    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin" />
                <p className="ml-2">Carregando dados de vendas...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Conciliação de Vendas</h1>
                <p className="text-muted-foreground">
                    Analise suas vendas, adicione custos e encontre o lucro líquido de cada operação.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Seleção de Período</CardTitle>
                    <CardDescription>Filtre as vendas que você deseja analisar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </CardContent>
            </Card>

            <SalesTable
              data={filteredSales}
              onUpdateSaleCosts={updateSaleCosts}
              calculateTotalCost={calculateTotalCost}
              calculateNetRevenue={calculateNetRevenue}
              formatCurrency={formatCurrency}
              isLoading={isLoading}
            />

        </div>
    );
}

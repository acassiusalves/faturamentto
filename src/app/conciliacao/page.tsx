
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, setMonth, getYear } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Loader2, DollarSign, FileSpreadsheet, Percent, Link, Target, Settings } from 'lucide-react';
import type { Sale, SupportData } from '@/lib/types';
import { SalesTable } from '@/components/sales-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadSales, loadMonthlySupportData } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { SupportDataDialog } from '@/components/support-data-dialog';

// Helper to generate months
const getMonths = () => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: new Date(0, i).toLocaleString('pt-BR', { month: 'long' })
    }));
};

export default function ConciliationPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [supportData, setSupportData] = useState<SupportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>();
    const [isSupportDataOpen, setIsSupportDataOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const salesData = await loadSales();
            setSales(salesData);
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const getMonthYearKey = () => {
        if (!dateRange?.from) return "";
        const year = getYear(dateRange.from);
        const month = (dateRange.from.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    useEffect(() => {
        const monthNumber = parseInt(selectedMonth, 10);
        if (!isNaN(monthNumber)) {
            const currentYear = getYear(new Date());
            const targetDate = setMonth(new Date(currentYear, 0, 1), monthNumber);
            setDateRange({
                from: startOfMonth(targetDate),
                to: endOfMonth(targetDate),
            });
        }
    }, [selectedMonth]);

    useEffect(() => {
        const monthYear = getMonthYearKey();
        if (monthYear) {
            loadMonthlySupportData(monthYear).then(data => {
                setSupportData(data);
                // TODO: Add logic here to merge support data with sales data.
            });
        }
    }, [dateRange]);


    const filteredSales = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        let processedSales = sales;

        // TODO: This is where we will merge the supportData into the sales data.
        if (supportData) {
           // console.log("Dados de apoio para o mês:", supportData);
        }

        return processedSales.filter(sale => {
            try {
                const saleDate = new Date((sale as any).payment_approved_date);
                return saleDate >= dateRange.from! && saleDate <= dateRange.to!;
            } catch {
                return false;
            }
        });
    }, [sales, dateRange, supportData]);

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

    const handleOpenSupportData = () => {
        setIsSupportDataOpen(true);
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
        <>
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Conciliação de Vendas</h1>
                <p className="text-muted-foreground">
                    Analise suas vendas, adicione custos e encontre o lucro líquido de cada operação.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Seleção de Período</CardTitle>
                            <CardDescription>Filtre as vendas que você deseja analisar selecionando o mês.</CardDescription>
                        </div>
                        <Button variant="outline" onClick={handleOpenSupportData}>
                            <Settings className="mr-2 h-4 w-4" />
                            Dados de Apoio
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Selecione um mês" />
                        </SelectTrigger>
                        <SelectContent>
                            {getMonths().map(month => (
                                <SelectItem key={month.value} value={month.value}>
                                    {month.label.charAt(0).toUpperCase() + month.label.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
        
        <SupportDataDialog
            isOpen={isSupportDataOpen}
            onClose={() => setIsSupportDataOpen(false)}
            monthYearKey={getMonthYearKey()}
        />
        </>
    );
}

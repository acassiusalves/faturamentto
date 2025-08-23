
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Sale } from '@/lib/types';
import { loadSales } from '@/services/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Store, Crown, TrendingUp } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, startOfDay, endOfDay as dateFnsEndOfDay } from "date-fns";
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

// Define the structure for our processed data
interface ProductRank {
  sku: string;
  name: string;
  quantity: number;
  totalValue: number;
  image?: string;
}

interface AccountAnalysis {
  accountName: string;
  totalSalesValue: number;
  totalSalesCount: number;
  topProducts: ProductRank[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const AccountCard = ({ data }: { data: AccountAnalysis }) => (
    <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Store className="h-6 w-6 text-primary" />
                        {data.accountName}
                    </CardTitle>
                    <CardDescription>{data.totalSalesCount} vendas no período</CardDescription>
                </div>
                 <div className="text-right">
                    <p className="text-xs text-muted-foreground">Faturamento Total</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(data.totalSalesValue)}</p>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <h4 className="mb-4 font-semibold text-center">Top 5 Produtos Mais Vendidos</h4>
            {data.topProducts.length > 0 ? (
                <div className="space-y-4">
                    {data.topProducts.map((product, index) => (
                        <div key={product.sku} className="flex items-center gap-4 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                             <div className="flex items-center justify-center font-bold text-lg w-8 h-8 rounded-full bg-muted text-muted-foreground">
                                {index === 0 ? <Crown className="text-amber-500"/> : index + 1}
                            </div>
                            <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                <Image 
                                    src={product.image || 'https://placehold.co/100x100.png'} 
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                    data-ai-hint="product image"
                                />
                            </div>
                            <div className="flex-grow">
                                <p className="font-semibold text-sm leading-tight truncate" title={product.name}>{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="font-bold text-primary">{formatCurrency(product.totalValue)}</p>
                                <p className="text-xs text-muted-foreground">{product.quantity} unidade(s)</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda de produto encontrada para esta conta no período.</p>
            )}
        </CardContent>
    </Card>
);

export default function AccountAnalysisPage() {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const salesData = await loadSales();
      setAllSales(salesData);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const analysisData = useMemo(() => {
    if (!allSales || allSales.length === 0) return [];
    
    // 1. Filter sales by date range
    const filteredSales = allSales.filter(sale => {
        if (!dateRange?.from) return true;
        try {
            const saleDate = new Date((sale as any).payment_approved_date);
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? dateFnsEndOfDay(dateRange.to) : dateFnsEndOfDay(dateRange.from);
            return saleDate >= fromDate && saleDate <= toDate;
        } catch { return false; }
    });

    // 2. Group sales by account
    const salesByAccount = filteredSales.reduce((acc, sale) => {
        const accountName = (sale as any).auth_name || 'Desconhecida';
        if (!acc[accountName]) {
            acc[accountName] = [];
        }
        acc[accountName].push(sale);
        return acc;
    }, {} as Record<string, Sale[]>);

    // 3. Process each account
    const processedData = Object.entries(salesByAccount).map(([accountName, sales]) => {
        const totalSalesValue = sales.reduce((sum, s) => sum + ((s as any).value_with_shipping || 0), 0);
        const totalSalesCount = sales.length;

        const productsMap = sales.reduce((acc, s) => {
            const sku = (s as any).item_sku || 'N/A';
            const name = (s as any).item_title || 'Produto Desconhecido';
            const quantity = (s as any).item_quantity || 0;
            const value = (s as any).value_with_shipping || 0;
            const image = (s as any).item_image;

            if (!acc[sku]) {
                acc[sku] = { sku, name, quantity: 0, totalValue: 0, image };
            }
            acc[sku].quantity += quantity;
            acc[sku].totalValue += value;
            return acc;
        }, {} as Record<string, ProductRank>);

        const topProducts = Object.values(productsMap)
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 5);

        return { accountName, totalSalesValue, totalSalesCount, topProducts };
    });

    // 4. Sort accounts by total sales value
    return processedData.sort((a, b) => b.totalSalesValue - a.totalSalesValue);

  }, [allSales, dateRange]);
  

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="ml-4">Carregando dados de vendas...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Análise por Conta</h1>
        <p className="text-muted-foreground">
          Veja o desempenho de cada conta, incluindo os produtos mais vendidos por valor.
        </p>
      </div>

       <Card>
            <CardHeader>
                <CardTitle>Filtro por Período</CardTitle>
                <CardDescription>Selecione o intervalo de datas que você deseja analisar.</CardDescription>
            </CardHeader>
            <CardContent>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </CardContent>
        </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {analysisData.length > 0 ? (
            analysisData.map(accountData => (
                <AccountCard key={accountData.accountName} data={accountData} />
            ))
        ) : (
            <div className="col-span-full text-center text-muted-foreground py-16">
                <TrendingUp className="h-16 w-16 mx-auto mb-4" />
                <p>Nenhuma venda encontrada para o período selecionado.</p>
            </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { loadSales, loadCompanyCosts, loadAllPickingLogs } from '@/services/firestore';
import type { Sale, CompanyCost, PickedItemLog } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Loader2, DollarSign, TrendingDown, TrendingUp, HandCoins, Landmark, Calculator, ArrowRight, Wallet, Percent, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface DRELineProps {
  label: string;
  value: number | string;
  isTotal?: boolean;
  isNegative?: boolean;
  isPositive?: boolean;
  isPercentage?: boolean;
  description?: string;
  level?: 1 | 2 | 3;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const DRELine = ({ label, value, isTotal, isNegative, isPositive, isPercentage, description, level = 1 }: DRELineProps) => {
  const formattedValue = typeof value === 'number' ? formatCurrency(value) : value;

  const getLevelStyles = () => {
      switch (level) {
          case 1: return "py-3";
          case 2: return "py-2 pl-4";
          case 3: return "py-1 pl-8 text-sm";
      }
  };

  const getValueColor = () => {
    if (isPositive) return 'text-green-600';
    if (isNegative) return 'text-destructive';
    if (!isTotal) return 'text-muted-foreground';
    return 'text-foreground';
  }

  return (
    <div className={`flex justify-between items-center ${getLevelStyles()}`}>
      <div className="flex flex-col">
        <span className={`font-medium ${isTotal ? 'font-bold' : ''}`}>{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <span className={`font-mono font-semibold ${getValueColor()} ${isTotal ? 'text-lg' : ''}`}>
        {isPercentage && typeof value === 'number' ? `${value.toFixed(2)}%` : formattedValue}
      </span>
    </div>
  );
};


export default function DREPage() {
    const router = useRouter();
    const [sales, setSales] = useState<Sale[]>([]);
    const [costs, setCosts] = useState<{ fixed: CompanyCost[]; variable: CompanyCost[] } | null>(null);
    const [pickingLogs, setPickingLogs] = useState<PickedItemLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const [salesData, costsData, logsData] = await Promise.all([
                loadSales(),
                loadCompanyCosts(),
                loadAllPickingLogs(),
            ]);
            setSales(salesData);
            setCosts(costsData);
            setPickingLogs(logsData);
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
    
    const filteredPickingLogs = useMemo(() => {
        const saleOrderNumbers = new Set(filteredSales.map(s => (s as any).order_code));
        return pickingLogs.filter(log => saleOrderNumbers.has(log.orderNumber));
    }, [pickingLogs, filteredSales]);

    const dreData = useMemo(() => {
        const receitaBruta = filteredSales.reduce((acc, sale) => acc + ((sale as any).value_with_shipping || 0), 0);
        
        const deducoes = filteredSales.reduce((acc, sale) => {
          const comissao = (sale as any).fee_order || 0;
          const frete = (sale as any).fee_shipment || 0;
          return acc + comissao + frete;
        }, 0);
        
        const receitaLiquida = receitaBruta - deducoes;
        
        const cmv = filteredPickingLogs.reduce((acc, log) => acc + log.costPrice, 0);
        
        const lucroBruto = receitaLiquida - cmv;
        
        const despesasFixas = costs?.fixed.reduce((acc, cost) => acc + cost.value, 0) || 0;
        const despesasVariaveis = costs?.variable.reduce((acc, cost) => acc + cost.value, 0) || 0;
        const despesasOperacionais = despesasFixas + despesasVariaveis;
        
        const lucroLiquido = lucroBruto - despesasOperacionais;

        return {
            receitaBruta,
            deducoes,
            receitaLiquida,
            cmv,
            lucroBruto,
            despesasFixas,
            despesasVariaveis,
            despesasOperacionais,
            lucroLiquido,
            lucratividade: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0,
        };
    }, [filteredSales, costs, filteredPickingLogs]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin" />
                <p className="ml-2">Calculando DRE...</p>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">DRE - Demonstrativo de Resultados</h1>
                <p className="text-muted-foreground">
                    Analise a saúde financeira do seu negócio para o período selecionado.
                </p>
            </div>

            <Card className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4">
                <CardHeader>
                    <CardTitle>Selecione o Período</CardTitle>
                </CardHeader>
                <CardContent>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-8 items-start">
                <div className="md:col-span-2 space-y-4">
                     <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <FileText className="h-6 w-6 text-primary" />
                                <div>
                                    <CardTitle>Demonstrativo de Resultados</CardTitle>
                                    <CardDescription>Período de {dateRange?.from?.toLocaleDateString('pt-BR')} a {dateRange?.to?.toLocaleDateString('pt-BR')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="divide-y">
                           <DRELine label="(=) Receita Operacional Bruta" value={dreData.receitaBruta} isTotal level={1} />
                           <DRELine label="(-) Deduções (Comissão + Frete)" value={dreData.deducoes * -1} level={2} />
                           <DRELine label="(=) Receita Operacional Líquida" value={dreData.receitaLiquida} isTotal level={1} />
                           <DRELine label="(-) Custo da Mercadoria Vendida (CMV)" value={dreData.cmv * -1} level={2} description={`${filteredPickingLogs.length} itens vendidos`} />
                           <DRELine label="(=) Lucro Bruto" value={dreData.lucroBruto} isTotal level={1} isPositive={dreData.lucroBruto > 0} isNegative={dreData.lucroBruto < 0}/>
                           <DRELine label="(-) Despesas Operacionais" value={dreData.despesasOperacionais * -1} level={2}/>
                           <DRELine label="Custos Fixos" value={dreData.despesasFixas * -1} level={3} />
                           <DRELine label="Custos Variáveis" value={dreData.despesasVariaveis * -1} level={3} />
                           <DRELine label="(=) Lucro Líquido" value={dreData.lucroLiquido} isTotal level={1} isPositive={dreData.lucroLiquido > 0} isNegative={dreData.lucroLiquido < 0} />
                        </CardContent>
                     </Card>
                </div>

                <div className="md:col-span-1 space-y-4">
                    <Card>
                        <CardHeader>
                           <CardTitle>Resumo e Indicadores</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                            <div className="flex justify-between items-center p-3 rounded-md border bg-card">
                                <span className="text-sm font-semibold">Lucro Líquido Final</span>
                                <span className={`font-bold text-xl ${dreData.lucroLiquido > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                    {formatCurrency(dreData.lucroLiquido)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-md border bg-card">
                                <span className="text-sm font-semibold">Lucratividade</span>
                                <span className={`font-bold text-xl ${dreData.lucratividade > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                    {dreData.lucratividade.toFixed(2)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                           <CardTitle>Gerenciar Custos</CardTitle>
                           <CardDescription>Vá para a página de custos para editar os valores fixos e variáveis.</CardDescription>
                        </CardHeader>
                         <CardContent>
                             <Button onClick={() => router.push('/custos-geral')} className="w-full">
                                Editar Custos
                             </Button>
                         </CardContent>
                     </Card>
                </div>
            </div>
        </div>
    );
}

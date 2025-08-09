"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { DollarSign, TrendingDown, TrendingUp, Search, Filter, FileDown, Sheet, AlertCircle, Loader2, RefreshCw, CalendarCheck } from "lucide-react";
import { startOfMonth, endOfMonth, isSameDay } from "date-fns";

import type { Sale, Cost } from "@/lib/types";
import { SalesTable } from "@/components/sales-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSales, loadSales } from "@/lib/mock-services";
import { Badge } from "./ui/badge";


function StatsCard({ title, value, icon: Icon, description }: { title: string; value: string; icon: React.ElementType; description?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

interface SalesDashboardProps {
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

export function SalesDashboard({ isSyncing, lastSyncTime }: SalesDashboardProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Set the date range to the current month when the component mounts
    setDateRange({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
  }, []);

  useEffect(() => {
    async function loadInitialData() {
        setIsLoading(true);
        const storedSales = await loadSales();
        setSales(storedSales);
        setIsLoading(false);
    }
    loadInitialData();
  }, []);

  const calculateTotalCost = useCallback((sale: Sale): number => {
    let total = 0;
    if (sale.totalCost) { // Custo vindo da planilha
        total += sale.totalCost;
    }
    // Custos adicionados manualmente
    sale.costs.forEach(cost => {
      const costValue = cost.isPercentage ? (sale.grossRevenue * cost.value) / 100 : cost.value;
      total += costValue;
    });
    return total;
  }, []);
  
  const calculateNetRevenue = useCallback((sale: Sale): number => {
      const totalAddedCost = sale.costs.reduce((acc, cost) => {
        const costValue = cost.isPercentage ? (sale.grossRevenue * cost.value) / 100 : cost.value;
        return acc + costValue;
      }, 0);
      
      // Ideris provides 'leftOver' which is essentially the profit from their side.
      const baseProfit = (sale as any).left_over || 0;

      return baseProfit - totalAddedCost;

  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
        if(dateRange?.from && dateRange?.to) {
            try {
                // The date from Ideris is payment_approved_date
                const saleDateStr = (sale as any).payment_approved_date;
                if (!saleDateStr) return false;

                const saleDate = new Date(saleDateStr);
                // Set hours to 0 to compare dates only
                const fromDate = new Date(dateRange.from);
                fromDate.setHours(0, 0, 0, 0);
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);

                if (saleDate < fromDate || saleDate > toDate) {
                    return false;
                }
            } catch(e) {
                console.error("Invalid date format for sale", sale);
                return false;
            }
        }

      const matchesMarketplace = marketplace === "all" || (sale as any).marketplace_name?.toLowerCase() === marketplace.toLowerCase();
      const matchesState = stateFilter === "all" || (sale as any).state_name === stateFilter;
      const matchesAccount = accountFilter === "all" || (sale as any).auth_name === accountFilter;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === "" ||
        (sale as any).item_sku?.toLowerCase().includes(lowerSearchTerm) ||
        (sale as any).order_code?.toLowerCase().includes(lowerSearchTerm) ||
        (sale as any).order_id?.toString().toLowerCase().includes(lowerSearchTerm);
      
      return matchesMarketplace && matchesSearch && matchesState && matchesAccount;
    });
  }, [sales, searchTerm, marketplace, dateRange, stateFilter, accountFilter]);

  const stats = useMemo(() => {
    const grossRevenue = filteredSales.reduce((acc, sale) => acc + ((sale as any).value_with_shipping || 0), 0);
    const totalCosts = filteredSales.reduce((acc, sale) => {
        // From Ideris, 'fee_order' is the commission, and 'fee_shipment' is the shipping cost.
        const iderisCosts = ((sale as any).fee_order || 0) + ((sale as any).fee_shipment || 0);
        const manuallyAddedCosts = sale.costs.reduce((costAcc, cost) => {
            const costValue = cost.isPercentage ? (((sale as any).value_with_shipping || 0) * cost.value) / 100 : cost.value;
            return costAcc + costValue;
        }, 0);
        return acc + iderisCosts + manuallyAddedCosts;
    }, 0);
    const netRevenue = filteredSales.reduce((acc, sale) => acc + calculateNetRevenue(sale), 0);
    return { grossRevenue, totalCosts, netRevenue };
  }, [filteredSales, calculateNetRevenue]);
  
  const todayStats = useMemo(() => {
    const today = new Date();
    const todaysSales = sales.filter(sale => {
      try {
        const saleDateStr = (sale as any).payment_approved_date;
        if (!saleDateStr) return false;
        return isSameDay(new Date(saleDateStr), today);
      } catch (e) {
        return false;
      }
    });

    const grossRevenue = todaysSales.reduce((acc, sale) => acc + ((sale as any).value_with_shipping || 0), 0);
    return { grossRevenue };
  }, [sales]);

  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const updateSaleCosts = async (saleId: string, newCosts: Cost[]) => {
    let updatedSales: Sale[] = [];
    setSales(prevSales => {
      updatedSales = prevSales.map(sale =>
        sale.id === saleId ? { ...sale, costs: newCosts } : sale
      );
      return updatedSales;
    });
    // We only need to save the specific sale that was updated.
    const saleToUpdate = updatedSales.find(s => s.id === saleId);
    if (saleToUpdate) {
        await saveSales([saleToUpdate]);
    }
  };
  
  const marketplaces = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).marketplace_name).filter(Boolean)))], [sales]);
  const states = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).state_name).filter(Boolean)))], [sales]);
  const accounts = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).auth_name).filter(Boolean)))], [sales]);

  const formatLastSyncTime = (date: Date | null): string => {
    if (!date) return 'Sincronizando pela primeira vez...';
    return `Última sincronização: ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR')}`;
  };

  if (isLoading) {
    return (
       <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="animate-spin" />
        <p className="ml-2">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold font-headline tracking-tight">Painel de Vendas</h2>
          <p className="text-muted-foreground">Analise suas vendas, custos e lucratividade.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            {isSyncing ? (
              <Badge variant="secondary" className="animate-pulse">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando com Ideris...
              </Badge>
            ) : (
                <Badge variant="outline" className="text-muted-foreground font-normal">
                   {formatLastSyncTime(lastSyncTime)}
                </Badge>
            )}
        </div>
      </div>

      {!isLoading && sales.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Bem-vindo ao MarketFlow!</AlertTitle>
          <AlertDescription>
            Parece que você ainda não importou nenhuma venda. Vá para a <Link href="/mapeamento" className="font-semibold underline">página de Mapeamento</Link> para configurar suas conexões e importar seus dados.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Receita Bruta do Dia" value={formatCurrency(todayStats.grossRevenue)} icon={CalendarCheck} />
        <StatsCard title="Receita Bruta (Período)" value={formatCurrency(stats.grossRevenue)} icon={DollarSign} />
        <StatsCard title="Custos Totais (Período)" value={formatCurrency(stats.totalCosts)} icon={TrendingDown} description="Custos da planilha + adicionados"/>
        <StatsCard title="Lucro Líquido (Período)" value={formatCurrency(stats.netRevenue)} icon={TrendingUp} description="Lucro da planilha - custos adicionados"/>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle className="text-lg">Filtros e Ações</CardTitle>
            </div>
             <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" disabled><FileDown className="mr-2 h-4 w-4" /> Exportar Dados</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por SKU, Pedido ou ID..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={marketplace} onValueChange={setMarketplace} disabled={sales.length === 0}>
                <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Marketplace" />
                </SelectTrigger>
                <SelectContent>
                    {marketplaces.map(mp => (
                        <SelectItem key={mp} value={mp}>{mp === 'all' ? 'Todos os Marketplaces' : mp}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter} disabled={sales.length === 0}>
                <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Estado" />
                </SelectTrigger>
                <SelectContent>
                    {states.map(s => (
                        <SelectItem key={s} value={s}>{s === 'all' ? 'Todos os Estados' : s}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Select value={accountFilter} onValueChange={setAccountFilter} disabled={sales.length === 0}>
                <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Conta" />
                </SelectTrigger>
                <SelectContent>
                    {accounts.map(acc => (
                        <SelectItem key={acc} value={acc}>{acc === 'all' ? 'Todas as Contas' : acc}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="lg:col-span-2">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
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

    
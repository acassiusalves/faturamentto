
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, setMonth, getYear } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Loader2, DollarSign, FileSpreadsheet, Percent, Link, Target, Settings, Search, Filter, Calculator } from 'lucide-react';
import type { Sale, SupportData, SupportFile, PickedItemLog, CustomCalculation, FormulaItem, Product } from '@/lib/types';
import { SalesTable } from '@/components/sales-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadSales, loadMonthlySupportData, saveSales, loadAllPickingLogs, saveAppSettings, loadAppSettings, loadProducts } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { SupportDataDialog } from '@/components/support-data-dialog';
import Papa from "papaparse";
import { Input } from '@/components/ui/input';
import { CalculationDialog } from '@/components/calculation-dialog';


// Helper to generate months
const getMonths = () => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: new Date(0, i).toLocaleString('pt-BR', { month: 'long' })
    }));
};

const defaultCalculations: CustomCalculation[] = [
    {
        id: 'lucro_liquido',
        name: 'Lucro Líquido',
        formula: [
            { type: 'column', value: 'left_over', label: 'Lucro (Ideris)' },
            { type: 'operator', value: '-', label: '-' },
            { type: 'column', value: 'product_cost', label: 'Custo do Produto' }
        ]
    },
    {
        id: 'margem_contribuicao_percent',
        name: 'M.C. %',
        formula: [
            { type: 'operator', value: '(', label: '('},
            { type: 'column', value: 'value_with_shipping', label: 'Venda Bruta' },
            { type: 'operator', value: '-', label: '-' },
            { type: 'column', value: 'fee_order', label: 'Comissão' },
            { type: 'operator', value: '-', label: '-' },
            { type: 'column', value: 'fee_shipment', label: 'Frete' },
             { type: 'operator', value: '-', label: '-' },
            { type: 'column', value: 'product_cost', label: 'Custo do Produto' },
            { type: 'operator', value: ')', label: ')'},
            { type: 'operator', value: '/', label: '÷' },
            { type: 'column', value: 'value_with_shipping', label: 'Venda Bruta' },
        ],
        isPercentage: true,
    }
];

export default function ConciliationPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [pickingLogs, setPickingLogs] = useState<PickedItemLog[]>([]);
    const [supportData, setSupportData] = useState<SupportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>();
    const [isSupportDataOpen, setIsSupportDataOpen] = useState(false);
    const [isCalculationOpen, setIsCalculationOpen] = useState(false);
    
    // New filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [marketplaceFilter, setMarketplaceFilter] = useState("all");
    const [stateFilter, setStateFilter] = useState("all");
    const [accountFilter, setAccountFilter] = useState("all");

    // Custom Calculations
    const [customCalculations, setCustomCalculations] = useState<CustomCalculation[]>(defaultCalculations);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const [salesData, logsData, settings, productsData] = await Promise.all([
                loadSales(),
                loadAllPickingLogs(),
                loadAppSettings(),
                loadProducts(),
            ]);
            setSales(salesData);
            setPickingLogs(logsData);
            setProducts(productsData);

            if(settings?.customCalculations) {
                 // Merge default and saved calculations, giving precedence to saved ones.
                const savedCalcs = settings.customCalculations;
                const finalCalcs = [...defaultCalculations];
                savedCalcs.forEach((saved: CustomCalculation) => {
                    const existingIndex = finalCalcs.findIndex(dc => dc.id === saved.id);
                    if (existingIndex !== -1) {
                        finalCalcs[existingIndex] = saved;
                    } else {
                        finalCalcs.push(saved);
                    }
                });
                setCustomCalculations(finalCalcs);
            }
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const getMonthYearKey = useCallback(() => {
        if (!dateRange?.from) return "";
        const year = getYear(dateRange.from);
        const month = (dateRange.from.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }, [dateRange]);

    const loadSupportDataForMonth = useCallback(async () => {
        const monthYear = getMonthYearKey();
        if (monthYear) {
            const data = await loadMonthlySupportData(monthYear);
            setSupportData(data);
        }
    }, [getMonthYearKey]);

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
        loadSupportDataForMonth();
    }, [dateRange, loadSupportDataForMonth]);

    const pickingLogsMap = useMemo(() => {
        const map = new Map<string, number>();
        pickingLogs.forEach(log => {
            const currentCost = map.get(log.orderNumber) || 0;
            map.set(log.orderNumber, currentCost + log.costPrice);
        });
        return map;
    }, [pickingLogs]);
    
    const applyCustomCalculations = (sale: Sale): Sale => {
        const saleWithCost = {
            ...sale,
            product_cost: pickingLogsMap.get((sale as any).order_code) || 0,
        };
        
        const customData: Record<string, number> = {};

        customCalculations.forEach(calc => {
             try {
                // Basic shunting-yard logic for formula evaluation
                const values: number[] = [];
                const ops: string[] = [];
                const applyOp = () => {
                    const op = ops.pop()!;
                    const right = values.pop()!;
                    const left = values.pop()!;
                    switch (op) {
                        case '+': values.push(left + right); break;
                        case '-': values.push(left - right); break;
                        case '*': values.push(left * right); break;
                        case '/': values.push(right !== 0 ? left / right : 0); break;
                    }
                };

                for (const item of calc.formula) {
                    if (item.type === 'column') {
                        values.push((saleWithCost as any)[item.value] || 0);
                    } else if (item.value === '(') {
                        ops.push(item.value);
                    } else if (item.value === ')') {
                        while (ops.length && ops[ops.length - 1] !== '(') {
                            applyOp();
                        }
                        ops.pop(); // Pop '('
                    } else { // Operator
                        while (ops.length && ops[ops.length - 1] !== '(') {
                           applyOp();
                        }
                        ops.push(item.value);
                    }
                }
                 while (ops.length > 0) {
                    applyOp();
                }
                
                let result = values[0];
                if (calc.isPercentage) {
                    result = result * 100;
                }

                customData[calc.id] = result;

            } catch (e) {
                console.error(`Error calculating formula for ${calc.name}:`, e);
                customData[calc.id] = NaN; // Indicate an error
            }
        });

        return { ...sale, customData };
    };


    const filteredSales = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];
        let processedSales = sales.filter(sale => {
            try {
                const saleDate = new Date((sale as any).payment_approved_date);
                if (saleDate < dateRange.from! || saleDate > dateRange.to!) {
                    return false;
                }
            } catch {
                return false;
            }

            // Apply new filters
            const matchesMarketplace = marketplaceFilter === "all" || (sale as any).marketplace_name?.toLowerCase() === marketplaceFilter.toLowerCase();
            const matchesState = stateFilter === "all" || (sale as any).state_name === stateFilter;
            const matchesAccount = accountFilter === "all" || (sale as any).auth_name === accountFilter;

            const lowerSearchTerm = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === "" ||
                (sale as any).item_sku?.toLowerCase().includes(lowerSearchTerm) ||
                (sale as any).order_code?.toLowerCase().includes(lowerSearchTerm) ||
                (sale as any).id?.toString().toLowerCase().includes(lowerSearchTerm);

            return matchesMarketplace && matchesState && matchesAccount && matchesSearch;
        });

        if (supportData && supportData.files) {
             const normalizeKey = (key: string) => String(key || '').replace(/\D/g, '');
            const supportDataMap = new Map<string, Record<string, any>>();
            const allFiles = Object.values(supportData.files).flat();

            if (allFiles.length > 0) {
                 allFiles.forEach(file => {
                    if (!file.fileContent || !file.associationKey) return;
                    
                    try {
                        const parsedData = Papa.parse(file.fileContent, { header: true, skipEmptyLines: true });
                        parsedData.data.forEach((row: any) => {
                           const key = normalizeKey(row[file.associationKey]);
                           if(key) {
                               if (!supportDataMap.has(key)) {
                                   supportDataMap.set(key, {});
                               }
                               const existingData = supportDataMap.get(key)!;
                               
                               for(const header in row) {
                                   const friendlyName = file.friendlyNames[header] || header;
                                   if (friendlyName) {
                                       existingData[friendlyName] = row[header];
                                   }
                               }
                           }
                        });
                    } catch (e) {
                         console.error("Error parsing support file", e);
                    }
                 });
                 
                 processedSales = processedSales.map(sale => {
                     const saleKey = normalizeKey((sale as any).order_code);
                     if(saleKey && supportDataMap.has(saleKey)) {
                         return {
                             ...sale,
                             sheetData: {
                                 ...(sale.sheetData || {}),
                                 ...supportDataMap.get(saleKey),
                             }
                         }
                     }
                     return sale;
                 })
            }
        }
        
        return processedSales.map(applyCustomCalculations);

    }, [sales, dateRange, supportData, searchTerm, marketplaceFilter, stateFilter, accountFilter, customCalculations, pickingLogsMap]);

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };
    
    const calculateTotalCost = (sale: Sale): number => {
        const productCost = pickingLogsMap.get((sale as any).order_code) || 0;
        const manualCosts = sale.costs?.reduce((acc, cost) => {
             const costValue = cost.isPercentage ? (((sale as any).value_with_shipping || 0) * cost.value) / 100 : cost.value;
            return acc + costValue;
        }, 0) || 0;
        return productCost + manualCosts;
    };

    const calculateNetRevenue = (sale: Sale): number => {
        const baseProfit = (sale as any).left_over || 0;
        const totalAddedCosts = calculateTotalCost(sale);
        
        // The base profit from Ideris already discounts commission and shipping.
        // We need to discount the product cost (from picking) and manual costs.
        const productCost = pickingLogsMap.get((sale as any).order_code) || 0;
        const manualCosts = totalAddedCosts - productCost;

        return baseProfit - productCost - manualCosts;
    };
    
    const updateSaleCosts = (saleId: string, newCosts: Sale['costs']) => {
        let updatedSales: Sale[] = [];
        setSales(prevSales => {
          updatedSales = prevSales.map(sale =>
            sale.id === saleId ? { ...sale, costs: newCosts } : sale
          );
          return updatedSales;
        });
        const saleToUpdate = updatedSales.find(s => s.id === saleId);
        if (saleToUpdate) {
            saveSales([saleToUpdate]);
        }
    };

    const handleSaveCustomCalculation = async (calculation: CustomCalculation) => {
        const newCalculations = [...customCalculations.filter(c => c.id !== calculation.id), calculation];
        setCustomCalculations(newCalculations);
        await saveAppSettings({ customCalculations: newCalculations });
    };

    // Options for filters
    const marketplaces = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).marketplace_name).filter(Boolean)))], [sales]);
    const states = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).state_name).filter(Boolean)))], [sales]);
    const accounts = useMemo(() => ["all", ...Array.from(new Set(sales.map(s => (s as any).auth_name).filter(Boolean)))], [sales]);
    
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
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setIsSupportDataOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" />
                                Dados de Apoio
                            </Button>
                            <Button variant="outline" onClick={() => setIsCalculationOpen(true)}>
                                <Calculator className="mr-2 h-4 w-4" />
                                Calcular
                            </Button>
                        </div>
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

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        <CardTitle className="text-lg">Filtros Adicionais</CardTitle>
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
                    <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter} disabled={sales.length === 0}>
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
                </CardContent>
            </Card>

            <SalesTable
              data={filteredSales}
              products={products}
              supportData={supportData}
              onUpdateSaleCosts={updateSaleCosts}
              calculateTotalCost={calculateTotalCost}
              calculateNetRevenue={calculateNetRevenue}
              formatCurrency={formatCurrency}
              isLoading={isLoading}
              productCostSource={pickingLogsMap}
              customCalculations={customCalculations}
            />

        </div>
        
        <SupportDataDialog
            isOpen={isSupportDataOpen}
            onClose={() => {
              setIsSupportDataOpen(false);
              loadSupportDataForMonth(); // Recarrega os dados de apoio ao fechar
            }}
            monthYearKey={getMonthYearKey()}
        />

        <CalculationDialog
            isOpen={isCalculationOpen}
            onClose={() => setIsCalculationOpen(false)}
            onSave={handleSaveCustomCalculation}
        />
        </>
    );
}

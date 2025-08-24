

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
import type { DateRange } from "react-day-picker";
import { iderisFields } from '@/lib/ideris-fields';
import { DateRangePicker } from '@/components/ui/date-range-picker';


// Helper to generate months
const getMonths = () => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: new Date(0, i).toLocaleString('pt-BR', { month: 'long' })
    }));
};

const defaultCalculations: CustomCalculation[] = [];

// ----------------------------------------------------------------------------------
// INÍCIO DA SEÇÃO DE CÓDIGO CORRIGIDO
// ----------------------------------------------------------------------------------

const sortCalculationsByDependency = (calculations: CustomCalculation[]): CustomCalculation[] => {
    const graph: { [key: string]: string[] } = {};
    const inDegree: { [key: string]: number } = {};
    const calcMap = new Map(calculations.map(c => [c.id, c]));
    const calcIds = new Set(calcMap.keys());

    for (const id of calcIds) {
        graph[id] = [];
        inDegree[id] = 0;
    }

    for (const calc of calculations) {
        // Dependências da fórmula (como antes)
        for (const item of calc.formula) {
            if (item.type === 'column' && calcIds.has(item.value)) {
                graph[item.value].push(calc.id);
                inDegree[calc.id]++;
            }
        }

        // CORREÇÃO FINAL: Inverte a lógica da dependência de interação.
        // Se a coluna 'calc' (source) interage com uma 'targetColumn',
        // então a 'source' depende que a 'target' seja calculada primeiro.
        if (calc.interaction) {
            const sourceId = calc.id;
            const targetId = calc.interaction.targetColumn;
            if (calcIds.has(targetId)) {
                // A seta de dependência vai do ALVO para a ORIGEM da interação.
                graph[targetId].push(sourceId);
                inDegree[sourceId]++;
            }
        }
    }

    const queue: string[] = [];
    for (const id in inDegree) {
        if (inDegree[id] === 0) {
            queue.push(id);
        }
    }

    const sorted: CustomCalculation[] = [];
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        sorted.push(calcMap.get(currentId)!);
        for (const neighborId of graph[currentId]) {
            inDegree[neighborId]--;
            if (inDegree[neighborId] === 0) {
                queue.push(neighborId);
            }
        }
    }

    if (sorted.length !== calculations.length) {
        console.error("Dependência circular detectada nos cálculos personalizados.");
        return calculations;
    }

    return sorted;
};


export default function ConciliationPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [pickingLogs, setPickingLogs] = useState<PickedItemLog[]>([]);
    const [supportData, setSupportData] = useState<SupportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
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
        loadSupportDataForMonth();
    }, [dateRange, loadSupportDataForMonth]);

    const pickingLogsMap = useMemo(() => {
        const map = new Map<string, number>();
        pickingLogs.forEach(log => {
            // CORREÇÃO: A chave no objeto 'log' é 'orderNumber'
            const currentCost = map.get(log.orderNumber) || 0;
            map.set(log.orderNumber, currentCost + log.costPrice);
        });
        return map;
    }, [pickingLogs]);
    
// === Helpers: cole acima do applyCustomCalculations ===
const parseBrNumber = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;

  // Remove qualquer coisa que não seja dígito, ponto, vírgula ou sinal negativo
  const s0 = raw.trim().replace(/[^\d.,-]/g, '');
  if (!s0) return null;

  // Se tiver vírgula, assume decimal pt-BR (milhar '.')
  if (s0.includes(',')) {
    const normalized = s0.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // Sem vírgula: assume decimal en-US (ponto)
  const n = Number(s0);
  return Number.isFinite(n) ? n : null;
};

const getNumericField = (saleWithCost: any, key: string): number => {
  const candidates = [
    saleWithCost?.customData?.[key],
    saleWithCost?.sheetData?.[key],
    saleWithCost?.[key],
  ];
  for (const c of candidates) {
    const n = parseBrNumber(c);
    if (n != null) return n;
  }
  return 0;
};

const pushValue = (values: number[], v: number) => {
  values.push(Number.isFinite(v) ? v : 0);
};
// === SUBSTITUA sua applyCustomCalculations por esta versão ===
const applyCustomCalculations = useCallback((sale: Sale): Sale => {
  const saleWithCost: any = {
    ...sale,
    product_cost: pickingLogsMap.get((sale as any).order_code) || 0,
    customData: { ...(sale as any).customData || {} },
  };

  const sortedCalculations = sortCalculationsByDependency(customCalculations);

  sortedCalculations.forEach((calc) => {
    // Se o cálculo for para um marketplace específico e não bater, grava 0 (neutro)
    if (calc.targetMarketplace && (sale as any).marketplace_name !== calc.targetMarketplace) {
      saleWithCost.customData[calc.id] = 0;
      return;
    }

    try {
      const values: number[] = [];
      const ops: string[] = [];
      const prec = (op: string) => (op === '+' || op === '-') ? 1 : (op === '*' || op === '/') ? 2 : 0;

      const applyOp = () => {
        const op = ops.pop()!;
        const r = values.pop()!;
        const l = values.pop()!;
        if (op === '+') pushValue(values, l + r);
        else if (op === '-') pushValue(values, l - r);
        else if (op === '*') pushValue(values, l * r);
        else if (op === '/') pushValue(values, r !== 0 ? l / r : 0);
      };

      for (const item of calc.formula) {
        if (item.type === 'column') {
          const n = getNumericField(saleWithCost, item.value);
          pushValue(values, n);
        } else if (item.type === 'number') {
          const n = parseBrNumber(item.value);
          pushValue(values, n ?? 0);
        } else if (item.value === '(') {
          ops.push('(');
        } else if (item.value === ')') {
          while (ops.length && ops[ops.length - 1] !== '(') applyOp();
          ops.pop();
        } else {
          while (ops.length && prec(ops[ops.length - 1]) >= prec(item.value)) applyOp();
          ops.push(item.value);
        }
      }
      while (ops.length) applyOp();

      let result = values[0] ?? 0;
      if (!Number.isFinite(result)) result = 0;
      if (calc.isPercentage) result = result * 100;

      saleWithCost.customData[calc.id] = result;

      // Interaction segura
      if (calc.interaction) {
        const targetCol = calc.interaction.targetColumn;
        const operator = calc.interaction.operator;
        const base = getNumericField(saleWithCost, targetCol);
        const valueToApply = saleWithCost.customData[calc.id];

        let out = base;
        if (operator === '+') out = base + valueToApply;
        else if (operator === '-') out = base - valueToApply;

        saleWithCost.customData[targetCol] = Number.isFinite(out) ? out : 0;
      }
    } catch (e) {
      console.error(`Error calculating formula for ${calc.name}:`, e);
      saleWithCost.customData[calc.id] = 0; // fallback absoluto
    }
  });

  // Garante custo do produto
  if (!parseBrNumber(saleWithCost.customData?.product_cost)) {
    saleWithCost.customData.product_cost = saleWithCost.product_cost || 0;
  }

  return saleWithCost as Sale;
}, [pickingLogsMap, customCalculations]);

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

            // Use o mesmo parser robusto do motor de cálculo
            const parseSheetValue = (value: any): any => {
              // Se já é número finito, mantém
              if (typeof value === 'number' && Number.isFinite(value)) return value;

              // Se é string, tenta converter pt-BR/en-US, removendo "R$", espaços, etc.
              if (typeof value === 'string') {
                const n = parseBrNumber(value); // a helper que você já declarou acima
                if (n != null) return n;
              }

              // Caso não seja número, devolve como veio (texto, data, etc.)
              return value;
            };

            const supportDataMap = new Map<string, Record<string, any>>();
            const allFiles = Object.values(supportData.files).flat();

            if (allFiles.length > 0) {
                 allFiles.forEach(file => {
                    if (!file.fileContent || !file.associationKey) return;
                    
                    try {
                        // 1. Lemos a planilha como texto puro, sem nenhuma transformação automática.
                        const parsedData = Papa.parse(file.fileContent, { 
                            header: true, 
                            skipEmptyLines: true,
                        });

                        // 2. Agora, nós mesmos iteramos e convertemos cada valor.
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
                                       // Aplicamos nossa conversão segura aqui.
                                       existingData[friendlyName] = parseSheetValue(row[header]);
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
                     if (saleKey && supportDataMap.has(saleKey)) {
                         return {
                             ...sale,
                             sheetData: {
                                 ...(sale.sheetData || {}),
                                 ...supportDataMap.get(saleKey),
                             }
                         };
                     }
                     return sale;
                 });
            }
        }
        
        return processedSales.map(applyCustomCalculations);

    }, [sales, dateRange, supportData, searchTerm, marketplaceFilter, stateFilter, accountFilter, applyCustomCalculations]);
    
    const availableFormulaColumns = useMemo(() => {
        const numericIderis = iderisFields
            .filter(f => f.key.toLowerCase().includes('value') || f.key.toLowerCase().includes('amount') || f.key.toLowerCase().includes('fee') || f.key.toLowerCase().includes('cost') || f.key.toLowerCase().includes('discount') || f.key.toLowerCase().includes('left_over'))
            .map(f => ({ key: f.key, label: f.label }));
        
        const systemCols = [
            { key: 'product_cost', label: 'Custo do Produto' },
        ];

        const customCols = customCalculations.map(c => ({ key: c.id, label: c.name }));

        const sheetCols: { key: string, label: string }[] = [];
        if (supportData && supportData.files) {
            const allFriendlyNames = new Set<string>();
            Object.values(supportData.files).flat().forEach(file => {
                Object.values(file.friendlyNames).forEach(name => allFriendlyNames.add(name));
            });
            allFriendlyNames.forEach(name => sheetCols.push({ key: name, label: name }));
        }
        
        // This can be expanded to check for actual numeric values in sheetData if needed
        const allCols = [...numericIderis, ...systemCols, ...customCols, ...sheetCols];
        // Remove duplicates by key
        return Array.from(new Map(allCols.map(item => [item['key'], item])).values());
    }, [customCalculations, supportData]);


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

    const handleSaveCustomCalculation = async (calculation: Omit<CustomCalculation, 'id'> & { id?: string }) => {
        let newCalculations: CustomCalculation[];
        
        const finalCalculation = { ...calculation };
        // Do not save interaction property if target is 'none'
        if (finalCalculation.interaction && finalCalculation.interaction.targetColumn === 'none') {
            delete finalCalculation.interaction;
        }
        // Do not save targetMarketplace property if it is 'all'
        if (finalCalculation.targetMarketplace === 'all') {
            delete finalCalculation.targetMarketplace;
        }

        if (finalCalculation.id) { // Editing existing
            newCalculations = customCalculations.map(c => c.id === finalCalculation.id ? { ...c, ...finalCalculation } : c);
        } else { // Adding new
            const newId = `custom_${finalCalculation.name.toLowerCase().replace(/[\s\W]/g, '_')}_${Date.now()}`;
            newCalculations = [...customCalculations, { ...finalCalculation, id: newId }];
        }
        
        setCustomCalculations(newCalculations);
        // Filter out default calculations before saving to Firestore
        const calcsToSave = newCalculations.filter(c => !defaultCalculations.some(dc => dc.id === c.id));
        await saveAppSettings({ customCalculations: calcsToSave });
    };

    const handleDeleteCustomCalculation = async (calculationId: string) => {
        const newCalculations = customCalculations.filter(c => c.id !== calculationId);
        setCustomCalculations(newCalculations);
        const calcsToSave = newCalculations.filter(c => !defaultCalculations.some(dc => dc.id === c.id));
        await saveAppSettings({ customCalculations: calcsToSave });
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
                            <CardDescription>Filtre as vendas que você deseja analisar.</CardDescription>
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
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
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
                            <SelectItem value="all">Todos os Marketplaces</SelectItem>
                            {marketplaces.map(mp => (
                                <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={stateFilter} onValueChange={setStateFilter} disabled={sales.length === 0}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Estados</SelectItem>
                            {states.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select value={accountFilter} onValueChange={setAccountFilter} disabled={sales.length === 0}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por Conta" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as Contas</SelectItem>
                            {accounts.map(acc => (
                                <SelectItem key={acc} value={acc}>{acc}</SelectItem>
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
            onDelete={handleDeleteCustomCalculation}
            marketplaces={marketplaces.filter(m => m !== 'all')}
            availableColumns={availableFormulaColumns}
            customCalculations={customCalculations}
        />
        </>
    );
}

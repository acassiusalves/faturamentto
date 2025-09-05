

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, setMonth, getYear } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Loader2, DollarSign, FileSpreadsheet, Percent, Link, Target, Settings, Search, Filter, Calculator, TrendingDown, TrendingUp, BarChart3, Ticket, CheckCircle, Edit, PlusCircle, XCircle } from 'lucide-react';
import type { Sale, SupportData, PickedItemLog, CustomCalculation, FormulaItem, Product } from '@/lib/types';
import { SalesTable } from '@/components/sales-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadSales, loadMonthlySupportData, saveSales, loadAllPickingLogs, saveAppSettings, loadAppSettings, loadProducts, savePickLog } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { SupportDataDialog } from '@/components/support-data-dialog';
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Input } from '@/components/ui/input';
import { CalculationDialog } from '@/components/calculation-dialog';
import type { DateRange } from "react-day-picker";
import { iderisFields } from '@/lib/ideris-fields';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TicketDialog } from '@/components/ticket-dialog';
import { Progress } from '@/components/ui/progress';
import { CostRefinementDialog } from '@/components/cost-refinement-dialog';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect, type Option } from '@/components/ui/multi-select';


// Helper to generate months
const getMonths = () => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: new Date(0, i).toLocaleString('pt-BR', { month: 'long' })
    }));
};

const defaultCalculations: CustomCalculation[] = [
    {
        id: 'custom_lucro_liquido_real_1720549929555',
        name: 'Lucro Líquido Real',
        formula: [
            { type: 'column', value: 'left_over', label: 'Lucro (sobra)' },
            { type: 'operator', value: '-', label: '-' },
            { type: 'column', value: 'product_cost', label: 'Custo do Produto' },
        ],
        isPercentage: false,
        ignoreIfCancelled: true
    },
];

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
        // Dependências da fórmula
        for (const item of calc.formula) {
            if (item.type === 'column' && calcIds.has(item.value)) {
                // Se a fórmula de 'calc' usa 'item.value', então 'item.value' deve ser calculado primeiro.
                // A seta de dependência vai de 'item.value' para 'calc.id'.
                graph[item.value].push(calc.id);
                inDegree[calc.id]++;
            }
        }

        // Dependências de interação
        if (calc.interaction) {
            const sourceId = calc.id;
            const targetId = calc.interaction.targetColumn;
            if (calcIds.has(targetId)) {
                // Se 'calc' (source) interage com 'target', então 'target' deve ser calculado primeiro.
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
        
        // CORREÇÃO: Verifica se 'graph[currentId]' existe antes de iterar
        if (graph[currentId]) {
            for (const neighborId of graph[currentId]) {
                inDegree[neighborId]--;
                if (inDegree[neighborId] === 0) {
                    queue.push(neighborId); // CORREÇÃO: Enfileira o 'neighborId', não o 'id' original.
                }
            }
        }
    }

    if (sorted.length !== calculations.length) {
        console.error("Dependência circular detectada nos cálculos personalizados. A ordem pode estar incorreta.");
        // Retorna a lista original como fallback para evitar que a aplicação quebre completamente.
        return calculations;
    }

    return sorted;
};

// normaliza rótulos (usa em headers, friendlynames etc.)
const normalizeLabel = (s: string): string =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// chave de associação mais esperta:
// - se só dígitos der >=4, usa (bom p/ pedidos tipo "ABC-12345")
// - senão, usa "raw normalizado" (sem acento/espaco/pontuação)
const normalizeAssocKey = (val: unknown): string => {
  const raw = String(val ?? "").trim();
  const onlyDigits = raw.replace(/\D/g, "");
  if (onlyDigits.length >= 4) return onlyDigits;
  return normalizeLabel(raw).replace(/\W/g, "");
};

// tenta adivinhar delimiter do CSV ("," vs ";")
const guessDelimiter = (s: string) => {
  const firstLine = s.split(/\r?\n/)[0] ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
};

// detecta XLSX base64 (zip começa com "UEsDB")
const looksLikeXlsxBase64 = (s: string) => /^UEsDB/.test(s.trim());

// parser único p/ arquivo de apoio
const parseSupportFile = (file: any): { rows: any[]; headers: string[] } => {
  const content = String(file.fileContent || "");
  const isXlsx = file.fileName?.toLowerCase?.().endsWith(".xlsx") || looksLikeXlsxBase64(content);

  if (isXlsx) {
    // Conteúdo base64 -> workbook
    const wb = XLSX.read(content, { type: "base64" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: "" });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { rows, headers };
  } else {
    // CSV
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: guessDelimiter(content),
      transformHeader: (h) => h, // preserva exatamente como veio
    });
    return { rows: parsed.data as any[], headers: parsed.meta.fields || [] };
  }
};

// acha o header real da coluna de associação, aceitando friendlyName ou header cru
const resolveAssociationHeader = (headers: string[], file: any): string => {
  const headMap = new Map(headers.map((h) => [normalizeLabel(h), h]));

  // se veio um friendlyName, mapeia de volta pro header original
  const friendlyToOriginal = new Map<string, string>();
  if (file?.friendlyNames) {
    // { headerOriginal: "Nome Amigável" }
    for (const [orig, fr] of Object.entries(file.friendlyNames as Record<string,string>)) {
      friendlyToOriginal.set(normalizeLabel(fr), orig);
    }
  }

  const wanted = normalizeLabel(file.associationKey || "");
  // tenta bater direto com header normalizado
  if (headMap.has(wanted)) return headMap.get(wanted)!;

  // tenta reverter friendlyName -> header original
  const orig = friendlyToOriginal.get(wanted);
  if (orig && headMap.has(normalizeLabel(orig))) return headMap.get(normalizeLabel(orig))!;

  // último recurso: devolve o que veio
  return file.associationKey;
};


// detecta headers de data/hora
const isDateHeader = (label: string) =>
  /\b(data|date|hora|time|emissao|in[ií]cio|final|relat[oó]rio)\b/i.test(label);

// dd/mm/yyyy [hh:mm[:ss]] -> ISO (UTC)
const parseBRDateToISO = (s: string): string | null => {
  const m = s.trim().replace(/\./g, '/')
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, HH='00', MM='00', SS='00'] = m;
  // gera ISO sempre em UTC
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +HH, +MM, +SS)).toISOString();
};


// Excel serial -> ISO (normalizado para UTC, com correção do bug de 1900)
const excelSerialToISO = (serial: number): string | null => {
    if (typeof serial !== 'number' || !Number.isFinite(serial)) {
        return null;
    }
    
    // O epoch do Excel começa em "dia 1" = 1900-01-01. O do JS é 1970-01-01.
    // 25569 é o número de dias entre essas duas datas.
    // O Excel trata 1900 como ano bissexto (bug), então para datas após 28/02/1900,
    // o cálculo fica com 1 dia de adiantamento. Subtraímos 1 para corrigir.
    // O dia serial 60 seria o "29/02/1900" no Excel.
    const daysOffset = serial > 59 ? 25568 : 25569;

    // Converte os dias para milissegundos
    const utcMilliseconds = (serial - daysOffset) * 86400 * 1000;

    // Cria a data diretamente em UTC para evitar qualquer interferência de fuso horário local
    const date = new Date(utcMilliseconds);

    // Validação extra para garantir que a data é válida
    if (isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
};


// extrai um serial do Excel de 5 dígitos **em qualquer lugar** da string
const extractExcelSerial = (s: string): number | null => {
  const m = s.trim().match(/(?:^|[^\d])(\d{5})(?:[^\d]|$)/);
  if (!m) return null;
  const num = Number(m[1]);
  // faixa segura para ser serial (aprox. anos 1955–2149)
  return (num >= 20000 && num <= 80000) ? num : null;
};


// reconhece valores que parecem datas (independe do header)
const looksLikeDateValue = (v: any): boolean => {
  if (v instanceof Date) return true;
  if (typeof v === 'number' && v > 20000 && v < 80000) return true; // serial puro
  if (typeof v === 'string') {
    const s = v.trim();
    return (
      /^\d{1,2}\/\d{1,2}\/\d{4}(?:\s\d{2}:\d{2}(?::\d{2})?)?$/.test(s) || // dd/mm/yyyy
      /^\d{4}-\d{2}-\d{2}T/.test(s) ||                                   // ISO
      extractExcelSerial(s) != null                                      // contém serial
    );
  }
  return false;
};

// normaliza qualquer valor de data para ISO
const coerceAnyDateToISO = (raw: any): string | null => {
    if (raw instanceof Date) {
        return new Date(Date.UTC(
            raw.getUTCFullYear(),
            raw.getUTCMonth(),
            raw.getUTCDate(),
            raw.getUTCHours(),
            raw.getUTCMinutes(),
            raw.getUTCSeconds()
        )).toISOString();
    }
    if (typeof raw === 'number') return excelSerialToISO(raw);
    if (typeof raw === 'string') {
        const s = raw.trim();
        const isoBR = parseBRDateToISO(s);
        if (isoBR) return isoBR;
        const serial = extractExcelSerial(s);
        if (serial != null) return excelSerialToISO(serial);
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
    }
    return null;
};


// ISO -> "dd/mm/yyyy" em UTC (evita variação de fuso)
const isoToBRDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

interface DynamicFilter {
    id: string;
    column: string;
    values: string[];
}

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
    const [isRefinementOpen, setIsRefinementOpen] = useState(false);
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
    const [selectedSaleForTicket, setSelectedSaleForTicket] = useState<Sale | null>(null);
    const { toast } = useToast();
    
    // New filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [marketplaceFilter, setMarketplaceFilter] = useState("all");
    const [stateFilter, setStateFilter] = useState("all");
    const [accountFilter, setAccountFilter] = useState("all");
    const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([{ id: `filter-${Date.now()}`, column: '', values: [] }]);


    // Custom Calculations
    const [customCalculations, setCustomCalculations] = useState<CustomCalculation[]>(defaultCalculations);
    
    const fetchAllData = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        async function runInitialFetch() {
             setIsLoading(true);
             await fetchAllData();
             setIsLoading(false);
        }
        runInitialFetch();
    }, [fetchAllData]);

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
        const map = new Map<string, { cost: number; isManual: boolean }>();
        pickingLogs.forEach(log => {
            const currentCost = map.get(log.orderNumber)?.cost || 0;
            const isManual = log.serialNumber.startsWith('MANUAL-');
            map.set(log.orderNumber, {
                cost: currentCost + log.costPrice,
                isManual: isManual
            });
        });
        return map;
    }, [pickingLogs]);
    
// === Helpers: cole acima do applyCustomCalculations ===
function parseLocaleNumber(input: string | number): number {
  if (typeof input === 'number') return input;
  if (!input) return NaN;
  let s = String(input).trim().replace(/[R$\s]/g, '');

  // Se tem vírgula, assume pt-BR: remove pontos de milhar e troca vírgula por ponto
  if (s.includes(',')) {
    s = s.replace(/\.(?=\d{3}(\D|$))/g, ''); // remove pontos de milhar
    s = s.replace(',', '.');                 // vírgula decimal -> ponto
  } else {
    // en-US com vírgula de milhar
    s = s.replace(/,(?=\d{3}(\D|$))/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}


const getNumericField = (saleWithCost: any, key: string): number => {
  const candidates = [
    saleWithCost?.customData?.[key],
    saleWithCost?.sheetData?.[key],
    saleWithCost?.[key],
  ];
  for (const c of candidates) {
    const n = parseLocaleNumber(String(c));
    if (!isNaN(n)) return n;
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
    product_cost: pickingLogsMap.get((sale as any).order_code)?.cost || 0,
    customData: { ...(sale as any).customData || {} },
  };

  const sortedCalculations = sortCalculationsByDependency(customCalculations);

  sortedCalculations.forEach((calc) => {
    // Se o cálculo for para um marketplace específico e não bater, grava 0 (neutro)
    if (calc.targetMarketplace && (sale as any).marketplace_name !== calc.targetMarketplace) {
      saleWithCost.customData[calc.id] = 0;
      return;
    }

    // Se o status do pedido for "cancelado" e a regra estiver ativa, zera o cálculo
    const status = sale.sheetData?.['status'] || sale.status || '';
    if (calc.ignoreIfCancelled && String(status).toLowerCase().includes('cancelado')) {
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
          const n = parseLocaleNumber(item.value);
          pushValue(values, isNaN(n) ? 0 : n);
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
  if (isNaN(parseLocaleNumber(String(saleWithCost.customData?.product_cost)))) {
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
          const supportDataMap = new Map<string, Record<string, any>>();
          const allFiles: any[] = Object.values(supportData.files).flat();
        
          if (allFiles.length > 0) {
            allFiles.forEach((file) => {
              if (!file?.fileContent || !file?.associationKey) return;
        
              try {
                const { rows, headers } = parseSupportFile(file);
                const assocHeader = resolveAssociationHeader(headers, file);
        
                rows.forEach((row: any) => {
                  const key = normalizeAssocKey(row[assocHeader]);
                  if (!key) return;
        
                  if (!supportDataMap.has(key)) supportDataMap.set(key, {});
                  const existing = supportDataMap.get(key)!;
        
                  headers.forEach((header) => {
                      const raw = row[header];
                      const friendlyName = (file.friendlyNames?.[header] as string) || header;
                      const normKey = normalizeLabel(friendlyName);
                  
                      let out: any = raw;
                  
                      // Converte se o header indica data OU se o valor "parece" uma data
                      if (isDateHeader(friendlyName) || looksLikeDateValue(raw)) {
                        const iso = coerceAnyDateToISO(raw);
                        out = iso ? isoToBRDate(iso) : raw; // se preferir guardar ISO, troque por `out = iso ?? raw`
                      }
                  
                      existing[normKey] = out;
                  });
                });
              } catch (e) {
                console.error("Erro ao parsear arquivo de apoio:", file?.fileName || "", e);
              }
            });
        
            processedSales = processedSales.map((sale) => {
              const saleKey = normalizeAssocKey((sale as any).order_code);
              const sheetValues = supportDataMap.get(saleKey);
        
              if (sheetValues) {
                const merged: any = {
                  ...sale,
                  sheetData: {
                    ...(sale as any).sheetData,
                    ...sheetValues,
                  },
                };
                // Prioritize the status from the sheet if it exists
                if (sheetValues["status"]) {
                    merged.status = sheetValues["status"];
                }
                return merged;
              }
              return sale;
            });
          }
        }
        
        let finalSales = processedSales.map(applyCustomCalculations);

        // Apply dynamic custom filters
        const activeDynamicFilters = dynamicFilters.filter(f => f.column && f.values.length > 0);
        if (activeDynamicFilters.length > 0) {
            finalSales = finalSales.filter(sale => {
                return activeDynamicFilters.every(filter => {
                    const saleValue = String(sale.sheetData?.[filter.column] ?? '').toLowerCase();
                    return filter.values.some(v => saleValue.includes(v.toLowerCase()));
                });
            });
        }

        return finalSales;

    }, [sales, dateRange, supportData, searchTerm, marketplaceFilter, stateFilter, accountFilter, applyCustomCalculations, dynamicFilters]);
    
    const summaryStats = useMemo(() => {
        let faturamento = 0;
        let custoProduto = 0;
        let lucroLiquido = 0;

        filteredSales.forEach(sale => {
            faturamento += getNumericField(sale, 'value_with_shipping');
            custoProduto += getNumericField(sale, 'product_cost');
            lucroLiquido += getNumericField(sale, 'custom_lucro_liquido_real_1720549929555');
        });
        
        const margemContribuicao = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;
        
        return {
            faturamento,
            custoProduto,
            lucroLiquido,
            margemContribuicao,
        }
    }, [filteredSales]);

    const conciliationStats = useMemo(() => {
        const totalSales = filteredSales.length;
        if (totalSales === 0) return { reconciledCount: 0, unreconciledCount: 0, percentage: 0 };

        const reconciledCount = filteredSales.filter(sale => {
            const productCost = getNumericField(sale, 'product_cost');
            return productCost > 0;
        }).length;

        const unreconciledCount = totalSales - reconciledCount;
        const percentage = (reconciledCount / totalSales) * 100;
        return { reconciledCount, unreconciledCount, percentage };
    }, [filteredSales]);


    const availableFormulaColumns = useMemo(() => {
        const numericIderisKeys = new Set(
          iderisFields
            .filter(f => {
              const key = f.key.toLowerCase();
              const nonNumeric = ['id', 'code', 'sku', 'cpf', 'cnpj', 'document', 'cep', 'phone'];
              if (nonNumeric.some(nn => key.includes(nn))) return false;
              
              const isNumericLike = ['value', 'amount', 'fee', 'cost', 'discount', 'quantity', 'price', 'profit', 'tax', 'net', 'imposto', 'frete', 'comissao'].some(term => key.includes(term));
              return isNumericLike;
            })
            .map(f => f.key)
        );
  
        const allCols = [
          ...iderisFields
            .filter(f => numericIderisKeys.has(f.key))
            .map(f => ({ key: f.key, label: f.label })),
          { key: 'product_cost', label: 'Custo do Produto' },
          ...customCalculations.map(c => ({ key: c.id, label: c.name })),
        ];
  
        if (supportData && supportData.files) {
          const sheetCols = new Map<string, string>();
          Object.values(supportData.files).flat().forEach(file => {
            if (!file?.fileContent) return;
            try {
              const { rows } = parseSupportFile(file);
              if (rows.length > 0) {
                const firstRow = rows[0];
                for (const header in firstRow) {
                  if (!isNaN(parseLocaleNumber(String(firstRow[header])))) {
                    const friendlyName = file.friendlyNames[header] || header;
                    sheetCols.set(normalizeLabel(friendlyName), friendlyName);
                  }
                }
              }
            } catch(e) { console.error("Error parsing file for columns", e)}
          });
          sheetCols.forEach((label, key) => allCols.push({ key, label }));
        }
        
        return Array.from(new Map(allCols.map(item => [item['key'], item])).values());
    }, [customCalculations, supportData]);


    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };
    
    const handleUpdateSaleData = (saleId: string, updatedData: Partial<Sale>) => {
        let saleToUpdate: Sale | undefined;
        setSales(prevSales => {
          const newSales = prevSales.map(sale => {
            if (sale.id === saleId) {
              saleToUpdate = { ...sale, ...updatedData };
              return saleToUpdate;
            }
            return sale;
          });
          return newSales;
        });
        if (saleToUpdate) {
            saveSales([saleToUpdate]); // Firestore save
        }
    };
    
    const handleSaveCustomCalculation = async (calculation: Omit<CustomCalculation, 'id'> & { id?: string }) => {
        let newCalculations: CustomCalculation[];
        
        const finalCalculation = { ...calculation };
        if (finalCalculation.interaction && finalCalculation.interaction.targetColumn === 'none') {
            delete finalCalculation.interaction;
        }
        if (finalCalculation.targetMarketplace === 'all') {
            delete finalCalculation.targetMarketplace;
        }
        if (typeof finalCalculation.ignoreIfCancelled === 'undefined') {
            finalCalculation.ignoreIfCancelled = false;
        }


        if (finalCalculation.id) { // Editing existing
            newCalculations = customCalculations.map(c => c.id === finalCalculation.id ? { ...c, ...finalCalculation } : c);
        } else { // Adding new
            const newId = `custom_${finalCalculation.name.toLowerCase().replace(/[\s\W]/g, '_')}_${Date.now()}`;
            newCalculations = [...customCalculations, { ...finalCalculation, id: newId }];
        }
        
        setCustomCalculations(newCalculations);
        const calcsToSave = newCalculations.filter(c => !defaultCalculations.some(dc => dc.id === c.id));
        await saveAppSettings({ customCalculations: calcsToSave });
    };

    const handleDeleteCustomCalculation = async (calculationId: string) => {
        const newCalculations = customCalculations.filter(c => c.id !== calculationId);
        setCustomCalculations(newCalculations);
        const calcsToSave = newCalculations.filter(c => !defaultCalculations.some(dc => dc.id === c.id));
        await saveAppSettings({ customCalculations: calcsToSave });
    };
    
    const handleOpenTicketDialog = (sale: Sale) => {
        setSelectedSaleForTicket(sale);
        setIsTicketDialogOpen(true);
    };

    const handleSaveRefinedCosts = async (costsToSave: Map<string, number>) => {
        const logsToSave: PickedItemLog[] = [];
        const now = new Date();
    
        costsToSave.forEach((cost, saleId) => {
            const sale = sales.find(s => s.id === saleId);
            const product = products.find(p => p.sku === (sale as any)?.item_sku);
            if (sale && cost > 0) {
                const newLog: PickedItemLog = {
                    id: `manual-${sale.id}`,
                    orderNumber: (sale as any).order_code,
                    logId: `log-manual-${sale.id}-${now.getTime()}`,
                    productId: product?.id || `manual-${(sale as any).item_sku}`,
                    name: (sale as any).item_title,
                    sku: (sale as any).item_sku,
                    costPrice: cost,
                    serialNumber: `MANUAL-${sale.id}`,
                    origin: 'Manual',
                    quantity: (sale as any).item_quantity || 1,
                    createdAt: now.toISOString(),
                    pickedAt: (sale as any).payment_approved_date || now.toISOString(),
                };
                logsToSave.push(newLog);
            }
        });
    
        if (logsToSave.length > 0) {
            await savePickLog(logsToSave);
            await fetchAllData(); // Recarrega TODOS os dados, incluindo os picking logs
            toast({
                title: "Custos Salvos!",
                description: `${logsToSave.length} custos manuais foram adicionados com sucesso.`
            });
        }
        setIsRefinementOpen(false);
    };
    
    const customFilterFields = useMemo(() => {
        if (!supportData || !supportData.files) return [];
        const fields = new Set<string>();
        Object.values(supportData.files).flat().forEach(file => {
            if (!file?.fileContent) return;
            try {
                if(file.friendlyNames) {
                    Object.values(file.friendlyNames).forEach(name => {
                       if (name) fields.add(name);
                    });
                }
            } catch (e) {
                console.error("Error parsing file for filters", e);
            }
        });
        return Array.from(fields).sort((a,b) => a.localeCompare(b));
    }, [supportData]);

    const handleDynamicFilterChange = (id: string, key: 'column' | 'values', value: string | string[]) => {
        setDynamicFilters(prev => prev.map(f => {
            if (f.id === id) {
                if (key === 'column') {
                    // Reset values when column changes
                    return { ...f, column: value as string, values: [] };
                }
                return { ...f, [key]: value };
            }
            return f;
        }));
    };

    const addDynamicFilter = () => {
        setDynamicFilters(prev => [...prev, { id: `filter-${Date.now()}`, column: '', values: [] }]);
    };

    const removeDynamicFilter = (id: string) => {
        setDynamicFilters(prev => prev.filter(f => f.id !== id));
    };

    const getOptionsForColumn = (columnName: string): Option[] => {
        if (!columnName) return [];
        const normalizedColName = normalizeLabel(columnName);
        const valueSet = new Set<string>();
        filteredSales.forEach(sale => {
            const val = sale.sheetData?.[normalizedColName];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                valueSet.add(String(val));
            }
        });
        return Array.from(valueSet).sort().map(v => ({ label: v, value: v }));
    };

    // Options for filters
    const marketplaces = useMemo(() => Array.from(new Set(sales.map(s => (s as any).marketplace_name).filter(Boolean))).sort((a,b) => a.localeCompare(b)), [sales]);
    const states = useMemo(() => Array.from(new Set(sales.map(s => (s as any).state_name).filter(Boolean))).sort((a,b) => a.localeCompare(b)), [sales]);
    const accounts = useMemo(() => Array.from(new Set(sales.map(s => (s as any).auth_name).filter(Boolean))).sort((a,b) => a.localeCompare(b)), [sales]);
    
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
                             <Button variant="outline" onClick={() => setIsRefinementOpen(true)} disabled={conciliationStats.unreconciledCount === 0}>
                                <Edit className="mr-2 h-4 w-4" />
                                Refinar ({conciliationStats.unreconciledCount})
                            </Button>
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
                    <div className="flex items-end justify-between">
                         <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                         <div className="text-right space-y-1">
                            <div className="flex items-center justify-end gap-2 text-sm font-semibold text-muted-foreground">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>Dados conciliados</span>
                                <span className="text-primary font-bold">{conciliationStats.percentage.toFixed(0)}%</span>
                            </div>
                            <Progress value={conciliationStats.percentage} className="w-48 h-2"/>
                         </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resumo do Período</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                     <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground">Faturamento Bruto</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(summaryStats.faturamento)}</p>
                    </div>
                    <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground">Custo do Produto (CMV)</p>
                        <p className="text-2xl font-bold text-destructive">{formatCurrency(summaryStats.custoProduto)}</p>
                    </div>
                    <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground">Margem de Contribuição</p>
                        <p className="text-2xl font-bold">{summaryStats.margemContribuicao.toFixed(2)}%</p>
                    </div>
                    <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground">Lucro Líquido Real</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(summaryStats.lucroLiquido)}</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        <CardTitle className="text-lg">Filtros Adicionais</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    </div>
                     {customFilterFields.length > 0 && (
                        <div className="pt-4 space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground">Filtros Personalizados (Dados de Apoio)</h4>
                            <div className="space-y-2">
                                {dynamicFilters.map((filter, index) => (
                                    <div key={filter.id} className="flex flex-col sm:flex-row items-center gap-2 p-2 border rounded-md bg-muted/50">
                                        <Select
                                            value={filter.column}
                                            onValueChange={(value) => handleDynamicFilterChange(filter.id, 'column', value)}
                                        >
                                            <SelectTrigger className="w-full sm:w-[240px] bg-background">
                                                <SelectValue placeholder="Selecione uma coluna..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {customFilterFields.map(field => (
                                                    <SelectItem key={field} value={normalizeLabel(field)}>{field}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        
                                        <MultiSelect
                                            options={getOptionsForColumn(filter.column)}
                                            value={filter.values}
                                            onChange={(values) => handleDynamicFilterChange(filter.id, 'values', values)}
                                            placeholder="Selecione valores..."
                                            className="flex-1"
                                        />
                                        
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeDynamicFilter(filter.id)}
                                            disabled={dynamicFilters.length === 1}
                                        >
                                            <XCircle className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button variant="secondary" size="sm" onClick={addDynamicFilter}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Adicionar Filtro
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <SalesTable
              data={filteredSales}
              products={products}
              supportData={supportData}
              onUpdateSaleData={handleUpdateSaleData}
              calculateTotalCost={calculateTotalCost}
              calculateNetRevenue={calculateNetRevenue}
              formatCurrency={formatCurrency}
              isLoading={isLoading}
              productCostSource={pickingLogsMap}
              customCalculations={customCalculations}
              onOpenTicket={handleOpenTicketDialog}
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
            marketplaces={marketplaces}
            availableColumns={availableFormulaColumns}
            customCalculations={customCalculations}
        />
        
        <CostRefinementDialog
            isOpen={isRefinementOpen}
            onClose={() => setIsRefinementOpen(false)}
            onSave={handleSaveRefinedCosts}
            sales={filteredSales.filter(s => !(pickingLogsMap.has((s as any).order_code)))}
            products={products}
        />
        
        {selectedSaleForTicket && (
            <TicketDialog
                isOpen={isTicketDialogOpen}
                onClose={() => {
                    setIsTicketDialogOpen(false);
                    setSelectedSaleForTicket(null);
                }}
                order={selectedSaleForTicket}
                onSaveChanges={handleUpdateSaleData}
            />
        )}
        </>
    );
}


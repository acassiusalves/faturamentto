
'use client';

import { useState, useEffect, useMemo, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Search, Calendar as CalendarIcon, Trash2, Tablets, Bot, Loader2, Info, ExternalLink, ChevronLeft, Download } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { analyzeFeedAction } from '@/app/actions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { loadAllFeedEntries, deleteFeedEntry, saveFeedEntry, loadAppSettings } from '@/services/firestore';


const API_KEY_STORAGE_KEY = 'gemini_api_key';
const MODEL_STORAGE_KEY = 'gemini_model';


interface ProductDetail {
  sku: string;
  name: string;
  costPrice: string;
}

interface FeedEntry {
    storeName: string;
    date: string; // yyyy-MM-dd
    products: ProductDetail[];
    id: string;
}

type ProductStatus = 'PRECO_OK' | 'ATENCAO' | 'OPORTUNIDADE';

interface ProductAnalysis {
    sku: string;
    status: ProductStatus;
    justification: string;
}

interface ComparisonProduct {
    sku: string;
    name: string;
    prices: Record<string, number | null>; // Record<storeName, price>
    averagePrice: number;
    minPrice: number | null;
    maxPrice: number | null;
    storeCount: number;
    analysis?: ProductAnalysis;
}

interface IncorrectOffer {
    sku: string;
    storeName: string;
    id: string;
}

const statusConfig: Record<ProductStatus, { variant: "default" | "destructive" | "secondary", text: string, icon?: React.ReactNode }> = {
    PRECO_OK: { variant: 'secondary', text: 'Preço OK' },
    ATENCAO: { variant: 'destructive', text: 'Atenção' },
    OPORTUNIDADE: { variant: 'default', text: 'Oportunidade' }
};

export default function FeedListPage() {
    const [allFeedData, setAllFeedData] = useState<FeedEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [apiKey, setApiKey] = useState('');
    const [modelName, setModelName] = useState('gemini-1.5-flash-latest');
    const [progress, setProgress] = useState(0);
    const { toast } = useToast();

    const [analysisState, formAction, isAnalyzing] = useActionState(analyzeFeedAction, {
        result: null,
        error: null,
    });
    
    const fetchFeedData = async () => {
        setIsLoading(true);
        try {
            const data = await loadAllFeedEntries();
            setAllFeedData(data);
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Erro ao Carregar Feed',
                description: 'Não foi possível carregar os dados do feed da base de dados.',
            });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        // Set date on client-side only to avoid hydration mismatch
        setSelectedDate(new Date());
        fetchFeedData();

        async function loadApiSettings() {
            try {
                const settings = await loadAppSettings();
                if (settings?.geminiApiKey) {
                    setApiKey(settings.geminiApiKey);
                }
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Erro ao Carregar Configurações',
                    description: 'Não foi possível carregar as configurações de API do sistema.',
                });
            }
        }
        loadApiSettings();
    }, [toast]);
    
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isAnalyzing) {
            setProgress(0);
            timer = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(timer);
                        return prev;
                    }
                    return prev + 5;
                });
            }, 200);
        } else {
            setProgress(100);
            setTimeout(() => setProgress(0), 500); // Reset after completion animation
        }
        return () => clearInterval(timer);
    }, [isAnalyzing]);

    useEffect(() => {
        if(analysisState.error) {
            toast({
                variant: 'destructive',
                title: 'Erro na Análise',
                description: analysisState.error,
            });
        }
    }, [analysisState, toast]);
    
    const { comparisonData, uniqueStores, entriesForSelectedDate, incorrectOffers } = useMemo(() => {
        const productMap = new Map<string, Omit<ComparisonProduct, 'prices' | 'averagePrice' | 'minPrice' | 'maxPrice' | 'storeCount'> & { prices: Map<string, number | null> }>();
        const storeSet = new Set<string>();

        const filteredFeed = selectedDate 
            ? allFeedData.filter(entry => entry.date === format(selectedDate, 'yyyy-MM-dd'))
            : [];
        
        const entriesForSelectedDate = filteredFeed.length;

        filteredFeed.forEach(entry => {
            if (entry.storeName) {
                storeSet.add(entry.storeName);
            }
            entry.products.forEach(product => {
                if (!product.sku || product.sku.toUpperCase() === 'SEM CÓDIGO') {
                    return;
                }

                if (!productMap.has(product.sku)) {
                    productMap.set(product.sku, {
                        sku: product.sku,
                        name: product.name,
                        prices: new Map<string, number | null>(),
                    });
                }

                const existingProduct = productMap.get(product.sku)!;

                if (product.name.length > existingProduct.name.length) {
                    existingProduct.name = product.name;
                }
                const price = product.costPrice ? parseFloat(product.costPrice.replace(',', '.')) : NaN;
                existingProduct.prices.set(entry.storeName, isNaN(price) ? null : price);
            });
        });

        const comparisonData: ComparisonProduct[] = Array.from(productMap.values()).map(p => {
            const priceValues = Array.from(p.prices.values()).filter((price): price is number => price !== null);

            const averagePrice = priceValues.length > 0
                ? priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length
                : 0;

            const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
            const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;


            // Check for analysis result and merge it
            const analysisResult = analysisState.result?.analysis.find(a => a.sku === p.sku);

            return {
                ...p,
                prices: Object.fromEntries(p.prices),
                averagePrice,
                minPrice,
                maxPrice,
                storeCount: priceValues.length,
                analysis: analysisResult,
            }
        });

        // Sort by storeCount (desc) and then by name (asc)
        comparisonData.sort((a, b) => {
            if (a.storeCount !== b.storeCount) {
              return b.storeCount - a.storeCount;
            }
            return a.name.localeCompare(b.name);
          });
          
        const incorrectOffers: IncorrectOffer[] = [];
        comparisonData.forEach(product => {
            if(product.analysis?.status === 'ATENCAO') {
                const DEVIATION_THRESHOLD = 0.20; // 20%
                Object.entries(product.prices).forEach(([storeName, price]) => {
                    if (price !== null && product.averagePrice > 0) {
                        const deviation = Math.abs(price - product.averagePrice) / product.averagePrice;
                         if (deviation > DEVIATION_THRESHOLD) {
                             const id = `${storeName}-${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}`;
                             incorrectOffers.push({ sku: product.sku, storeName, id });
                        }
                    }
                });
            }
        });

        return {
            comparisonData,
            uniqueStores: Array.from(storeSet).sort(),
            entriesForSelectedDate,
            incorrectOffers,
        };
    }, [allFeedData, selectedDate, analysisState.result]);

    const filteredData = useMemo(() => {
        if (!filter) return comparisonData;
        const lowerCaseFilter = filter.toLowerCase();
        return comparisonData.filter(p => 
            p.name.toLowerCase().includes(lowerCaseFilter) ||
            p.sku.toLowerCase().includes(lowerCaseFilter)
        );
    }, [comparisonData, filter]);

    const handleDeleteIncorrectOffers = async () => {
        if (!selectedDate || incorrectOffers.length === 0) return;
    
        try {
            const offersToDelete = new Set(incorrectOffers.map(offer => offer.id));
            const skusToDelete = new Map<string, Set<string>>(); // Map<id, Set<sku>>
            incorrectOffers.forEach(offer => {
                if (!skusToDelete.has(offer.id)) {
                    skusToDelete.set(offer.id, new Set());
                }
                skusToDelete.get(offer.id)!.add(offer.sku);
            });
            
            let updatedFeedData = [...allFeedData];

            skusToDelete.forEach((skuSet, id) => {
                const entryIndex = updatedFeedData.findIndex(e => e.id === id);
                if (entryIndex > -1) {
                    const originalEntry = updatedFeedData[entryIndex];
                    const newProducts = originalEntry.products.filter(p => !skuSet.has(p.sku));
                    
                    if (newProducts.length === 0) {
                        deleteFeedEntry(id);
                    } else {
                        const updatedEntry = { ...originalEntry, products: newProducts };
                        saveFeedEntry(updatedEntry);
                    }
                }
            });
    
            await fetchFeedData(); // Refresh data from Firestore
            
            analysisState.result = null;

            toast({
                title: 'Sucesso!',
                description: `${incorrectOffers.length} ofertas incorretas foram removidas.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Apagar',
                description: 'Não foi possível apagar as ofertas incorretas.',
            });
        }
    };

    const handleDeleteDataForDay = async () => {
        if (!selectedDate) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Por favor, selecione uma data para apagar os dados.',
            });
            return;
        }

        try {
            const dateToFilter = format(selectedDate, 'yyyy-MM-dd');
            const entriesToDelete = allFeedData.filter(entry => entry.date === dateToFilter);

            for (const entry of entriesToDelete) {
                await deleteFeedEntry(entry.id);
            }
            
            await fetchFeedData(); // Refresh data

            toast({
                title: 'Sucesso!',
                description: `Todos os dados do dia ${format(selectedDate, 'dd/MM/yyyy')} foram removidos.`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Apagar',
                description: 'Não foi possível apagar os dados do feed.',
            });
        }
    };

    const handleDeleteStoreData = async (storeName: string) => {
        if (!selectedDate) return;
        const entryId = `${storeName}-${format(selectedDate, 'yyyy-MM-dd')}`;
        try {
            await deleteFeedEntry(entryId);
            await fetchFeedData();
            toast({
                title: "Lista Removida!",
                description: `A lista de preços da loja ${storeName} foi removida com sucesso.`,
            });
        } catch(error) {
            console.error("Error deleting feed entry:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao Apagar',
                description: 'Não foi possível apagar a lista da loja.',
            });
        }
    }
    
    const handleExportXLSX = () => {
        const dataToExport = filteredData.map(product => {
            const row: Record<string, any> = {
                'Produto': product.name,
                'SKU': product.sku,
                'Média': product.averagePrice,
            };
            uniqueStores.forEach(store => {
                row[store] = product.prices[store] ?? null;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);

        // Format currency columns
        const currencyFormat = 'R$ #,##0.00';
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let C = 2; C < 2 + uniqueStores.length + 1; ++C) { // Start from Média column
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                const cell_address = { c: C, r: R };
                const cell = XLSX.utils.encode_cell(cell_address);
                if (ws[cell] && typeof ws[cell].v === 'number') {
                    ws[cell].z = currencyFormat;
                }
            }
        }
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Comparativo ${format(selectedDate || new Date(), 'yyyy-MM-dd')}`);
        XLSX.writeFile(wb, `comparativo_precos.xlsx`);
    };


    const formatCurrency = (value: number | null) => {
        if (value === null || isNaN(value)) return '-';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    }

    if (isLoading) {
        return (
             <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
                 <div className="flex items-center justify-center h-96">
                    <Loader2 className="animate-spin" />
                 </div>
             </main>
        )
    }

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <Link href="/feed-25" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit mb-4">
                <ChevronLeft className="h-4 w-4" />
                voltar
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Feed Comparativo de Preços</CardTitle>
                    <CardDescription>
                        Compare os preços dos mesmos produtos entre diferentes listas para a data selecionada.
                        A análise com IA também será aplicada apenas para a data escolhida.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {allFeedData.length > 0 ? (
                        <TooltipProvider>
                            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                    type="search"
                                    placeholder="Filtrar por nome ou SKU..."
                                    className="w-full rounded-lg bg-white pl-8"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    />
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-[240px] justify-start text-left font-normal",
                                            !selectedDate && "text-muted-foreground"
                                        )}
                                        disabled={!selectedDate}
                                        >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={setSelectedDate}
                                        initialFocus
                                        locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <form action={formAction}>
                                    <input type="hidden" name="feedData" value={JSON.stringify(comparisonData)} />
                                    <input type="hidden" name="apiKey" value={apiKey} />
                                    <input type="hidden" name="modelName" value={modelName} />
                                    <Button type="submit" className="w-full sm:w-auto" disabled={isAnalyzing || comparisonData.length === 0 || !apiKey}>
                                        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4" />}
                                        Analisar com IA
                                    </Button>
                                </form>
                                 <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportXLSX} disabled={filteredData.length === 0}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar XLSX
                                 </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full sm:w-auto" disabled={entriesForSelectedDate === 0}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Apagar Dados do Dia
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Essa ação não pode ser desfeita. Isso irá apagar permanentemente
                                            todas as {entriesForSelectedDate} listas de preços enviadas para a data{' '}
                                            {selectedDate && <strong>{format(selectedDate, 'dd/MM/yyyy')}</strong>}.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteDataForDay}>Continuar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            
                            {isAnalyzing && progress > 0 && (
                                <div className="mb-6 space-y-2">
                                    <Progress value={progress} className="w-full" />
                                    <p className="text-sm text-center text-muted-foreground">Analisando... um momento.</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2 mb-4">
                               <div className="flex items-center gap-2">
                                 <Tablets className="h-5 w-5 text-muted-foreground" />
                                 <h3 className="text-lg font-semibold">Tabela de Preços</h3>
                               </div>
                               {incorrectOffers.length > 0 && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/50">
                                            Excluir {incorrectOffers.length} oferta(s) incorreta(s)
                                            <Trash2 className="ml-2 h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir Ofertas Incorretas?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Você tem certeza que deseja excluir as <strong>{incorrectOffers.length}</strong> ofertas sinalizadas como "Atenção"? Esta ação removerá os produtos das suas respectivas listas para esta data e não pode ser desfeita.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteIncorrectOffers}>
                                                Sim, Excluir Ofertas
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                               )}
                            </div>

                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[250px] sticky left-0 bg-card z-10">Produto</TableHead>
                                            <TableHead className="text-right min-w-[120px] font-bold bg-muted/50">Média</TableHead>
                                            <TableHead className="text-center min-w-[150px]">Status</TableHead>
                                            {uniqueStores.map(store => (
                                                <TableHead key={store} className="text-right min-w-[150px]">
                                                   <div className="flex items-center justify-end gap-1">
                                                        {store}
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                                                    <Trash2 className="h-3 w-3"/>
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Apagar lista da loja "{store}"?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta ação removerá permanentemente todos os dados de preço desta loja para o dia selecionado.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteStoreData(store)}>Sim, Apagar</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.length > 0 ? filteredData.map(product => (
                                            <TableRow key={product.sku}>
                                                <TableCell className="font-medium sticky left-0 bg-card z-10">
                                                    <div className="font-bold">{product.name}</div>
                                                    <div className="text-xs text-muted-foreground">{product.sku} ({product.storeCount} lojas)</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold bg-muted/50">
                                                    <div className={cn(
                                                        "rounded-md p-1",
                                                        product.averagePrice !== 0 && {
                                                            'bg-green-100 dark:bg-green-900/50': product.averagePrice === product.minPrice,
                                                        }
                                                    )}>
                                                        {formatCurrency(product.averagePrice)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {product.analysis && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant={statusConfig[product.analysis.status].variant} className="cursor-help">
                                                                    {statusConfig[product.analysis.status].text}
                                                                    <Info className="ml-1.5 h-3 w-3" />
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="max-w-xs">{product.analysis.justification}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                                {uniqueStores.map(store => {
                                                    const price = product.prices[store] ?? null;
                                                    const isMin = price !== null && price === product.minPrice;
                                                    const isMax = price !== null && price === product.maxPrice;
                                                    
                                                    return (
                                                        <TableCell key={store} className={cn("text-right font-mono", {
                                                            'bg-green-100 dark:bg-green-800/30': isMin,
                                                            'bg-red-100 dark:bg-red-800/30': isMax,
                                                        })}>
                                                            {formatCurrency(price)}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={uniqueStores.length + 3} className="h-24 text-center">
                                                    Nenhum produto encontrado para a data selecionada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TooltipProvider>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">Nenhuma lista foi enviada para o Feed ainda.</p>
                            <p className="text-sm text-muted-foreground mt-2">Processe uma lista na tela "Processar Lista" e clique em "Enviar para o Feed".</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

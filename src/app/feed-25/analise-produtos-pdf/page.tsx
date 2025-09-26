
"use client";

import React, { useState, useEffect, useTransition, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, ChevronLeft, ChevronRight, Play, FastForward, Search, Wand2, ChevronsLeft, ChevronsRight, PackageSearch, TrendingUp, Truck, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction, findTrendingProductsAction } from '@/app/actions';
import type { AnalyzeCatalogOutput, SearchableProduct } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchResultsDialog } from './search-results-dialog';
import { buildSearchQuery } from "@/lib/search-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { searchMercadoLivreAction } from '@/app/actions';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parsePriceToNumber, formatBRL } from '@/lib/utils';
import { loadAppSettings } from '@/services/firestore';


// PDF.js dinâmico
let pdfjs: any = null;

const initPDFjs = async () => {
  if (typeof window !== "undefined" && !pdfjs) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Use the CDN-hosted worker to avoid build issues.
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }
      
      pdfjs = pdfjsLib;
      return pdfjsLib;
    } catch (error) {
      console.error('Erro ao carregar PDF.js:', error);
      return null;
    }
  }
  return pdfjs;
};


const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const norm = (s?: string | null) => {
  const t = (s ?? '').trim().toLowerCase();
  return stripAccents(t);
};

// Normaliza qualquer payload de "tendências" para um Map<queryNormalizada, string[] de keywords>
const normalizeTrendingPayload = (
  payload: any,
  products: SearchableProduct[],
  keyForProduct: (p: SearchableProduct) => string
) => {
  const map = new Map<string, string[]>();
  if (!payload) return map;

  // Helper p/ extrair possível "chave" do item retornado
  const extractItemKey = (item: any) =>
    norm(
      item?.query ??
      item?.productName ??
      item?.name ??
      item?.term ??
      item?.keyword ??
      item?.key ??
      item?.queryText ??
      item?.q
    );

  // Helper p/ extrair lista de keywords do item
  const extractItemKeywords = (item: any): string[] => {
    const kws =
      item?.matchedKeywords ??
      item?.keywords ??
      item?.matches ??
      item?.terms ??
      item?.trending ??
      item?.keys ??
      [];
    return Array.isArray(kws) ? kws.map(norm) : [];
  };

  // Caso 1: array
  if (Array.isArray(payload)) {
    let keyed = false;

    for (const item of payload) {
      if (item && typeof item === 'object') {
        const k = extractItemKey(item);
        const kws = extractItemKeywords(item);
        if (k) {
          map.set(k, kws);
          keyed = true;
        }
      }
    }

    if (keyed) return map;

    // Sem chave → pode ser array de strings (keywords soltas)
    const keywords = payload.filter((x) => typeof x === 'string').map(norm);
    if (keywords.length) {
      // Fallback: marca “em alta” se a query do produto contiver alguma keyword
      for (const p of products) {
        const key = keyForProduct(p);
        const hits = keywords.filter((kw) => kw && key.includes(kw));
        if (hits.length) map.set(key, hits);
      }
      return map;
    }
  }

  // Caso 2: objeto simples { [query]: string[] }
  if (payload && typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload)) {
      if (typeof k === 'string') {
        if (Array.isArray(v)) map.set(norm(k), v.map(norm));
        else if (v && typeof v === 'object') {
          // também aceita { [query]: { keywords:[...] } }
          const kws = extractItemKeywords(v);
          map.set(norm(k), kws);
        }
      }
    }
    if (map.size) return map;
  }

  return map;
};

// Extrai "trendingProducts" independentemente do envelope que a action usar
const extractTrendingArray = (raw: any) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;

  // caminhos comuns
  if (Array.isArray(raw.trendingProducts)) return raw.trendingProducts;
  if (Array.isArray(raw.trends)) return raw.trends;
  if (Array.isArray(raw.matches)) return raw.matches;
  if (Array.isArray(raw.data)) return raw.data;

  if (raw.result) {
    if (Array.isArray(raw.result.trendingProducts)) return raw.result.trendingProducts;
    if (Array.isArray(raw.result.trends)) return raw.result.trends;
    if (Array.isArray(raw.result.matches)) return raw.result.matches;
    if (Array.isArray(raw.result)) return raw.result;
  }

  return null;
};

const getShippingCostFor1To2Kg = (price: number): number | null => {
    if (price >= 200) return 28.14;
    if (price >= 150) return 25.80;
    if (price >= 120) return 23.45;
    if (price >= 100) return 21.11;
    if (price >= 79) return 18.76;
    return null;
};

const toNumberSafe = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export default function CatalogoPdfPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isParsing, setIsParsing] = useState(false);
    const [allProducts, setAllProducts] = useState<SearchableProduct[]>([]);
    const [brand, setBrand] = useState('');
    const [pdfJsReady, setPdfJsReady] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    
    // Estados para análise
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    const [analyzeState, setAnalyzeState] = useState<{
        result: AnalyzeCatalogOutput | null;
        error: string | null;
    }>({ result: null, error: null });
    
    // Estados para busca
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [selectedProductForSearch, setSelectedProductForSearch] = useState<SearchableProduct | null>(null);
    const [productSearchTerm, setProductSearchTerm] = useState('');


    // Paginação
    const [productsPageIndex, setProductsPageIndex] = useState(0);
    const [productsPageSize, setProductsPageSize] = useState(10);
    
    // Busca em lote
    const [isBatchSearching, setIsBatchSearching] = useState(false);
    const [batchSearchProgress, setBatchSearchProgress] = useState(0);
    const [batchSearchResults, setBatchSearchResults] = useState<any[]>([]);
    const [batchSearchStatus, setBatchSearchStatus] = useState('');

    // Paginação de resultados agrupados
    const [groupedResultPageIndex, setGroupedResultPageIndex] = useState(0);
    const [groupedResultPageSize, setGroupedResultPageSize] = useState(5);
    
    const abortRef = useRef<AbortController | null>(null);
    const [progressPct, setProgressPct] = useState(0);
    

    // Inicializa PDF.js e carrega a chave Gemini
    useEffect(() => {
        let mounted = true;
        
        async function loadInitialData() {
          const [pdfjsLib, settings] = await Promise.all([
            initPDFjs(),
            loadAppSettings(),
          ]);

          if (mounted) {
            if (pdfjsLib) setPdfJsReady(true);
            if (settings?.geminiApiKey) setGeminiApiKey(settings.geminiApiKey);
          }
        }

        loadInitialData();
        return () => { mounted = false; };
    }, []);

    const analyzePage = useCallback(
        async (pageNumber: number, signal?: AbortSignal) => {
          if (!pdfDoc || pageNumber > pdfDoc.numPages) return false;
          if (signal?.aborted) return false;
      
          try {
            const page = await pdfDoc.getPage(pageNumber);
            if (signal?.aborted) return false;
      
            const textContent = await page.getTextContent();
            if (signal?.aborted) return false;
      
            const pageText = textContent.items
              .map((item: any) => ('str' in item ? item.str : ''))
              .join(' ');
      
            const formData = new FormData();
            formData.append('pdfContent', pageText || ' ');
            formData.append('pageNumber', String(pageNumber));
            formData.append('totalPages', String(pdfDoc.numPages));
            formData.append('brand', brand);
            if (geminiApiKey) formData.append('apiKey', geminiApiKey);
      
            const result = await analyzeCatalogAction(analyzeState, formData);
            if (signal?.aborted) return false;
      
            setAnalyzeState(result);
      
            // push produtos (se houver)
            if (result?.result?.products?.length) {
              const newProducts = result.result.products.map((p: any) => ({
                ...p,
                refinedQuery: buildSearchQuery({
                  name: p.name,
                  description: p.description,
                  model: p.model,
                  brand: p.brand || brand,
                }),
              }));
      
              setAllProducts(prev => {
                const existing = new Set(prev.map(prod => prod.name));
                const uniques = newProducts.filter(prod => !existing.has(prod.name));
                return [...prev, ...uniques];
              });
            }
      
            return true;
          } catch (err) {
            console.error('Erro ao analisar página', err);
            toast({
              variant: 'destructive',
              title: 'Erro na Análise',
              description: 'Falha ao ler o texto do PDF nesta página.',
            });
            return false;
          }
        },
        [pdfDoc, brand, toast, analyzeState, geminiApiKey]
      );

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            if (!pdfJsReady) {
                toast({ 
                    variant: 'destructive', 
                    title: 'PDF.js não carregado', 
                    description: 'Aguarde o carregamento da biblioteca PDF.js.' 
                });
                return;
            }

            // RESET total
            abortRef.current?.abort();
            abortRef.current = null;
            setProgressPct(0);
            setFile(selectedFile);
            setIsParsing(true);
            setAllProducts([]);
            setCurrentPage(1);
            setPdfDoc(null);
            setIsAnalyzingAll(false);
            
            try {
                const arrayBuffer = await selectedFile.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                setPdfDoc(pdf);
            } catch (error) {
                console.error('Erro ao carregar PDF:', error);
                toast({ 
                    variant: 'destructive', 
                    title: 'Erro ao ler PDF', 
                    description: 'Não foi possível processar o arquivo PDF.' 
                });
            } finally {
                setIsParsing(false);
            }
        } else {
            toast({ variant: 'destructive', title: 'Arquivo Inválido', description: 'Por favor, selecione um arquivo PDF válido.' });
            setFile(null);
        }
    };

    const handleAnalyzeAllClick = async () => {
        if (!pdfDoc || isParsing) return;
      
        // se já estiver rodando, ignora
        if (isAnalyzingAll) return;
      
        setAllProducts([]);
        setProgressPct(0);
        setCurrentPage(1);
        setIsAnalyzingAll(true);
      
        // cria controller p/ cancelar
        const controller = new AbortController();
        abortRef.current = controller;
      
        const total = pdfDoc.numPages;
      
        for (let p = 1; p <= total; p++) {
          if (controller.signal.aborted) break;
      
          setCurrentPage(p);
          const ok = await analyzePage(p, controller.signal);
      
          // atualiza barra mesmo se a página falhou (para não “travar”)
          setProgressPct(Math.round((p / total) * 100));
      
          // opcional: inserir pequeno atraso para UI respirar
          // await new Promise(r => setTimeout(r, 50));
      
          if (!ok && controller.signal.aborted) break;
        }
      
        setIsAnalyzingAll(false);
        abortRef.current = null;
      };

    const handleCancelAnalyzeAll = () => {
        abortRef.current?.abort();
        setIsAnalyzingAll(false);
        // não zera os resultados já obtidos; só para o processo
    };
    
    const handleAnalyzeNextClick = async () => {
        if (!pdfDoc) return;
        if (isParsing || isAnalyzingAll) return;
      
        const p = currentPage;
        if (p > pdfDoc.numPages) return;
      
        await analyzePage(p);
        setCurrentPage(prev => prev + 1);
        setProgressPct(Math.round((p / pdfDoc.numPages) * 100));
      };
    
    const handleSearchOffers = useCallback((product: SearchableProduct) => {
        setSelectedProductForSearch(product);
        setIsSearchDialogOpen(true);
    }, []);
    
    const handleRefinedQueryChange = (index: number, newQuery: string) => {
        setAllProducts(prev => {
            const newProducts = [...prev];
            const originalIndex = (productsPageIndex * productsPageSize) + index;
            newProducts[originalIndex] = { ...newProducts[originalIndex], refinedQuery: newQuery };
            return newProducts;
        });
    };
    
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copiado!',
            description: `O texto "${text}" foi copiado para a área de transferência.`,
        });
    };

    const filteredProducts = useMemo(() => {
        if (!productSearchTerm.trim()) {
            return allProducts;
        }
        const lowercasedTerm = productSearchTerm.toLowerCase();
        return allProducts.filter(product => 
            product.name.toLowerCase().includes(lowercasedTerm) ||
            (product.model && product.model.toLowerCase().includes(lowercasedTerm)) ||
            (product.refinedQuery && product.refinedQuery.toLowerCase().includes(lowercasedTerm))
        );
    }, [allProducts, productSearchTerm]);


    const productsPageCount = useMemo(() => Math.ceil(filteredProducts.length / productsPageSize), [filteredProducts.length, productsPageSize]);
    const paginatedProducts = useMemo(() => {
        const startIndex = productsPageIndex * productsPageSize;
        return filteredProducts.slice(startIndex, startIndex + productsPageSize);
    }, [filteredProducts, productsPageIndex, productsPageSize]);

    const handleBatchSearch = async () => {
        if (isBatchSearching || allProducts.length === 0) return;
        setIsBatchSearching(true);
        setBatchSearchResults([]);
        setBatchSearchProgress(0);

        for (let i = 0; i < allProducts.length; i++) {
            const product = allProducts[i];
            const progressPercentage = ((i + 1) / allProducts.length) * 100;
            setBatchSearchProgress(progressPercentage);
            setBatchSearchStatus(`Buscando ${i + 1} de ${allProducts.length}: ${product.name}`);

            const formData = new FormData();
            formData.append('productName', product.refinedQuery || product.name);
            formData.append('quantity', '50');
            
            const searchResult = await searchMercadoLivreAction({ result: null, error: null }, formData);
            if (searchResult?.result) {
                const matchingOffers = searchResult.result.filter((offer: any) => 
                    offer.model?.toLowerCase() === product.model?.toLowerCase()
                );

                if (matchingOffers.length > 0) {
                    const offersWithProductInfo = matchingOffers.map(offer => ({
                        ...offer,
                        originalProductName: product.name,
                        originalProductPrice: product.price // Adicionando o preço original aqui
                    }));
                    setBatchSearchResults(prev => [...prev, ...offersWithProductInfo]);
                }
            }
            await new Promise(res => setTimeout(res, 200));
        }

        setIsBatchSearching(false);
        setBatchSearchStatus('Busca concluída!');
    };

    const groupedBatchResults = useMemo(() => {
        const groups = new Map<string, { offers: any[], originalPrice: string }>();
        batchSearchResults.forEach(offer => {
            const modelKey = offer.model || 'Outros Modelos';
            if (!groups.has(modelKey)) {
                groups.set(modelKey, { offers: [], originalPrice: offer.originalProductPrice });
            }
            groups.get(modelKey)!.offers.push(offer);
        });
        return Array.from(groups.entries());
    }, [batchSearchResults]);
    
    const groupedResultPageCount = useMemo(() => Math.ceil(groupedBatchResults.length / groupedResultPageSize), [groupedBatchResults.length, groupedResultPageSize]);
    
    const paginatedGroupedResults = useMemo(() => {
        const startIndex = groupedResultPageIndex * groupedResultPageSize;
        return groupedBatchResults.slice(startIndex, startIndex + groupedResultPageSize);
    }, [groupedBatchResults, groupedResultPageIndex, groupedResultPageSize]);

    return (
        <>
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <BookImage className="h-6 w-6" />
                        Análise de Catálogo PDF
                    </CardTitle>
                    <CardDescription>
                       Faça o upload do seu catálogo em PDF e a IA irá extrair e listar os produtos para você, página por página.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pdf-upload">Arquivo do Catálogo (.pdf)</Label>
                                <Input 
                                    id="pdf-upload" 
                                    type="file" 
                                    accept="application/pdf" 
                                    onChange={handleFileChange}
                                    disabled={!pdfJsReady}
                                />
                                {!pdfJsReady && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Carregando biblioteca PDF.js...
                                    </p>
                                )}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="brand">Marca</Label>
                                <Input id="brand" placeholder="Ex: Xiaomi" value={brand} onChange={(e) => setBrand(e.target.value)} />
                            </div>
                        </div>
                    </form>
                </CardContent>
                {pdfDoc && (
                  <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex-grow w-full">
                      {isParsing ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Preparando PDF...</span>
                        </div>
                      ) : isAnalyzingAll ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Analisando página {currentPage} de {pdfDoc.numPages}...</span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Pronto para analisar. {pdfDoc.numPages} páginas encontradas.
                        </p>
                      )}
                      <Progress value={progressPct} className="w-full mt-2" />
                    </div>
                
                    <div className="flex gap-2 w-full sm:w-auto">
                      {isAnalyzingAll ? (
                        <Button onClick={handleCancelAnalyzeAll} variant="destructive">
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar
                        </Button>
                      ) : (
                        <>
                          <Button onClick={handleAnalyzeNextClick} disabled={isParsing || !pdfDoc || currentPage > pdfDoc.numPages}>
                            <Play className="mr-2 h-4 w-4" />
                            Analisar Próxima
                          </Button>
                          <Button onClick={handleAnalyzeAllClick} disabled={isParsing || !pdfDoc} variant="secondary">
                            <FastForward className="mr-2 h-4 w-4" />
                            Analisar Todas
                          </Button>
                        </>
                      )}
                    </div>
                  </CardFooter>
                )}
            </Card>
            
            {allProducts.length > 0 && (
                 <Card>
                    <CardHeader>
                         <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText />
                                    Produtos Extraídos ({filteredProducts.length})
                                </CardTitle>
                                <CardDescription>
                                    Abaixo estão os produtos que a IA conseguiu extrair do catálogo.
                                </CardDescription>
                            </div>
                            <div className="flex items-center flex-wrap justify-end gap-2">
                                <div className="relative w-full sm:w-auto">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar produto..."
                                        className="pl-9 w-full sm:w-64"
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleBatchSearch} disabled={isBatchSearching}>
                                    {isBatchSearching ? <Loader2 className="animate-spin" /> : <Search />}
                                    Buscar todos no ML
                                </Button>
                            </div>
                        </div>
                        {isBatchSearching && (
                            <div className="space-y-2 mt-4">
                                <Progress value={batchSearchProgress} />
                                <p className="text-sm text-muted-foreground text-center">{batchSearchStatus}</p>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                         <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-2/5">Produto</TableHead>
                                        <TableHead className="min-w-[220px] w-[260px]">Modelo</TableHead>
                                        <TableHead>Marca</TableHead>
                                        <TableHead>Preço Unit.</TableHead>
                                        <TableHead>Total Cx</TableHead>
                                        <TableHead className="w-1/5">Termo de Busca (IA)</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProducts.map((product, index) => {
                                        const unitPrice = parsePriceToNumber(product.price);
                                        const totalBox = unitPrice * (product.quantityPerBox || 1);
                                        const trendingKeywords = product.matchedKeywords || [];

                                        return (
                                             <React.Fragment key={index}>
                                                <TableRow>
                                                    <TableCell>
                                                      <div className="flex items-center gap-4">
                                                        <div>
                                                          <p 
                                                            className="font-semibold cursor-pointer hover:text-primary"
                                                            onClick={() => handleCopyToClipboard(product.name)}
                                                            title="Clique para copiar"
                                                          >
                                                              {product.name}
                                                          </p>
                                                          <p className="text-xs text-muted-foreground">{product.description}</p>
                                                        </div>
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="align-top max-w-[480px]">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div
                                                                className="px-2 py-1 rounded-md border bg-muted/40 text-sm leading-tight whitespace-normal break-words w-full cursor-pointer hover:bg-muted"
                                                                title="Clique para copiar"
                                                                onClick={() => handleCopyToClipboard(product.model || '')}
                                                                >
                                                                {product.model || '—'}
                                                            </div>
                                                            {product.isTrending && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <div className="flex items-center gap-2 text-green-600 font-semibold text-xs whitespace-nowrap cursor-pointer">
                                                                                em alta <TrendingUp className="h-4 w-4" />
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="font-semibold">Buscas no Mercado Livre</p>
                                                                            <ul className="list-disc list-inside">
                                                                                {trendingKeywords.map(kw => <li key={kw}>{kw}</li>)}
                                                                            </ul>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                     <TableCell>
                                                        <Input 
                                                            value={product.brand || brand || ''}
                                                            readOnly
                                                            className="h-8 bg-muted/50"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono">{formatBRL(unitPrice)}</TableCell>
                                                    <TableCell className="font-mono font-semibold">{formatBRL(totalBox)}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={product.refinedQuery || ''}
                                                            onChange={(e) => handleRefinedQueryChange(index, e.target.value)}
                                                            placeholder="Aguardando IA..."
                                                            className="h-8"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button size="sm" onClick={() => handleSearchOffers(product)}>
                                                            <Search className="mr-2" />
                                                            Buscar no ML
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                             </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                        <div className="text-sm text-muted-foreground">
                            Total de {filteredProducts.length} produtos.
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Itens por página</p>
                                <Select
                                    value={`${productsPageSize}`}
                                    onValueChange={(value) => {
                                        setProductsPageSize(Number(value));
                                        setProductsPageIndex(0);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={productsPageSize.toString()} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[10, 20, 50, 100].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-sm font-medium">
                                Página {productsPageIndex + 1} de {productsPageCount > 0 ? productsPageCount : 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setProductsPageIndex(0)} disabled={productsPageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setProductsPageIndex(productsPageIndex - 1)} disabled={productsPageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setProductsPageIndex(productsPageIndex + 1)} disabled={productsPageIndex >= productsPageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setProductsPageIndex(productsPageCount - 1)} disabled={productsPageIndex >= productsPageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                            </div>
                        </div>
                    </CardFooter>
                 </Card>
            )}

             {groupedBatchResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PackageSearch />
                            Produtos Encontrados com Correspondência de Modelo
                        </CardTitle>
                        <CardDescription>
                            A busca automática encontrou estes anúncios no Mercado Livre que correspondem ao modelo dos produtos extraídos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" className="space-y-4">
                            {paginatedGroupedResults.map(([model, data]) => {
                                const { offers, originalPrice } = data;
                                const catalogCost = parsePriceToNumber(originalPrice);
                                return (
                                <AccordionItem key={model} value={model} className="border rounded-lg">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold">
                                        <div className="flex justify-between items-center w-full">
                                            <span>{model} ({offers.length} anúncios)</span>
                                            {Number.isFinite(catalogCost) && (
                                                <Badge variant="outline" className="text-sm">
                                                    Custo Catálogo: {formatBRL(catalogCost)}
                                                </Badge>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-0">
                                        <div className="space-y-2">
                                            {offers.map((offer: any) => {
                                                const salePrice = offer.price;
                                                const commissionValue = toNumberSafe(offer.fees?.sale_fee_amount);
                                                
                                                const shippingCost = getShippingCostFor1To2Kg(salePrice) || 0;
                                                
                                                const netValue = salePrice - commissionValue - catalogCost - shippingCost;
                                                const margin = salePrice > 0 ? (netValue / salePrice) * 100 : 0;
                                                
                                                let suggestedPrice = null;
                                                if (margin < 12 && (commissionValue + catalogCost + shippingCost) > 0) {
                                                   suggestedPrice = (commissionValue + catalogCost + shippingCost) / 0.88;
                                                 }


                                                return (
                                                    <div key={offer.id} className="grid grid-cols-[80px_1fr_auto] items-center gap-4 p-2 border-b last:border-b-0">
                                                        <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                            {offer.thumbnail && <Image src={offer.thumbnail} alt={offer.name} fill className="object-contain" data-ai-hint="product image" />}
                                                        </div>
                                                        <div className="flex-grow">
                                                            <div className="flex items-center gap-2">
                                                                <Link href={`https://www.mercadolivre.com.br/p/${offer.catalog_product_id}`} target="_blank" className="font-medium text-primary hover:underline">
                                                                    {offer.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                                </Link>
                                                                {offer.isAlreadyPosted && (
                                                                    <Badge className="bg-green-600 hover:bg-green-700">
                                                                        <CheckCircle className="mr-1 h-3 w-3"/>
                                                                        Ja postado
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            <p className="text-xs text-muted-foreground">ID Catálogo: {offer.catalog_product_id}</p>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                Marca: <Badge variant="outline">{offer.brand}</Badge> | Vendedor: <Badge variant="outline">{offer.seller_nickname}</Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-2 flex items-center flex-wrap gap-x-3 gap-y-1">
                                                                {offer.fees && (
                                                                    <>
                                                                        <span>Comissão: <b className="font-semibold text-foreground">{formatBRL(commissionValue)}</b></span>
                                                                    </>
                                                                )}
                                                                {shippingCost > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Truck className="h-3 w-3"/> Frete: <b className="font-semibold text-foreground">{formatBRL(shippingCost)}</b>
                                                                    </span>
                                                                )}
                                                                 {offer.date_created && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="h-3 w-3"/> Criado em: <b className="font-semibold text-foreground">{new Date(offer.date_created).toLocaleDateString('pt-BR')}</b>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-semibold text-lg text-primary">{formatBRL(salePrice)}</div>
                                                             {Number.isFinite(catalogCost) && (
                                                                <div className="mt-2 space-y-1">
                                                                    <div className="text-sm">Líquido por venda: <b className="font-semibold">{formatBRL(netValue)}</b></div>
                                                                    <div className="text-sm">M.C: <b className="font-semibold">{margin.toFixed(2)}%</b></div>
                                                                </div>
                                                            )}
                                                            {suggestedPrice !== null && (
                                                                <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 rounded-md text-amber-800 dark:text-amber-300">
                                                                    <p className="text-xs font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>Preço Mínimo Sugerido:</p>
                                                                    <p className="font-bold text-base">{formatBRL(suggestedPrice)}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                )
                            })}
                        </Accordion>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                        <div className="text-sm text-muted-foreground">
                            Total de {groupedBatchResults.length} modelos.
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Itens por página</p>
                                <Select
                                    value={`${groupedResultPageSize}`}
                                    onValueChange={(value) => {
                                        setGroupedResultPageSize(Number(value));
                                        setGroupedResultPageIndex(0);
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={groupedResultPageSize.toString()} />
                                    </SelectTrigger>
                                    <SelectContent side="top">
                                        {[5, 10, 20].map((size) => (
                                            <SelectItem key={size} value={`${size}`}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-sm font-medium">
                                Página {groupedResultPageIndex + 1} de {groupedResultPageCount > 0 ? groupedResultPageCount : 1}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setGroupedResultPageIndex(0)} disabled={groupedResultPageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setGroupedResultPageIndex(groupedResultPageIndex - 1)} disabled={groupedResultPageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setGroupedResultPageIndex(groupedResultPageIndex + 1)} disabled={groupedResultPageIndex >= groupedResultPageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setGroupedResultPageIndex(groupedResultPageCount - 1)} disabled={groupedResultPageIndex >= groupedResultPageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
            )}

        </main>

        {selectedProductForSearch && (
            <SearchResultsDialog
                isOpen={isSearchDialogOpen}
                onClose={() => setIsSearchDialogOpen(false)}
                product={selectedProductForSearch}
            />
        )}
        </>
    );
}
    

    

    

    







    

    

    

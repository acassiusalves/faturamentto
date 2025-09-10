"use client";

import React, { useState, useActionState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, ChevronLeft, ChevronRight, Play, FastForward, Search, Wand2, ChevronsLeft, ChevronsRight, PackageSearch, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction, findTrendingProductsAction } from '@/app/actions';
import type { AnalyzeCatalogOutput } from '@/lib/types';
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

// NOVA ABORDAGEM PARA PDF.JS - sem top-level await
let pdfjs: any = null;

const initPDFjs = async () => {
  if (typeof window !== "undefined" && !pdfjs) {
    try {
      // Importação dinâmica para evitar problemas de SSR
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configuração do worker de forma mais compatível
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      }
      
      pdfjs = pdfjsLib;
      console.log('✅ PDF.js carregado com sucesso');
      return pdfjsLib;
    } catch (error) {
      console.error('❌ Erro ao carregar PDF.js:', error);
      return null;
    }
  }
  return pdfjs;
};

const analyzeInitialState: {
  result: AnalyzeCatalogOutput | null;
  error: string | null;
} = {
  result: null,
  error: null,
};

interface CatalogProduct {
    name: string;
    model: string;
    brand: string;
    description: string;
    price: string;
    imageUrl?: string;
    quantityPerBox?: number;
}

export interface SearchableProduct extends CatalogProduct {
    refinedQuery?: string;
    isSearching?: boolean;
    searchError?: string;
    foundProducts?: any[];
    isTrending?: boolean;
    matchedKeywords?: string[];
}

// Helper para escolher o melhor termo de busca para tendências
const trendQueryFor = (p: SearchableProduct) => {
  const q =
    (p.refinedQuery?.trim() ||
     p.description?.trim() ||
     p.name?.trim() ||
     "").trim();

  return q;
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
    
    const [isAnalyzingPending, startAnalyzeTransition] = useTransition();
    const [isTrendingPending, startTrendingTransition] = useTransition();
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    
    const [state, formAction] = useActionState(analyzeCatalogAction, analyzeInitialState);
    const [trendingState, trendingAction, isTrendingActionPending] = useActionState(findTrendingProductsAction, { trendingProducts: null, error: null });
    
    // State for search dialog
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [selectedProductForSearch, setSelectedProductForSearch] = useState<SearchableProduct | null>(null);

    // Pagination State for extracted products
    const [productsPageIndex, setProductsPageIndex] = useState(0);
    const [productsPageSize, setProductsPageSize] = useState(10);
    
    // Batch Search State
    const [isBatchSearching, setIsBatchSearching] = useState(false);
    const [batchSearchProgress, setBatchSearchProgress] = useState(0);
    const [batchSearchResults, setBatchSearchResults] = useState<any[]>([]);
    const [batchSearchStatus, setBatchSearchStatus] = useState('');

    // Pagination state for grouped results
    const [groupedResultPageIndex, setGroupedResultPageIndex] = useState(0);
    const [groupedResultPageSize, setGroupedResultPageSize] = useState(5);

    // Inicializa PDF.js quando o componente monta
    useEffect(() => {
        initPDFjs().then((pdfjsLib) => {
            if (pdfjsLib) {
                setPdfJsReady(true);
            }
        });
    }, []);

    const analyzePage = useCallback(async (pageNumber: number) => {
      if (!pdfDoc || pageNumber > pdfDoc.numPages) {
        setIsAnalyzingAll(false);
        return;
      }
    
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
    
        const formData = new FormData();
        formData.append('pdfContent', pageText || ' '); 
        formData.append('pageNumber', String(pageNumber));
        formData.append('totalPages', String(pdfDoc.numPages));
        formData.append('brand', brand);
    
        startAnalyzeTransition(() => {
          formAction(formData);
        });
      } catch (err) {
        console.error('Erro ao analisar página', err);
        setIsAnalyzingAll(false);
        toast({
          variant: 'destructive',
          title: 'Erro na Análise',
          description: 'Falha ao ler o texto do PDF nesta página.',
        });
      }
    }, [pdfDoc, formAction, startAnalyzeTransition, toast, brand]);

     useEffect(() => {
        if (state.error) {
            toast({ variant: 'destructive', title: 'Erro na Análise', description: state.error });
            setIsAnalyzingAll(false);
            return;
        }

        if (state.result && state.result.products.length > 0) {
            const newProducts = state.result.products.map(p => ({
                ...p,
                refinedQuery: buildSearchQuery({
                    name: p.name,
                    description: p.description,
                    model: p.model,
                    brand: p.brand || brand,
                }),
            }));

            setAllProducts(prevProducts => {
                const existingProductNames = new Set(prevProducts.map(prod => prod.name));
                const uniqueNewProducts = newProducts.filter(prod => !existingProductNames.has(prod.name));
                return [...prevProducts, ...uniqueNewProducts];
            });
        }

        if (isAnalyzingAll) {
            const nextPage = currentPage + 1;
            if (nextPage <= (pdfDoc?.numPages || 0)) {
                setTimeout(() => setCurrentPage(nextPage), 2000);
            } else {
                setIsAnalyzingAll(false);
            }
        }
    }, [state, brand, toast, pdfDoc, isAnalyzingAll, currentPage]);
    
    useEffect(() => {
      if (trendingState.trendingProducts) {
        const trendingMap = new Map<string, string[]>();
        trendingState.trendingProducts.forEach(p => {
          if (p.productName && p.matchedKeywords) {
            trendingMap.set(p.productName, p.matchedKeywords);
          }
        });
        
        setAllProducts(prevProducts => 
          prevProducts.map(p => ({
            ...p,
            isTrending: trendingMap.has(trendQueryFor(p)),
            matchedKeywords: trendingMap.get(trendQueryFor(p)) || [],
          }))
        );
      }
      if (trendingState.error) {
        console.error("Erro ao buscar tendências:", trendingState.error);
        toast({
          variant: 'destructive',
          title: 'Erro ao Verificar Tendências',
          description: trendingState.error
        });
      }
    }, [trendingState, toast]);

    useEffect(() => {
        if (isAnalyzingAll && !isAnalyzingPending && currentPage <= (pdfDoc?.numPages || 0)) {
            analyzePage(currentPage);
        }
    }, [currentPage, isAnalyzingAll, isAnalyzingPending, analyzePage, pdfDoc?.numPages]);

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

    const handleAnalyzeAllClick = () => {
        if (!isAnalyzingPending) {
            setCurrentPage(1);
            setAllProducts([]);
            setIsAnalyzingAll(true);
        }
    };
    
    const handleAnalyzeNextClick = () => {
        if (!isAnalyzingPending && currentPage <= (pdfDoc?.numPages || 0)) {
           analyzePage(currentPage);
           setCurrentPage(p => p + 1);
        }
    };
    
    const handleSearchOffers = useCallback((product: SearchableProduct) => {
        setSelectedProductForSearch(product);
        setIsSearchDialogOpen(true);
    }, []);
    
     const handleModelChange = (index: number, newModel: string) => {
        setAllProducts(prev => {
            const newProducts = [...prev];
            const originalIndex = (productsPageIndex * productsPageSize) + index;
            newProducts[originalIndex] = { ...newProducts[originalIndex], model: newModel };
            return newProducts;
        });
    };
    
    const handleRefinedQueryChange = (index: number, newQuery: string) => {
        setAllProducts(prev => {
            const newProducts = [...prev];
            const originalIndex = (productsPageIndex * productsPageSize) + index;
            newProducts[originalIndex] = { ...newProducts[originalIndex], refinedQuery: newQuery };
            return newProducts;
        });
    };

    const formatCurrency = (value: number | string) => {
      let numericValue: number;
      if (typeof value === 'string') {
        numericValue = parseFloat(value.replace('.', '').replace(',', '.'));
      } else {
        numericValue = value;
      }
    
      if (isNaN(numericValue)) return 'R$ 0,00';
    
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(numericValue);
    };

    const handleCheckTrends = () => {
        console.log('🔍 Iniciando verificação de tendências...');
      
        const queries = allProducts.map(trendQueryFor);
      
        console.log('📝 Consultas enviadas:', queries);
      
        if (queries.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Nenhum produto extraído',
            description: 'Analise uma página primeiro para extrair produtos antes de verificar as tendências.',
          });
          return;
        }
      
        startTrendingTransition(() => {
          const trendFormData = new FormData();
          trendFormData.append('productNames', JSON.stringify(queries));
          trendingAction(trendFormData);
        });
    };

    const isProcessingAny = isParsing || isAnalyzingPending;
    const progress = pdfDoc ? ((currentPage - 1) / pdfDoc.numPages) * 100 : 0;

    const productsPageCount = useMemo(() => Math.ceil(allProducts.length / productsPageSize), [allProducts.length, productsPageSize]);
    const paginatedProducts = useMemo(() => {
        const startIndex = productsPageIndex * productsPageSize;
        return allProducts.slice(startIndex, startIndex + productsPageSize);
    }, [allProducts, productsPageIndex, productsPageSize]);

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
            
            const result = await searchMercadoLivreAction({ result: null, error: null }, formData);
            if (result.result) {
                const matchingOffers = result.result.filter((offer: any) => 
                    offer.model?.toLowerCase() === product.model?.toLowerCase()
                );

                if (matchingOffers.length > 0) {
                    const offersWithProductInfo = matchingOffers.map(offer => ({
                        ...offer,
                        originalProductName: product.name
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
        const groups = new Map<string, any[]>();
        batchSearchResults.forEach(offer => {
            const modelKey = offer.model || 'Outros Modelos';
            if (!groups.has(modelKey)) {
                groups.set(modelKey, []);
            }
            groups.get(modelKey)!.push(offer);
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
                            {isProcessingAny ? (
                                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="animate-spin" />
                                    <span>Analisando página {currentPage} de {pdfDoc.numPages}...</span>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Pronto para analisar. {pdfDoc.numPages} páginas encontradas.</p>
                            )}
                             <Progress value={progress} className="w-full mt-2" />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            {isAnalyzingAll ? (
                                <Button onClick={() => setIsAnalyzingAll(false)} disabled={!isProcessingAny} variant="destructive">
                                    <XCircle className="mr-2" /> Cancelar
                                </Button>
                            ) : (
                                <>
                                 <Button onClick={handleAnalyzeNextClick} disabled={isProcessingAny || currentPage > pdfDoc.numPages}>
                                    <Play className="mr-2" /> Analisar Próxima
                                </Button>
                                <Button onClick={handleAnalyzeAllClick} disabled={isProcessingAny} variant="secondary">
                                    <FastForward className="mr-2" />
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
                                    Produtos Extraídos ({allProducts.length})
                                </CardTitle>
                                <CardDescription>
                                    Abaixo estão os produtos que a IA conseguiu extrair do catálogo.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={handleCheckTrends} disabled={isTrendingActionPending || isTrendingPending} variant="outline">
                                    {(isTrendingActionPending || isTrendingPending) ? <Loader2 className="animate-spin" /> : <TrendingUp />}
                                    Verificar Tendências
                                </Button>
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
                                        <TableHead>Modelo</TableHead>
                                        <TableHead>Marca</TableHead>
                                        <TableHead>Preço Unit.</TableHead>
                                        <TableHead>Total Cx</TableHead>
                                        <TableHead className="w-1/5">Termo de Busca (IA)</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProducts.map((product, index) => {
                                        const unitPrice = parseFloat(product.price?.replace('.', '').replace(',', '.') || '0');
                                        const totalBox = unitPrice * (product.quantityPerBox || 1);
                                        const trendingKeywords = product.matchedKeywords || [];

                                        return (
                                             <React.Fragment key={index}>
                                                <TableRow>
                                                    <TableCell>
                                                      <div className="flex items-center gap-4">
                                                        <div>
                                                          <p className="font-semibold">{product.name}</p>
                                                          <p className="text-xs text-muted-foreground">{product.description}</p>
                                                        </div>
                                                        {product.isTrending && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger>
                                                                        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm whitespace-nowrap cursor-pointer">
                                                                            em alta <TrendingUp className="h-5 w-5" />
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
                                                            value={product.model || ''} 
                                                            onChange={(e) => handleModelChange(index, e.target.value)}
                                                            placeholder="Modelo..."
                                                            className="h-8"
                                                        />
                                                    </TableCell>
                                                     <TableCell>
                                                        <Input 
                                                            value={product.brand || brand || ''}
                                                            readOnly
                                                            className="h-8 bg-muted/50"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono">{formatCurrency(unitPrice)}</TableCell>
                                                    <TableCell className="font-mono font-semibold">{formatCurrency(totalBox)}</TableCell>
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
                            Total de {allProducts.length} produtos.
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
                            {paginatedGroupedResults.map(([model, offers]) => (
                                <AccordionItem key={model} value={model} className="border rounded-lg">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold">
                                        {model} ({offers.length} anúncios)
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-0">
                                        <div className="space-y-4">
                                            {offers.map((offer) => (
                                                <div key={offer.id} className="flex items-center gap-4 p-2 border-b last:border-b-0">
                                                    <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                        {offer.thumbnail && <Image src={offer.thumbnail} alt={offer.name} fill className="object-contain" data-ai-hint="product image" />}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <Link href={`https://www.mercadolivre.com.br/p/${offer.catalog_product_id}`} target="_blank" className="font-medium text-primary hover:underline">
                                                            {offer.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                        </Link>
                                                        <p className="text-xs text-muted-foreground">ID Catálogo: {offer.catalog_product_id}</p>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Marca: <Badge variant="outline">{offer.brand}</Badge> | Vendedor: <Badge variant="outline">{offer.seller_nickname}</Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right font-semibold text-lg text-primary">
                                                        {formatCurrency(offer.price)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
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

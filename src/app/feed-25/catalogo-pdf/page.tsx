
"use client";

import React, { useState, useActionState, useEffect, useTransition, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, ChevronLeft, ChevronRight, Play, FastForward, Search, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction, refineSearchTermAction } from '@/app/actions';
import type { AnalyzeCatalogOutput } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SearchResultsDialog } from './search-results-dialog';
import { setupPdfjsWorker } from "@/lib/pdfjs-worker";

if (typeof window !== "undefined") {
  setupPdfjsWorker();
}

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
}

export interface SearchableProduct extends CatalogProduct {
    refinedQuery?: string;
    isSearching?: boolean;
    searchError?: string;
    foundProducts?: any[];
}


export default function CatalogoPdfPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isParsing, setIsParsing] = useState(false);
    const [allProducts, setAllProducts] = useState<SearchableProduct[]>([]);
    const [brand, setBrand] = useState('');
    
    const [isProcessing, startTransition] = useTransition();
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    const [state, formAction] = useActionState(analyzeCatalogAction, analyzeInitialState);
    
    // State for search dialog
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [selectedProductForSearch, setSelectedProductForSearch] = useState<SearchableProduct | null>(null);

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
        formData.append('pdfContent', pageText);
        formData.append('pageNumber', String(pageNumber));
        formData.append('totalPages', String(pdfDoc.numPages));
        formData.append('brand', brand);
    
        startTransition(() => {
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
    }, [pdfDoc, formAction, startTransition, toast, brand]);


    useEffect(() => {
        if (state.error) {
            toast({ variant: 'destructive', title: 'Erro na Análise', description: state.error });
            setIsAnalyzingAll(false); 
        }
        if (state.result) {
            setAllProducts(prev => [...prev, ...state.result!.products.map(p => ({...p}))]);
            if (isAnalyzingAll && currentPage < (pdfDoc?.numPages || 0)) {
                setCurrentPage(p => p + 1);
            } else {
                 setIsAnalyzingAll(false); 
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    useEffect(() => {
        if (isAnalyzingAll && !isProcessing && currentPage <= (pdfDoc?.numPages || 0)) {
            analyzePage(currentPage);
        }
         if (isAnalyzingAll && currentPage > (pdfDoc?.numPages || 0)) {
            setIsAnalyzingAll(false); 
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, isAnalyzingAll, isProcessing]);


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
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
                 toast({ variant: 'destructive', title: 'Erro ao ler PDF' });
            } finally {
                setIsParsing(false);
            }
        } else {
            toast({ variant: 'destructive', title: 'Arquivo Inválido' });
            setFile(null);
        }
    };

    const handleAnalyzeAllClick = () => {
        if (!isProcessing) {
            setCurrentPage(1);
            setAllProducts([]);
            setIsAnalyzingAll(true);
        }
    };
    
    const handleAnalyzeNextClick = () => {
        if (!isProcessing && currentPage <= (pdfDoc?.numPages || 0)) {
           analyzePage(currentPage);
           setCurrentPage(p => p + 1);
        }
    };
    
    const handleRefineAllSearches = async () => {
        setIsRefining(true);
        const promises = allProducts.map(async (product, index) => {
            const formData = new FormData();
            formData.append('productName', product.name);
            formData.append('productModel', product.model);
            formData.append('productBrand', brand);
            const result = await refineSearchTermAction({ result: null, error: null }, formData);
            return { index, result };
        });

        const results = await Promise.all(promises);
        
        setAllProducts(currentProducts => {
            const newProducts = [...currentProducts];
            results.forEach(({ index, result }) => {
                if (result.result?.refinedQuery) {
                    newProducts[index].refinedQuery = result.result.refinedQuery;
                } else if (result.error) {
                    console.error(`Error refining product ${index}:`, result.error);
                }
            });
            return newProducts;
        });
        
        setIsRefining(false);
        toast({ title: "Termos de busca refinados!", description: "A IA otimizou os termos para busca no Mercado Livre." });
    };

    
    const handleSearchOffers = useCallback((product: SearchableProduct) => {
        setSelectedProductForSearch(product);
        setIsSearchDialogOpen(true);
    }, []);
    
     const handleModelChange = (index: number, newModel: string) => {
        setAllProducts(prev => {
            const newProducts = [...prev];
            newProducts[index] = { ...newProducts[index], model: newModel };
            return newProducts;
        });
    };
    
    const handleRefinedQueryChange = (index: number, newQuery: string) => {
        setAllProducts(prev => {
            const newProducts = [...prev];
            newProducts[index] = { ...newProducts[index], refinedQuery: newQuery };
            return newProducts;
        });
    };

    const extractQuantity = (description: string): number => {
        if (!description) return 1;
        const match = description.match(/(\d+)\s*(PCS|CX|UN)/i);
        return match ? parseInt(match[1], 10) : 1;
    };

    const formatCurrency = (value: number | string) => {
        let numericValue: number;
        if (typeof value === 'string') {
            numericValue = parseFloat(value.replace('.', '').replace(',', '.'));
        } else {
            numericValue = value;
        }

        if (isNaN(numericValue)) return 'N/A';
        
        return numericValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
    }

    const isProcessingAny = isParsing || isProcessing || isRefining;
    const progress = pdfDoc ? ((currentPage - 1) / pdfDoc.numPages) * 100 : 0;

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
                                <Input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
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
                            {isProcessingAny && !isRefining ? (
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
                             <Button onClick={handleAnalyzeNextClick} disabled={isProcessingAny || currentPage > pdfDoc.numPages}>
                                <Play className="mr-2" /> Analisar Próxima
                            </Button>
                            <Button onClick={handleAnalyzeAllClick} disabled={isProcessingAny} variant="secondary">
                                {isAnalyzingAll ? <Loader2 className="animate-spin mr-2" /> : <FastForward className="mr-2" />}
                                {isAnalyzingAll ? 'Analisando...' : 'Analisar Todas'}
                            </Button>
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
                            <Button onClick={handleRefineAllSearches} disabled={isRefining}>
                                {isRefining ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2"/>}
                                Refinar Termos com IA
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-2/5">Produto</TableHead>
                                        <TableHead>Modelo</TableHead>
                                        <TableHead>Marca</TableHead>
                                        <TableHead className="w-1/5">Termo de Busca (IA)</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allProducts.map((product, index) => {
                                        const unitPrice = parseFloat(product.price?.replace('.', '').replace(',', '.') || '0');
                                        
                                        return (
                                             <React.Fragment key={index}>
                                                <TableRow>
                                                    <TableCell>
                                                        <p className="font-semibold">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{product.description}</p>
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
                                                    <TableCell>
                                                        <Input
                                                            value={product.refinedQuery || ''}
                                                            onChange={(e) => handleRefinedQueryChange(index, e.target.value)}
                                                            placeholder="Aguardando IA..."
                                                            className="h-8"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(unitPrice)}</TableCell>
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

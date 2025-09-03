
"use client";

import { useState, useActionState, useEffect, useTransition, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, ChevronLeft, ChevronRight, Play, FastForward, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction, searchMercadoLivreAction } from '@/app/actions';
import type { AnalyzeCatalogOutput } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const analyzeInitialState: {
  result: AnalyzeCatalogOutput | null;
  error: string | null;
} = {
  result: null,
  error: null,
};

interface CatalogProduct {
    name: string;
    description: string;
    price: string;
    imageUrl?: string;
    isSearching?: boolean;
    searchError?: string;
    foundProducts?: {
        id: string;
        catalog_product_id: string | null;
        name: string;
        brand: string;
        model: string;
    }[];
}


export default function CatalogoPdfPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isParsing, setIsParsing] = useState(false);
    const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
    
    const [isProcessing, startTransition] = useTransition();
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);

    const [state, formAction] = useActionState(analyzeCatalogAction, analyzeInitialState);
    const [isSearching, startSearchTransition] = useTransition();

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
    }, [pdfDoc, formAction, startTransition, toast]);


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
    
    const handleSearchOffers = useCallback((productIndex: number) => {
        const product = allProducts[productIndex];
        if (!product || product.isSearching) return;
    
        startSearchTransition(async () => {
            setAllProducts(prev => prev.map((p, i) => i === productIndex ? { ...p, isSearching: true, searchError: undefined } : p));
            
            const formData = new FormData();
            formData.append('productName', product.name);
            
            try {
                const result = await searchMercadoLivreAction({ result: null, error: null }, formData);
                if (result.error) {
                    throw new Error(result.error);
                }
                setAllProducts(prev => prev.map((p, i) => i === productIndex ? { ...p, isSearching: false, foundProducts: result.result?.products } : p));
            } catch (error: any) {
                console.error("Error searching offers:", error);
                setAllProducts(prev => prev.map((p, i) => i === productIndex ? { ...p, isSearching: false, searchError: error.message } : p));
                 toast({ variant: 'destructive', title: 'Erro ao Buscar Ofertas', description: error.message });
            }
        });
    }, [allProducts, toast]);

    const extractQuantity = (description: string): number => {
        if (!description) return 1;
        const match = description.match(/(\d+)\s*(PCS|CX|UN)/i);
        return match ? parseInt(match[1], 10) : 1;
    };

    const formatCurrency = (value: number | string) => {
        let numericValue = typeof value === 'string' ? parseFloat(value.replace('.', '').replace(',', '.')) : value;
        if (isNaN(numericValue)) return 'N/A';
        return numericValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
    }

    const isProcessingAny = isParsing || isProcessing;
    const progress = pdfDoc ? ((currentPage - 1) / pdfDoc.numPages) * 100 : 0;

    return (
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
                        <div className="space-y-2">
                            <Label htmlFor="pdf-upload">Arquivo do Catálogo (.pdf)</Label>
                            <Input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
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
                        <CardTitle className="flex items-center gap-2">
                            <FileText />
                            Produtos Extraídos ({allProducts.length})
                        </CardTitle>
                         <CardDescription>
                            Abaixo estão os produtos que a IA conseguiu extrair do catálogo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-2/5">Produto</TableHead>
                                        <TableHead className="text-center">Qtd.</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-right">Preço Total</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allProducts.map((product, index) => {
                                        const quantity = extractQuantity(product.description);
                                        const unitPrice = parseFloat(product.price?.replace('.', '').replace(',', '.') || '0');
                                        const totalPrice = quantity * unitPrice;
                                        const currentIsSearching = product.isSearching || (isSearching && allProducts[index]?.isSearching);
                                        
                                        return (
                                             <React.Fragment key={index}>
                                                <TableRow>
                                                    <TableCell>
                                                        <p className="font-semibold">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{product.description}</p>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">{quantity}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(unitPrice)}</TableCell>
                                                    <TableCell className="text-right font-bold text-primary">{formatCurrency(totalPrice)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button size="sm" onClick={() => handleSearchOffers(index)} disabled={currentIsSearching}>
                                                            {currentIsSearching ? <Loader2 className="animate-spin" /> : <Search />}
                                                            Buscar no ML
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                                {product.foundProducts && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="p-2 bg-muted/50">
                                                            <div className="p-2 space-y-2">
                                                                <h4 className="text-xs font-semibold">Ofertas encontradas:</h4>
                                                                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                                    {product.foundProducts.slice(0,4).map((offer, i) => (
                                                                        <div key={i} className="p-2 rounded bg-background border text-xs">
                                                                            <Link href={`https://www.mercadolivre.com.br/p/${offer.catalog_product_id}`} target="_blank" className="hover:underline text-blue-600 line-clamp-1 font-semibold" title={offer.name}>
                                                                                {offer.name}
                                                                            </Link>
                                                                            <div className="flex justify-between items-center text-muted-foreground mt-1">
                                                                                <span>{offer.brand}</span>
                                                                                <Badge variant="outline">{offer.id}</Badge>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                 </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                {product.searchError && (
                                                     <TableRow>
                                                        <TableCell colSpan={5} className="p-2 text-center text-destructive bg-destructive/10">
                                                           {product.searchError}
                                                        </TableCell>
                                                     </TableRow>
                                                )}
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
    );
}

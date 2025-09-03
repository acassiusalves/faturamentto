
"use client";

import { useState, useActionState, useEffect, useTransition, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, ChevronLeft, ChevronRight, Play, FastForward } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction } from '@/app/actions';
import type { AnalyzeCatalogOutput, ProductSchema } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const initialState: {
  result: AnalyzeCatalogOutput | null;
  error: string | null;
} = {
  result: null,
  error: null,
};

export default function CatalogoPdfPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isParsing, setIsParsing] = useState(false);
    const [allProducts, setAllProducts] = useState<ProductSchema[]>([]);
    const [isProcessing, startTransition] = useTransition();
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);

    const [state, formAction] = useActionState(analyzeCatalogAction, initialState);

    const analyzePage = useCallback((pageNumber: number) => {
        if (!pdfDoc || pageNumber > pdfDoc.numPages) {
            setIsAnalyzingAll(false); // Stop if we go past the last page
            return;
        }

        startTransition(async () => {
            const page = await pdfDoc.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            
            const formData = new FormData();
            formData.append('pdfContent', pageText);
            formData.append('pageNumber', String(pageNumber));
            formData.append('totalPages', String(pdfDoc.numPages));
            
            formAction(formData);
        });
    }, [pdfDoc, formAction, startTransition]);

    useEffect(() => {
        if (state.error) {
            toast({ variant: 'destructive', title: 'Erro na Análise', description: state.error });
            setIsAnalyzingAll(false); // Stop on error
        }
        if (state.result) {
            setAllProducts(prev => [...prev, ...state.result!.products]);
            if (currentPage < (pdfDoc?.numPages || 0)) {
                setCurrentPage(p => p + 1);
            } else {
                 setIsAnalyzingAll(false); // Finished all pages
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    // This effect triggers the next page analysis when isAnalyzingAll is true
    useEffect(() => {
        if (isAnalyzingAll && !isProcessing && currentPage <= (pdfDoc?.numPages || 0)) {
            analyzePage(currentPage);
        }
         if (isAnalyzingAll && currentPage > (pdfDoc?.numPages || 0)) {
            setIsAnalyzingAll(false); // Ensure it stops if manually advanced past the end
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
            setIsAnalyzingAll(true);
            // The useEffect will trigger the first analysis
            if (currentPage <= (pdfDoc?.numPages || 0)) {
                analyzePage(currentPage);
            }
        }
    };
    
    const handleAnalyzeNextClick = () => {
        if (!isProcessing) {
           analyzePage(currentPage);
        }
    };


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
                            <Button onClick={handleAnalyzeAllClick} disabled={isProcessingAny || currentPage > pdfDoc.numPages} variant="secondary">
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
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {allProducts.map((product, index) => (
                                <Card key={index} className="overflow-hidden">
                                    <CardContent className="p-4">
                                        <h3 className="font-semibold h-10 line-clamp-2">{product.name}</h3>
                                        <p className="text-sm text-muted-foreground h-16 line-clamp-3 my-2">{product.description}</p>
                                        <div className="text-lg font-bold text-primary mt-2">
                                            {product.price ? `R$ ${product.price}` : 'Preço não encontrado'}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                 </Card>
            )}
        </main>
    );
}

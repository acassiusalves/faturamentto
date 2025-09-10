
"use client";

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';
import { BookImage, Loader2, Play } from 'lucide-react';
import { analyzeCatalogAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AnalyzeCatalogOutput } from '@/lib/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PageAnalysisResult {
    pageNumber: number;
    data: AnalyzeCatalogOutput;
}

export default function AnaliseProdutosPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<PageAnalysisResult[]>([]);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const { toast } = useToast();
  const [pdfjs, setPdfjs] = useState<any>(null);

  useEffect(() => {
    async function loadPdfJs() {
        try {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
            // O worker é copiado para a pasta public pelo script postinstall em package.json
            pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;
            setPdfjs(pdfjsLib);
        } catch (error) {
            console.error("Failed to load pdf.js", error);
            toast({
              variant: 'destructive',
              title: 'Erro Crítico',
              description: 'Não foi possível carregar a biblioteca de PDF. Por favor, recarregue a página.',
            });
        }
    }
    loadPdfJs();
  }, [toast]);


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !pdfjs) return;

    setFile(selectedFile);
    setTotalPages(0);
    setCurrentPage(1);
    setAnalysisResults([]);
    pdfRef.current = null;

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument(arrayBuffer);
      const pdf = await loadingTask.promise;
      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar PDF',
        description: 'O arquivo pode estar corrompido ou em um formato inválido.',
      });
    }
  };

  const handleAnalyzePage = async () => {
    if (!pdfRef.current || currentPage > totalPages) return;

    setIsProcessing(true);
    try {
      const page = await pdfRef.current.getPage(currentPage);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');

      const formData = new FormData();
      formData.append('pdfContent', pageText);
      formData.append('pageNumber', String(currentPage));
      formData.append('totalPages', String(totalPages));
      if (brand) formData.append('brand', brand);

      const result = await analyzeCatalogAction({ result: null, error: null }, formData);

      if (result.error) throw new Error(result.error);
      
      if (result.result) {
        setAnalysisResults(prev => [...prev, { pageNumber: currentPage, data: result.result! }]);
        setCurrentPage(prev => prev + 1);
      }

    } catch (error: any) {
      console.error("Error analyzing page:", error);
      toast({
        variant: 'destructive',
        title: `Erro ao analisar página ${currentPage}`,
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const formatCurrency = (value: string | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    const numericValue = parseFloat(String(value).replace(',', '.'));
    if (isNaN(numericValue)) return value; // Return original string if not a valid number
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
  };


  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <BookImage className="h-6 w-6" />
            Análise de Catálogo PDF
          </CardTitle>
          <CardDescription>
            Faça o upload do seu catálogo em PDF e a IA irá extrair e listar os produtos para você, página por página.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="pdf-upload">Arquivo do Catálogo (.pdf)</Label>
              <Input 
                id="pdf-upload" 
                type="file" 
                accept="application/pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
                disabled={!pdfjs}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-input">Marca (Opcional)</Label>
              <Input 
                id="brand-input" 
                placeholder="Ex: Xiaomi"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>
          {totalPages > 0 && (
            <div className="mt-6 flex justify-between items-center bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">
                  Pronto para analisar. {totalPages} páginas encontradas.
                  {currentPage <= totalPages && ` Próxima página: ${currentPage}`}
                </p>
                <Button onClick={handleAnalyzePage} disabled={isProcessing || currentPage > totalPages}>
                    {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    {currentPage > totalPages ? 'Análise Concluída' : `Analisar Próxima`}
                </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {analysisResults.length > 0 && (
        <Card className="max-w-4xl mx-auto w-full">
            <CardHeader>
                <CardTitle>Resultados da Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {analysisResults.slice().reverse().map(result => (
                  <div key={result.pageNumber}>
                    <h3 className="font-semibold mb-2">Página {result.pageNumber}</h3>
                    {result.data.products.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Modelo</TableHead>
                                    <TableHead>Preço Unit.</TableHead>
                                    <TableHead>Qtd. Caixa</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.products.map((product, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                          <div className="font-medium">{product.name}</div>
                                          <div className="text-xs text-muted-foreground">{product.description}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{product.model}</Badge></TableCell>
                                        <TableCell className="font-semibold">{formatCurrency(product.price)}</TableCell>
                                        <TableCell>{product.quantityPerBox || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">Nenhum produto encontrado nesta página.</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

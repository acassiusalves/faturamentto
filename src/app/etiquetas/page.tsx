
"use client";

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Bot, Loader2, Upload, FileText, User, MapPin, Database, Copy, Check } from 'lucide-react';
import { fetchLabelAction, analyzeLabelAction, analyzeZplAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { AnalyzeLabelOutput } from '@/ai/flows/analyze-label-flow';
import * as pdfjs from 'pdfjs-dist';
import { Textarea } from '@/components/ui/textarea';


const fetchInitialState = {
  labelUrl: null as string | null,
  error: null as string | null,
  rawError: null as string | null,
  zplContent: null as string | null,
};

const analyzeInitialState = {
    analysis: null as AnalyzeLabelOutput | null,
    error: null as string | null,
}

export default function EtiquetasPage() {
  const [fetchState, fetchFormAction, isFetching] = useActionState(fetchLabelAction, fetchInitialState);
  const [analyzeState, analyzeFormAction, isAnalyzing] = useActionState(analyzeLabelAction, analyzeInitialState);
  const [analyzeZplState, analyzeZplFormAction, isAnalyzingZpl] = useActionState(analyzeZplAction, analyzeInitialState);
  
  const { toast } = useToast();
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [zplEditorContent, setZplEditorContent] = useState<string>('');
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (fetchState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar etiqueta',
        description: fetchState.error,
      });
    }
    if(fetchState.zplContent) {
        setZplEditorContent(fetchState.zplContent);
        // Automatically trigger ZPL analysis
        const formData = new FormData();
        formData.append('zplContent', fetchState.zplContent);
        analyzeZplFormAction(formData);
    }
  }, [fetchState, toast, analyzeZplFormAction]);
  
   useEffect(() => {
    if (analyzeState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar etiqueta',
        description: analyzeState.error,
      });
    }
  }, [analyzeState, toast]);

   useEffect(() => {
    if (analyzeZplState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar ZPL',
        description: analyzeZplState.error,
      });
    }
  }, [analyzeZplState, toast]);

  const fileToDataURI = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                resolve(event.target.result as string);
            } else {
                reject(new Error("Failed to read file."));
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
  };

  const pdfToPngDataURI = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport: viewport,
    };
    await page.render(renderContext).promise;

    return canvas.toDataURL('image/png');
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLabelFile(null);
      setPhotoDataUri(null);
      return;
    }
    setLabelFile(file);
    setIsPreparingFile(true);
    
    try {
        let dataUri = '';
        if (file.type === 'application/pdf') {
            dataUri = await pdfToPngDataURI(file);
        } else if (file.type.startsWith('image/')) {
            dataUri = await fileToDataURI(file);
        } else {
            toast({ variant: 'destructive', title: 'Formato de ficheiro não suportado', description: 'Por favor, envie uma imagem ou PDF.'});
            setPhotoDataUri(null);
            return;
        }
        setPhotoDataUri(dataUri);
    } catch (error) {
        console.error("Error processing file client-side:", error);
        toast({ variant: "destructive", title: "Erro ao Processar Ficheiro", description: "Não foi possível converter o ficheiro para análise."});
        setPhotoDataUri(null);
    } finally {
        setIsPreparingFile(false);
    }
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(zplEditorContent);
    setHasCopied(true);
    toast({ title: 'Copiado!', description: 'O conteúdo ZPL foi copiado para a área de transferência.' });
    setTimeout(() => setHasCopied(false), 2000);
  }

  const isAnalyzeButtonDisabled = isAnalyzing || isPreparingFile || !photoDataUri;
  const analysisResult = analyzeState.analysis || analyzeZplState.analysis;
  const isAnyAnalysisRunning = isAnalyzing || isAnalyzingZpl || isPreparingFile;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciador de Etiquetas</h1>
        <p className="text-muted-foreground">Gere e analise as etiquetas para os seus envios.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>1. Buscar Etiqueta por Pedido</CardTitle>
              <CardDescription>Insira o ID do pedido e selecione o formato desejado.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={fetchFormAction}>
                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="order-id" className="font-semibold">ID do Pedido</Label>
                    <Input id="order-id" name="orderId" placeholder="Insira o ID do pedido" required />
                  </div>

                  <div className="grid w-full max-w-[180px] items-center gap-1.5">
                    <Label htmlFor="format" className="font-semibold">Formato</Label>
                    <Select name="format" defaultValue="PDF">
                      <SelectTrigger id="format"><SelectValue placeholder="Selecione o formato" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="ZPL">ZPL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={isFetching}>
                    {isFetching ? <Loader2 className="animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Buscar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>2. Analisar Etiqueta com IA</CardTitle>
                <CardDescription>Faça o upload do PDF da etiqueta para extrair os dados completos.</CardDescription>
            </CardHeader>
            <CardContent>
                <form action={analyzeFormAction}>
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="grid w-full items-center gap-1.5">
                             <Label htmlFor="label-file" className="font-semibold">Ficheiro da Etiqueta (PDF/Imagem)</Label>
                            <Input id="label-file" type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
                        </div>
                        <input type="hidden" name="photoDataUri" value={photoDataUri || ''} />
                        <Button type="submit" disabled={isAnalyzeButtonDisabled}>
                            {isAnalyzing || isPreparingFile ? <Loader2 className="animate-spin"/> : <Bot />}
                            Analisar
                        </Button>
                    </div>
                </form>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-8">
            {/* Visualização da Etiqueta */}
            {fetchState.labelUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle>Etiqueta PDF</CardTitle>
                        <CardDescription>Visualização do PDF retornado pela Ideris. Faça o download para analisar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-3">
                        <Button asChild variant="outline" size="sm">
                            <a href={fetchState.labelUrl} target="_blank" rel="noopener noreferrer">Abrir em nova aba</a>
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={() => navigator.clipboard.writeText(fetchState.labelUrl!)}>
                            Copiar link
                        </Button>
                        </div>
                        <iframe src={fetchState.labelUrl} className="w-full h-[60vh] border rounded-md" title="Etiqueta PDF"/>
                    </CardContent>
                </Card>
            )}

             {fetchState.zplContent && (
                <Card>
                    <CardHeader>
                        <CardTitle>Editor ZPL</CardTitle>
                        <CardDescription>O conteúdo ZPL da etiqueta é editável. Copie o resultado para impressão.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            value={zplEditorContent}
                            onChange={(e) => setZplEditorContent(e.target.value)}
                            className="font-mono text-xs min-h-[300px] max-h-[60vh]"
                        />
                        <Button onClick={handleCopyToClipboard} className="mt-4 w-full">
                            {hasCopied ? <Check className="mr-2" /> : <Copy className="mr-2" />}
                            {hasCopied ? "Copiado!" : "Copiar Conteúdo ZPL"}
                        </Button>
                    </CardContent>
                </Card>
            )}
            
            {fetchState.rawError && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database/> Resposta Bruta do Erro</CardTitle>
                        <CardDescription>A API retornou um erro. Use estes dados para depuração.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                            <code>{fetchState.rawError}</code>
                        </pre>
                    </CardContent>
                </Card>
            )}

             {/* Resultados da Análise */}
            {isAnyAnalysisRunning ? (
                <div className="flex items-center justify-center h-64 border rounded-lg bg-card">
                    <Loader2 className="animate-spin text-primary mr-4" size={32}/>
                    <p className="text-muted-foreground">{isPreparingFile ? 'Processando ficheiro...' : 'Analisando etiqueta...'}</p>
                </div>
            ) : null}
            {analysisResult && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bot /> Dados Extraídos da Etiqueta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><FileText/> Geral</h3>
                           <p><strong className="text-muted-foreground">Pedido:</strong> {analysisResult.orderNumber}</p>
                           <p><strong className="text-muted-foreground">Nota Fiscal:</strong> {analysisResult.invoiceNumber}</p>
                        </div>
                         <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><User/> Destinatário</h3>
                           <p><strong className="text-muted-foreground">Nome:</strong> {analysisResult.recipientName}</p>
                           <p><strong className="text-muted-foreground">Endereço:</strong> {analysisResult.streetAddress}</p>
                           <p><strong className="text-muted-foreground">Cidade/UF:</strong> {analysisResult.city} - {analysisResult.state}</p>
                           <p><strong className="text-muted-foreground">CEP:</strong> {analysisResult.zipCode}</p>
                        </div>
                         <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><MapPin/> Remetente</h3>
                           <p><strong className="text-muted-foreground">Nome:</strong> {analysisResult.senderName}</p>
                           <p><strong className="text-muted-foreground">Endereço:</strong> {analysisResult.senderAddress}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
      </div>
      
      {fetchState.error && !fetchState.rawError && (
        <Alert variant="destructive">
          <AlertTitle>Erro na Solicitação</AlertTitle>
          <AlertDescription>{fetchState.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

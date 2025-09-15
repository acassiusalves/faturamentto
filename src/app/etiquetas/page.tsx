

"use client";

import { useActionState, useEffect, useState, useTransition, useCallback, useRef } from "react";
import {
  Search,
  Bot,
  Loader2,
  FileText,
  User,
  MapPin,
  Database,
  Copy,
  Check,
  Wand2,
  Printer,
  Eye,
  Trash2,
  RotateCcw,
  Edit,
  X,
  BrainCircuit,
  ScanSearch,
} from "lucide-react";
import {
  fetchLabelAction,
  analyzeLabelAction,
  analyzeZplAction,
  remixLabelDataAction,
  remixZplDataAction,
  correctExtractedDataAction,
  regenerateZplAction,
} from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { AnalyzeLabelOutput, RemixZplDataOutput, RemixableField } from "@/lib/types";
import * as pdfjs from "pdfjs-dist";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ProcessingStatus } from "./processing-status"; 
import { MappingDebugger } from './mapping-debugger';
import { Badge } from "@/components/ui/badge";
import { SimpleDataEditor } from '@/components/simple-data-editor';


pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const fetchInitialState = {
  labelUrl: null as string | null,
  error: null as string | null,
  rawError: null as string | null,
  zplContent: null as string | null,
};

const analyzeInitialState = {
  analysis: null as AnalyzeLabelOutput | null,
  error: null as string | null,
};

const remixLabelInitialState = {
  analysis: null as AnalyzeLabelOutput | null,
  error: null as string | null,
};

const remixZplInitialState = {
  result: null as RemixZplDataOutput | null,
  error: null as string | null,
};

const sanitizeZpl = (z: string) =>
  z.replace(/```(?:zpl)?/g, '').trim();

export default function EtiquetasPage() {
  const [fetchState, fetchFormAction, isFetching] = useActionState(fetchLabelAction, fetchInitialState);
  const [analyzeState, analyzeFormAction, isAnalyzing] = useActionState(analyzeLabelAction, analyzeInitialState);
  const [analyzeZplState, analyzeZplFormAction, isAnalyzingZpl] = useActionState(analyzeZplAction, analyzeInitialState);
  const [remixState, remixFormAction, isRemixing] = useActionState(remixLabelDataAction, remixLabelInitialState);
  const [remixZplState, remixZplFormAction, isRemixingZpl] = useActionState(remixZplDataAction, remixZplInitialState);
  const [correctDataState, correctDataFormAction, isCorrecting] = useActionState(correctExtractedDataAction, analyzeInitialState);
  const [regenerateState, regenerateFormAction, isRegenerating] = useActionState(regenerateZplAction, {
    result: null,
    error: null,
  });
  const [isTransitioning, startTransition] = useTransition();

  const { toast } = useToast();
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [zplEditorContent, setZplEditorContent] = useState<string>("");
  const [hasCopied, setHasCopied] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<AnalyzeLabelOutput | null>(null);
  const [baselineAnalysis, setBaselineAnalysis] = useState<AnalyzeLabelOutput | null>(null);
  const [originalZpl, setOriginalZpl] = useState<string>("");

  const [remixingField, setRemixingField] = useState<RemixableField | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  const lastAppliedZplRef = useRef<string | null>(null);
  const previewCtrlRef = useRef<AbortController | null>(null);
  const previewReqIdRef = useRef(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [currentEditedData, setCurrentEditedData] = useState<AnalyzeLabelOutput | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handlePrint = () => {
    if (!previewUrl) return;

    const printWindow = window.open('', '_blank', 'height=600,width=400');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Imprimir Etiqueta</title>');
      printWindow.document.write('<style>@page { size: 4in 6in; margin: 0; } body { margin: 0; } img { width: 100%; height: auto; }</style>');
      printWindow.document.write('</head><body onload="window.print();window.close()">');
      printWindow.document.write(`<img src="${previewUrl}" />`);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro de Impressão',
        description: 'Não foi possível abrir a janela de impressão. Verifique se o seu navegador está a bloquear pop-ups.'
      });
    }
  };


  const generatePreviewImmediate = useCallback(async (zpl: string) => {
    if (!zpl.trim()) { setPreviewUrl(null); return; }
  
    previewCtrlRef.current?.abort();
    const ctrl = new AbortController();
    previewCtrlRef.current = ctrl;
  
    const myId = ++previewReqIdRef.current;
  
    setIsPreviewLoading(true);
    try {
      const res = await fetch('/api/zpl-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: zpl,
        signal: ctrl.signal,
        cache: 'no-store',
      });
  
      if (!res.ok) {
        const errText = await res.text();
        console.error('Preview API error:', errText);
        if (myId === previewReqIdRef.current) {
          toast({
            variant: 'destructive',
            title: 'Erro ao gerar prévia ZPL',
            description: errText.slice(0, 300),
          });
          setPreviewUrl(null);
        }
        return;
      }
  
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (myId === previewReqIdRef.current) {
          setPreviewUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Preview fetch failed:', e);
        toast({ variant: 'destructive', title: 'Falha na prévia', description: String(e) });
      }
      if (myId === previewReqIdRef.current) setPreviewUrl(null);
    } finally {
      if (myId === previewReqIdRef.current) setIsPreviewLoading(false);
    }
  }, [toast]);
  
  const debounce = <F extends (...args: any[]) => any>(fn: F, ms: number) => {
    let t: any;
    return (...args: Parameters<F>) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const debouncedPreview = useCallback(
    debounce(generatePreviewImmediate, 800),
    [generatePreviewImmediate]
  );
  
  useEffect(() => {
    debouncedPreview(zplEditorContent);
  }, [zplEditorContent, debouncedPreview]);

  useEffect(() => {
    if (fetchState.error) {
      toast({ variant: "destructive", title: "Erro ao buscar etiqueta", description: fetchState.error });
    }
  }, [fetchState.error, toast]);

  useEffect(() => {
    const zpl = fetchState.zplContent;
    if (!zpl) return;
  
    setOriginalZpl(zpl);
    setZplEditorContent(zpl);
    setBaselineAnalysis(null);
  
    startTransition(() => {
      const fd = new FormData();
      fd.append("zplContent", zpl);
      analyzeZplFormAction(fd);
    });
  }, [fetchState.zplContent, analyzeZplFormAction]);

  useEffect(() => {
    if (analyzeState.error) {
      toast({ variant: "destructive", title: "Erro ao analisar etiqueta", description: analyzeState.error });
    } else if (analyzeState.analysis) {
      setAnalysisResult(analyzeState.analysis);
      setBaselineAnalysis(prev => prev ?? analyzeState.analysis);
    }
  }, [analyzeState.analysis, analyzeState.error, toast]);

  useEffect(() => {
    if (analyzeZplState.error) {
      toast({ variant: "destructive", title: "Erro ao analisar ZPL", description: analyzeZplState.error });
      return;
    }
    if (analyzeZplState.analysis) {
      setAnalysisResult(analyzeZplState.analysis);
      if (!baselineAnalysis) {
        setBaselineAnalysis(analyzeZplState.analysis); 
      }
    }
  }, [analyzeZplState.error, analyzeZplState.analysis, toast, baselineAnalysis]);

    useEffect(() => {
        if (analyzeZplState.analysis && originalZpl && !baselineAnalysis) {
            startTransition(() => {
                const formData = new FormData();
                formData.append('originalZpl', originalZpl);
                formData.append('extractedData', JSON.stringify(analyzeZplState.analysis));
                correctDataFormAction(formData);
            });
        }
    }, [analyzeZplState.analysis, originalZpl, baselineAnalysis, correctDataFormAction]);

    useEffect(() => {
        if (correctDataState.analysis) {
            setAnalysisResult(correctDataState.analysis);
            setBaselineAnalysis(correctDataState.analysis); // Set baseline after correction
            toast({
                title: "Endereços Corrigidos",
                description: "Os dados foram separados automaticamente baseado na estrutura da etiqueta.",
                duration: 3000,
            });
        } else if (correctDataState.error) {
             toast({
                variant: 'destructive',
                title: "Correção Falhou",
                description: correctDataState.error,
            });
        }
    }, [correctDataState, toast]);

  useEffect(() => {
    if (remixState.error) {
      toast({ variant: 'destructive', title: 'Erro ao gerar dados', description: remixState.error });
    } else if (remixState.analysis) {
      setAnalysisResult(remixState.analysis);
      toast({ title: 'Sucesso!', description: 'Os dados foram atualizados com IA.' });
    }
    setRemixingField(null);
  }, [remixState, toast]);

  useEffect(() => {
    const resultData = remixZplState.result as any;
    if (remixZplState.error) {
        toast({
        variant: 'destructive',
        title: 'Alterações Não Aplicadas',
        description: (
            <div className="space-y-1">
            <p>Erro: {remixZplState.error}</p>
            <p className="text-xs">Formato ZPL pode ser incompatível</p>
            </div>
        ),
        duration: 6000,
        });
        return;
    }

    const newZpl = resultData?.modifiedZpl ? sanitizeZpl(resultData.modifiedZpl) : null;
    if (!newZpl) return;

    if (newZpl.trim() === zplEditorContent.trim()) {
        toast({
        title: 'Sem Alterações Detectadas',
        description: 'A edição não resultou em mudanças no ZPL. Verifique se os dados foram realmente alterados.',
        duration: 4000,
        });
        return;
    }

    if (lastAppliedZplRef.current === newZpl) return;
    lastAppliedZplRef.current = newZpl;

    setZplEditorContent(newZpl);
    setOriginalZpl(newZpl);
    generatePreviewImmediate(newZpl);

    if(resultData?.correctedData) {
        setAnalysisResult(resultData.correctedData);
        setBaselineAnalysis(resultData.correctedData);
    } else if (currentEditedData) {
        setBaselineAnalysis(currentEditedData);
    }
    
    setHasUnsavedChanges(false);
    setLastUpdateTime(Date.now());
    
    toast({ 
        title: 'Etiqueta Atualizada!', 
        description: (
        <div className="space-y-1">
            <p>ZPL modificado com os novos dados</p>
            <p className="text-xs text-muted-foreground">
            Dados editados mantidos • Códigos preservados
            </p>
        </div>
        ),
        duration: 4000,
    });
}, [remixZplState, toast, zplEditorContent, generatePreviewImmediate, currentEditedData]);
  useEffect(() => {
    if (regenerateState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Regenerar Etiqueta',
        description: regenerateState.error,
      });
      return;
    }
  
    if (regenerateState.result?.newZpl) {
      const newZpl = regenerateState.result.newZpl.replace(/```(?:zpl)?/g, '').trim();
      
      setZplEditorContent(newZpl);
      setOriginalZpl(newZpl);
      generatePreviewImmediate(newZpl);
      
      toast({
        title: '✨ Etiqueta Regenerada!',
        description: (
          <div className="space-y-1">
            <p>Nova etiqueta criada com dados editados</p>
            <p className="text-xs text-muted-foreground">
              Códigos preservados • Layout mantido • Dados atualizados
            </p>
          </div>
        ),
        duration: 5000,
      });
      
      setHasUnsavedChanges(false);
      setLastUpdateTime(Date.now());
    }
  }, [regenerateState, generatePreviewImmediate, toast]);


  const pdfToPngDataURI = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: context, viewport };
    await page.render(renderContext).promise;

    return canvas.toDataURL("image/png");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLabelFile(null);
      setPhotoDataUri(null);
      return;
    }
    setLabelFile(file);
    setPhotoDataUri(null);
    setAnalysisResult(null);
    setBaselineAnalysis(null);

    startTransition(async () => {
      try {
        let dataUri = "";
        if (file.type === "application/pdf") {
          dataUri = await pdfToPngDataURI(file);
        } else if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          dataUri = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
        } else {
          toast({ variant: "destructive", title: "Formato não suportado", description: "Envie imagem ou PDF." });
          return;
        }
        setPhotoDataUri(dataUri);
      } catch (error) {
        console.error("Error processing file client-side:", error);
        toast({ variant: "destructive", title: "Erro ao Processar Ficheiro", description: "Não foi possível converter o ficheiro." });
        setPhotoDataUri(null);
      }
    });
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(zplEditorContent);
    setHasCopied(true);
    toast({ title: "Copiado!", description: "O conteúdo ZPL foi copiado." });
    setTimeout(() => setHasCopied(false), 2000);
  };
  
  const handleRemixField = (field: RemixableField) => {
    if (!analysisResult) return;
    setRemixingField(field);
    startTransition(() => {
        const formData = new FormData();
        formData.append('originalData', JSON.stringify(analysisResult));
        formData.append('fieldToRemix', field);
        remixFormAction(formData);
    });
  };

  const isPreparingFile = isTransitioning && !isAnalyzing;
  const isAnyAnalysisRunning = isAnalyzing || isAnalyzingZpl || isTransitioning || isRemixing || isRemixingZpl || isCorrecting || isRegenerating;
  const isAnalyzeButtonDisabled = isAnalyzing || isPreparingFile || !photoDataUri;

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
                    <Select name="format" defaultValue="ZPL">
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
              <CardDescription>Faça upload do PDF ou imagem para extrair os dados.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={analyzeFormAction}>
                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="label-file" className="font-semibold">Arquivo (PDF/Imagem)</Label>
                    <Input id="label-file" type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
                  </div>
                  <input type="hidden" name="photoDataUri" value={photoDataUri || ""} />
                  <Button type="submit" disabled={isAnalyzeButtonDisabled}>
                    {isAnalyzing || isPreparingFile ? <Loader2 className="animate-spin" /> : <Bot />}
                    Analisar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {fetchState.zplContent && (
            <Card>
              <CardHeader>
                <CardTitle>Editor ZPL</CardTitle>
                <CardDescription>Edite e copie o ZPL da etiqueta.</CardDescription>
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
        </div>

        <div className="space-y-8">
           {previewUrl && !isPreviewLoading && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Eye /> Pré-visualização da Etiqueta
                    </CardTitle>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="outline" size="sm">
                      <Printer className="mr-2 h-4 w-4"/>
                      Imprimir
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4">
                  <div className="flex items-center justify-center">
                    <div className="relative inline-block">
                      <Image
                        src={previewUrl}
                        alt="Pré-visualização ZPL"
                        width={420}
                        height={630}
                        className="block max-w-[420px] h-auto border rounded-lg shadow-sm"
                      />
                      
                      {lastAppliedZplRef.current && Date.now() - (lastUpdateTime || 0) < 10000 && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg animate-pulse">
                          ✅ Atualizada
                        </div>
                      )}
                    </div>
                  </div>
              </CardContent>
            </Card>
          )}

          {isPreviewLoading && (
            <Card className="h-96 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="animate-spin text-primary mx-auto" size={32} />
                <p className="text-muted-foreground">Gerando pré-visualização...</p>
              </div>
            </Card>
          )}

          {fetchState.labelUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Etiqueta PDF</CardTitle>
                <CardDescription>Visualização do PDF retornado pela Ideris.</CardDescription>
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
                <iframe src={fetchState.labelUrl} className="w-full h-[60vh] border rounded-md" title="Etiqueta PDF" />
              </CardContent>
            </Card>
          )}

          {fetchState.rawError && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database /> Resposta Bruta do Erro</CardTitle>
                <CardDescription>Dados de depuração da API.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                  <code>{fetchState.rawError}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          {isAnyAnalysisRunning && !analysisResult ? (
            <div className="flex items-center justify-center h-64 border rounded-lg bg-card">
              <Loader2 className="animate-spin text-primary mr-4" size={32} />
              <p className="text-muted-foreground">
                {isPreparingFile ? "Processando ficheiro..." :
                 isRemixing ? "Gerando novos dados..." :
                 isRemixingZpl ? "Gerando novo ZPL..." :
                 "Analisando etiqueta..."}
              </p>
            </div>
          ) : null}

          {analysisResult && (
            <SimpleDataEditor
              data={{
                ...analysisResult,
                senderNeighborhood: (analysisResult as any)?.senderNeighborhood || '',
                senderCityState: (analysisResult as any)?.senderCityState || ''
              }}
              onDataChange={(newData) => {
                setAnalysisResult(newData);
                setCurrentEditedData(newData);
                setHasUnsavedChanges(true);
              }}
              onRegenerate={(data) => {
                if (originalZpl) {
                  const formData = new FormData();
                  formData.append('originalZpl', originalZpl);
                  formData.append('editedData', JSON.stringify(data));
                  regenerateFormAction(formData);
                }
              }}
              onReset={() => {
                if (baselineAnalysis) {
                  setAnalysisResult(baselineAnalysis);
                  setCurrentEditedData(baselineAnalysis);
                  setHasUnsavedChanges(false);
                }
              }}
              isProcessing={isRegenerating}
              hasChanges={hasUnsavedChanges}
            />
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

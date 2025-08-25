
"use client";

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Bot, Loader2, Upload, FileText, User, MapPin } from 'lucide-react';
import { fetchLabelAction, analyzeLabelAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { AnalyzeLabelOutput } from '@/ai/flows/analyze-label-flow';


const fetchInitialState = {
  rawResponse: null as any,
  error: null as string | null,
  labelUrl: null as string | null,
};

const analyzeInitialState = {
    analysis: null as AnalyzeLabelOutput | null,
    error: null as string | null,
}

export default function EtiquetasPage() {
  const [fetchState, fetchFormAction, isFetching] = useActionState(fetchLabelAction, fetchInitialState);
  const [analyzeState, analyzeFormAction, isAnalyzing] = useActionState(analyzeLabelAction, analyzeInitialState);
  
  const { toast } = useToast();
  const [labelImage, setLabelImage] = useState<File | null>(null);

  useEffect(() => {
    if (fetchState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar etiqueta',
        description: fetchState.error,
      });
    }
  }, [fetchState, toast]);
  
   useEffect(() => {
    if (analyzeState.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar etiqueta',
        description: analyzeState.error,
      });
    }
  }, [analyzeState, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setLabelImage(event.target.files[0]);
    }
  };
  
  const handleAnalyzeClick = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!labelImage) {
        toast({
            variant: "destructive",
            title: "Nenhuma imagem selecionada",
            description: "Por favor, selecione uma imagem da etiqueta para analisar.",
        });
        return;
    }
    const formData = new FormData();
    formData.append('labelImage', labelImage);
    analyzeFormAction(formData);
  }

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
                <CardDescription>Faça o upload de uma imagem (print) da etiqueta para extrair os dados completos.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAnalyzeClick} className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="grid w-full items-center gap-1.5">
                         <Label htmlFor="label-image" className="font-semibold">Imagem da Etiqueta</Label>
                        <Input id="label-image" type="file" accept="image/*" onChange={handleFileChange} />
                    </div>
                    <Button type="submit" disabled={isAnalyzing || !labelImage}>
                        {isAnalyzing ? <Loader2 className="animate-spin"/> : <Bot />}
                        Analisar
                    </Button>
                </form>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-8">
            {/* Visualização da Etiqueta */}
            {fetchState.labelUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle>Etiqueta</CardTitle>
                        <CardDescription>Visualização do PDF retornado pela Ideris. Tire um print para analisar.</CardDescription>
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

             {/* Resultados da Análise */}
            {isAnalyzing && (
                <div className="flex items-center justify-center h-64 border rounded-lg bg-card">
                    <Loader2 className="animate-spin text-primary mr-4" size={32}/>
                    <p className="text-muted-foreground">Analisando etiqueta...</p>
                </div>
            )}
            {analyzeState.analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bot /> Dados Extraídos da Etiqueta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><FileText/> Geral</h3>
                           <p><strong className="text-muted-foreground">Pedido:</strong> {analyzeState.analysis.orderNumber}</p>
                           <p><strong className="text-muted-foreground">Nota Fiscal:</strong> {analyzeState.analysis.invoiceNumber}</p>
                        </div>
                         <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><User/> Destinatário</h3>
                           <p><strong className="text-muted-foreground">Nome:</strong> {analyzeState.analysis.recipientName}</p>
                           <p><strong className="text-muted-foreground">Endereço:</strong> {analyzeState.analysis.streetAddress}</p>
                           <p><strong className="text-muted-foreground">Cidade/UF:</strong> {analyzeState.analysis.city} - {analyzeState.analysis.state}</p>
                           <p><strong className="text-muted-foreground">CEP:</strong> {analyzeState.analysis.zipCode}</p>
                        </div>
                         <div className="p-3 border rounded-md bg-muted/50 space-y-2">
                           <h3 className="font-semibold text-base flex items-center gap-2"><MapPin/> Remetente</h3>
                           <p><strong className="text-muted-foreground">Nome:</strong> {analyzeState.analysis.senderName}</p>
                           <p><strong className="text-muted-foreground">Endereço:</strong> {analyzeState.analysis.senderAddress}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
      </div>
      
      {fetchState.error && !fetchState.rawResponse && (
        <Alert variant="destructive">
          <AlertTitle>Erro na Solicitação</AlertTitle>
          <AlertDescription>{fetchState.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

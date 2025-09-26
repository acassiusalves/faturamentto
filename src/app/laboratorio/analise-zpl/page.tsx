
"use client";

import * as React from "react";
import { useFormState, useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, BrainCircuit, Image as ImageIcon, Code, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeZplAction } from '@/app/actions';
import type { AnalyzeLabelOutput } from '@/lib/types';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const initialState: { analysis: AnalyzeLabelOutput | null, error: string | null } = {
  analysis: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
      Analisar ZPL com IA
    </Button>
  );
}

const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-start text-sm py-2 border-b last:border-b-0 gap-4">
        <span className="text-muted-foreground capitalize">{label.replace(/_/g, ' ')}</span>
        <span className="font-semibold text-right">{value || <span className="text-destructive">N/A</span>}</span>
    </div>
);

export default function AnaliseZplPage() {
    const { toast } = useToast();
    const [state, formAction] = useFormState(analyzeZplAction, initialState);
    const [zplContent, setZplContent] = React.useState('');
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [isRendering, setIsRendering] = React.useState(false);
    
    React.useEffect(() => {
        if(state.error) {
            toast({
                variant: 'destructive',
                title: 'Erro na Análise',
                description: state.error,
            });
        }
    }, [state.error, toast]);
    
    const generateImage = React.useCallback(async (zpl: string) => {
        if (!zpl.trim()) {
            setImageUrl(null);
            return;
        }
        setIsRendering(true);
        try {
            const response = await fetch('/api/zpl-preview', { method: 'POST', body: zpl });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Falha ao gerar a imagem da etiqueta.');
            }
            const imageBlob = await response.blob();
            if (imageUrl) URL.revokeObjectURL(imageUrl); // Clean up old URL
            const url = URL.createObjectURL(imageBlob);
            setImageUrl(url);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na Visualização', description: error.message });
            setImageUrl(null);
        } finally {
            setIsRendering(false);
        }
    }, [toast, imageUrl]);
    
    // Cleanup for Blob URL
    React.useEffect(() => {
        return () => {
            if(imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        }
    }, [imageUrl]);


    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Análise de ZPL</h1>
                <p className="text-muted-foreground">
                    Cole um código ZPL para que a IA extraia os dados e gere uma pré-visualização.
                </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-start">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Entrada de Dados</CardTitle>
                        <CardDescription>Cole o conteúdo ZPL da sua etiqueta na área de texto abaixo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={formAction}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="zpl-content">Conteúdo ZPL</Label>
                                    <Textarea
                                        id="zpl-content"
                                        name="zplContent"
                                        placeholder="^XA..."
                                        rows={15}
                                        value={zplContent}
                                        onChange={(e) => setZplContent(e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <SubmitButton />
                                    <Button type="button" variant="secondary" onClick={() => generateImage(zplContent)} disabled={isRendering || !zplContent}>
                                        {isRendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                                        Ver Imagem
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="md:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados Extraídos</CardTitle>
                            <CardDescription>Informações extraídas do ZPL pela Inteligência Artificial.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {state.analysis ? (
                                <div className="space-y-2">
                                    <DetailItem label="Destinatário" value={state.analysis.recipientName} />
                                    <DetailItem label="Endereço" value={state.analysis.streetAddress} />
                                    <DetailItem label="Cidade/Estado" value={`${state.analysis.city} - ${state.analysis.state}`} />
                                    <DetailItem label="CEP" value={state.analysis.zipCode} />
                                    <DetailItem label="Nº Pedido" value={state.analysis.orderNumber} />
                                    <DetailItem label="Nota Fiscal" value={state.analysis.invoiceNumber} />
                                    <DetailItem label="Rastreio" value={<span className="font-mono">{state.analysis.trackingNumber}</span>} />
                                    <DetailItem label="Remetente" value={state.analysis.senderName} />
                                    <DetailItem label="End. Remetente" value={state.analysis.senderAddress} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10 h-full">
                                    <BrainCircuit className="h-12 w-12 mb-4" />
                                    <p>Aguardando análise da IA...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pré-visualização</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center p-4 min-h-[300px] bg-muted rounded-md">
                           {isRendering ? (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <p>Renderizando etiqueta...</p>
                                </div>
                            ) : imageUrl ? (
                                <Image src={imageUrl} alt="Pré-visualização da Etiqueta ZPL" width={250} height={375} style={{ objectFit: 'contain' }} />
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <ImageIcon size={32} />
                                    <p>A pré-visualização aparecerá aqui.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

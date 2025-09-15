
"use client";

import * as React from 'react';
import { Loader2, Wand2, RefreshCw, Printer, Code, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AnalyzeLabelOutput, RemixLabelDataInput, RemixableField } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { remixLabelDataAction, correctExtractedDataAction, regenerateZplAction } from '@/app/actions';
import Image from 'next/image';
import { MappingDebugger } from './mapping-debugger';

interface ZplEditorProps {
  originalZpl: string;
  initialData: AnalyzeLabelOutput;
}

const editableFields: { key: keyof AnalyzeLabelOutput, label: string, remixable: boolean }[] = [
    { key: 'recipientName', label: 'Nome do Destinatário', remixable: false },
    { key: 'streetAddress', label: 'Endereço', remixable: false },
    { key: 'city', label: 'Cidade', remixable: false },
    { key: 'state', label: 'Estado', remixable: false },
    { key: 'zipCode', label: 'CEP', remixable: false },
    { key: 'orderNumber', label: 'Nº do Pedido', remixable: true },
    { key: 'invoiceNumber', label: 'Nº da Nota Fiscal', remixable: true },
    { key: 'trackingNumber', label: 'Nº de Rastreio', remixable: true },
    { key: 'senderName', label: 'Nome do Remetente', remixable: true },
    { key: 'senderAddress', label: 'Endereço do Remetente', remixable: true },
];

export function ZplEditor({ originalZpl, initialData }: ZplEditorProps) {
    const { toast } = useToast();
    const printRef = React.useRef<HTMLDivElement>(null);
    const [editedData, setEditedData] = React.useState<AnalyzeLabelOutput>(initialData);
    const [currentZpl, setCurrentZpl] = React.useState(originalZpl);
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [isRendering, setIsRendering] = React.useState(false);
    const [isRemixing, setIsRemixing] = React.useState<RemixableField | null>(null);
    const [isRegenerating, setIsRegenerating] = React.useState(false);
    const [isCorrecting, setIsCorrecting] = React.useState(false);
    const [showRawZpl, setShowRawZpl] = React.useState(false);

    const generateImage = React.useCallback(async (zpl: string) => {
        setIsRendering(true);
        try {
            const response = await fetch('/api/zpl-preview', { method: 'POST', body: zpl });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Falha ao gerar a imagem da etiqueta.');
            }
            const imageBlob = await response.blob();
            const url = URL.createObjectURL(imageBlob);
            setImageUrl(url);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro de Visualização', description: error.message });
        } finally {
            setIsRendering(false);
        }
    }, [toast]);
    
    React.useEffect(() => {
        generateImage(currentZpl);
        // Clean up object URL on unmount
        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentZpl]);
    
    // Auto-correct on initial load if data seems to be placeholder
    React.useEffect(() => {
        const needsCorrection = Object.values(initialData).some(val => val === 'string');

        async function autoCorrect() {
          if (!needsCorrection) return;
          
          setIsCorrecting(true);
          try {
            const formData = new FormData();
            formData.append('originalZpl', originalZpl);
            formData.append('extractedData', JSON.stringify(initialData));
            const result = await correctExtractedDataAction({ analysis: null, error: null}, formData);
            if (result.analysis) {
              setEditedData(result.analysis);
              toast({ title: 'Dados Corrigidos', description: 'Uma correção automática foi aplicada aos dados extraídos.'});
            }
          } catch(e) {
            console.error("Auto-correction failed", e);
          } finally {
            setIsCorrecting(false);
          }
      }
      autoCorrect();
    }, [originalZpl, initialData, toast]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };

    const handleRemix = async (field: RemixableField) => {
        setIsRemixing(field);
        try {
            const formData = new FormData();
            const remixInput: RemixLabelDataInput = { 
                fieldToRemix: field, 
                originalValue: editedData[field] || '' 
            };
            
            formData.append('remixInput', JSON.stringify(remixInput));

            const result = await remixLabelDataAction({ analysis: null, error: null }, formData);

            if (result.error || !result.analysis) {
                 throw new Error(result.error || "A IA não retornou um novo valor.");
            }
            
            setEditedData(prev => ({ ...prev, ...result.analysis }));

        } catch (error: any) {
            toast({ variant: 'destructive', title: `Erro ao Remixar ${field}`, description: error.message });
        } finally {
            setIsRemixing(null);
        }
    };
    
    const handleRegenerateZpl = async () => {
        setIsRegenerating(true);
        try {
            const formData = new FormData();
            formData.append('originalZpl', originalZpl);
            formData.append('editedData', JSON.stringify(editedData));

            const result = await regenerateZplAction({ result: null, error: null }, formData);

            if (result.error || !result.result?.newZpl) {
                throw new Error(result.error || 'A IA não conseguiu regenerar o ZPL.');
            }
            setCurrentZpl(result.result.newZpl);
            toast({ title: 'Etiqueta Atualizada!', description: 'O ZPL foi regenerado com os novos dados.' });

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Erro ao Atualizar Etiqueta', description: error.message });
        } finally {
             setIsRegenerating(false);
        }
    };

    const handlePrint = () => {
        if (printRef.current) {
            const printWindow = window.open('', '', 'height=800,width=800');
            printWindow?.document.write('<html><head><title>Imprimir Etiqueta</title>');
            printWindow?.document.write('<style>@media print { body { margin: 0; } }</style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printRef.current.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
    };
    
    return (
        <div className="grid md:grid-cols-2 gap-6 h-full overflow-hidden">
            {/* Editor Form */}
            <div className="flex flex-col space-y-4 overflow-y-auto pr-4">
                {isCorrecting && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    <span>Corrigindo dados com IA...</span>
                  </div>
                )}
                {editableFields.map(({ key, label, remixable }) => (
                    <div key={key} className="space-y-1.5">
                        <Label htmlFor={key}>{label}</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id={key}
                                name={key}
                                value={editedData[key as keyof AnalyzeLabelOutput] || ''}
                                onChange={handleInputChange}
                                className="flex-grow"
                            />
                            {remixable && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleRemix(key as RemixableField)}
                                    disabled={!!isRemixing}
                                    title={`Remixar ${label}`}
                                >
                                    {isRemixing === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 />}
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
                 <MappingDebugger zpl={originalZpl}/>
                <div className="flex justify-between items-center sticky bottom-0 bg-background py-4">
                    {isRegenerating && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Regenerando ZPL...</span>
                        </div>
                    )}
                    <div/>
                    <Button onClick={handleRegenerateZpl} disabled={isRegenerating}>
                        <RefreshCw className="mr-2" />
                        Atualizar Etiqueta
                    </Button>
                </div>
            </div>

            {/* ZPL Preview */}
            <div className="flex flex-col space-y-4 bg-muted p-4 rounded-lg overflow-hidden">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Pré-visualização da Etiqueta</h3>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowRawZpl(!showRawZpl)}>
                             {showRawZpl ? <ImageIcon className="mr-2"/> : <Code className="mr-2"/>}
                            {showRawZpl ? "Ver Imagem" : "Ver Código"}
                        </Button>
                        <Button onClick={handlePrint} variant="secondary" size="sm">
                            <Printer className="mr-2"/>
                            Imprimir
                        </Button>
                    </div>
                </div>
                <div className="flex-grow rounded-md border bg-background flex items-center justify-center overflow-auto p-4 relative" ref={printRef}>
                    {isRendering ? (
                        <Loader2 className="animate-spin text-primary" size={32} />
                    ) : showRawZpl ? (
                        <pre className="text-xs p-2 whitespace-pre-wrap break-all">
                            <code>{currentZpl}</code>
                        </pre>
                    ) : imageUrl ? (
                        <Image src={imageUrl} alt="Etiqueta ZPL" width={400} height={600} style={{ objectFit: 'contain' }} />
                    ) : (
                        <p className="text-destructive">Falha ao carregar a imagem da etiqueta.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

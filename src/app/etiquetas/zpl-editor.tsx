
"use client";

import * as React from 'react';
import { Loader2, Wand2, RefreshCw, Printer, Code, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AnalyzeLabelOutput, RemixLabelDataInput, RemixableField, RemixZplDataInput } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { remixLabelDataAction, remixZplDataAction } from '@/app/actions';
import Image from 'next/image';
import { ProcessingStatus } from './processing-status';

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
    const [isRemixingZpl, setIsRemixingZpl] = React.useState(false);
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedData(prev => ({ ...prev, [name]: value }));
    };

    const handleRemix = async (field: RemixableField) => {
        setIsRemixing(field);
        try {
            const formData = new FormData();
            // Directly create RemixLabelDataInput without JSON.stringify
            const remixInput: RemixLabelDataInput = { 
                fieldToRemix: field, 
                originalValue: editedData[field] || '' 
            };
            
            // This is a workaround since server actions can't directly accept complex objects yet
            // in all Next.js versions. Sending as a string is safer.
            formData.append('remixInput', JSON.stringify(remixInput));

            const result = await remixLabelDataAction({ analysis: null, error: null }, formData);

            if (result.error || !result.analysis) {
                 throw new Error(result.error || "A IA não retornou um novo valor.");
            }
            
            // result.analysis will be a partial object like { senderName: 'new value' }
            setEditedData(prev => ({ ...prev, ...result.analysis }));

        } catch (error: any) {
            toast({ variant: 'destructive', title: `Erro ao Remixar ${field}`, description: error.message });
        } finally {
            setIsRemixing(null);
        }
    };
    
    const handleUpdateZpl = async () => {
        setIsRemixingZpl(true);
        try {
            const formData = new FormData();
            const remixInput: RemixZplDataInput = {
                originalZpl,
                baselineData: initialData,
                remixedData: editedData,
                matchMode: 'strict',
            };
            formData.append('zplRemixInput', JSON.stringify(remixInput));

            const result = await remixZplDataAction({ result: null, error: null }, formData);

            if (result.error || !result.result?.modifiedZpl) {
                throw new Error(result.error || 'A IA não conseguiu regenerar o ZPL.');
            }
            setCurrentZpl(result.result.modifiedZpl);

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Erro ao Atualizar Etiqueta', description: error.message });
        } finally {
             setIsRemixingZpl(false);
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
                <div className="flex justify-between items-center sticky bottom-0 bg-background py-4">
                     <ProcessingStatus isRemixingZpl={isRemixingZpl} />
                    <Button onClick={handleUpdateZpl} disabled={isRemixingZpl}>
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


"use client";

import * as React from 'react';
import { Loader2, RefreshCw, Printer, Code, Image as ImageIcon, Wand2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { parseZplFields, updateCluster, type ZplField, clusterizeFields, encodeFH, computeZones, isInZone, norm, type Zones, matchIAAllowed } from '@/lib/zpl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { assertElements } from "@/lib/assert-elements";
import type { RemixableField } from '@/lib/types';
import { remixLabelDataAction, regenerateZplAction } from '@/app/actions';
import { Progress } from '@/components/ui/progress';

assertElements({ Loader2, RefreshCw, Printer, Code, ImageIcon, Button, Input, Label, Image, ScrollArea, Wand2, Sparkles });


interface ZplEditorProps {
  originalZpl: string;
  orderId: string | null;
  onLabelGenerated?: () => void;
}

const labelMap: Record<string, string> = {
  "22,512":  "Tag/etiqueta (texto)",
  "370,563": "Pedido (com prefixo)",
  "370,596": "Nota Fiscal (com prefixo)",
  "370,992": "Remetente – Nome",
  "370,1047":"Remetente – Endereço",
};


export function ZplEditor({ originalZpl, orderId, onLabelGenerated }: ZplEditorProps) {
    const { toast } = useToast();
    const printRef = React.useRef<HTMLDivElement>(null);
    const [fields, setFields] = React.useState<ZplField[]>([]);
    const clustersRef = React.useRef<Record<string, ZplField[]>>({});
    const zonesRef = React.useRef<Zones | null>(null);
    const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});
    const [currentZpl, setCurrentZpl] = React.useState(originalZpl);
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [isRendering, setIsRendering] = React.useState(false);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [showRawZpl, setShowRawZpl] = React.useState(false);
    const [isRemixing, setIsRemixing] = React.useState<string | null>(null);
    const [isRemixingAll, setIsRemixingAll] = React.useState(false);
    const [remixProgress, setRemixProgress] = React.useState(0);
    const [regenerateState, setRegenerateState] = React.useState({ result: null, error: null });


    React.useEffect(() => {
        const parsed = parseZplFields(originalZpl);
        const { visible, byKey } = clusterizeFields(parsed);
        setFields(visible);
        clustersRef.current = byKey;
        zonesRef.current = computeZones(visible);

        const initialEdits: Record<string, string> = {};
        visible.forEach((f) => {
            const k = `${f.x},${f.y}`;
            const fieldType = getFieldType(f);
            if(fieldType === 'orderNumber' && f.value.includes(':')) {
                 initialEdits[k] = f.value.split(':')[1].trim();
            } else if (fieldType === 'invoiceNumber' && f.value.includes(':')) {
                 initialEdits[k] = f.value.split(':')[1].trim();
            } else {
                 initialEdits[k] = f.value ?? "";
            }
        });
        setEditedValues(initialEdits);
    }, [originalZpl]);

    const generateImage = React.useCallback(async (zpl: string) => {
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
            toast({ variant: 'destructive', title: 'Erro de Visualização', description: error.message });
            setImageUrl(null);
        } finally {
            setIsRendering(false);
        }
    }, [toast, imageUrl]);
    
    React.useEffect(() => {
        generateImage(currentZpl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentZpl]);

    const handleInputChange = (fieldKey: string, value: string) => {
        setEditedValues(prev => ({ ...prev, [fieldKey]: value }));
    };

    const handleUpdateZpl = async () => {
        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append('originalZpl', currentZpl);
            const dataToSave: any = {};
            fields.forEach(field => {
                const fieldType = getFieldType(field);
                if (fieldType) {
                    const fieldKey = `${field.x},${field.y}`;
                    dataToSave[fieldType] = editedValues[fieldKey];
                }
            });
            formData.append('editedData', JSON.stringify(dataToSave));
            if(orderId) formData.append('orderId', orderId);

            const result = await regenerateZplAction(regenerateState, formData);

            if(result.error || !result.result?.newZpl) {
                throw new Error(result.error || "A IA não conseguiu gerar a etiqueta.");
            }

            setCurrentZpl(result.result.newZpl);
            if(onLabelGenerated) onLabelGenerated();
            toast({ title: 'Etiqueta Atualizada!', description: 'O ZPL foi reconstruído com os novos dados.' });

        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Erro ao Atualizar', description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemixField = async (fieldKey: string, originalValue: string, fieldType: RemixableField) => {
        setIsRemixing(fieldKey);
        try {
            const formData = new FormData();
            formData.append('remixInput', JSON.stringify({ fieldToRemix: fieldType, originalValue }));
            
            const result = await remixLabelDataAction({}, formData);
            if (result.error || !result.analysis) {
                 throw new Error(result.error || 'A IA não retornou um novo valor.');
            }
            const newValue = result.analysis[fieldType];
            if (newValue) {
                setEditedValues(prev => ({ ...prev, [fieldKey]: newValue }));
                toast({ title: "Campo Remixado!", description: `A IA gerou um novo valor para ${fieldType}.`});
            }

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Erro na Remixagem', description: e.message });
        } finally {
            setIsRemixing(null);
        }
    }
    
    const getFieldType = (field: ZplField): RemixableField | null => {
      const byCoord = matchIAAllowed(field);
      if (!byCoord) return null;

      const v = norm(field.value);
      if (byCoord === "orderNumber"   && !v.startsWith("pedido:"))      return null;
      if (byCoord === "invoiceNumber" && !v.startsWith("nota fiscal:")) return null;

      return byCoord;
    };


    const handleRemixAll = async () => {
        setIsRemixingAll(true);
        setRemixProgress(0);

        const remixableFields = fields
            .map(field => {
                const fieldKey = `${field.x},${field.y}`;
                const fieldType = getFieldType(field);
                return fieldType ? { fieldKey, originalValue: field.value, fieldType } : null;
            })
            .filter(Boolean) as { fieldKey: string; originalValue: string; fieldType: RemixableField }[];

        const totalFields = remixableFields.length;
        for (let i = 0; i < totalFields; i++) {
            const { fieldKey, originalValue, fieldType } = remixableFields[i];
            await handleRemixField(fieldKey, originalValue, fieldType);
            setRemixProgress(((i + 1) / totalFields) * 100);
        }

        toast({
            title: 'Remixagem em Lote Concluída!',
            description: 'Todos os campos foram atualizados. Clique em "Atualizar Etiqueta" para ver o resultado.',
        });
        setIsRemixingAll(false);
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
            <div className="flex flex-col space-y-4 overflow-hidden">
                 <ScrollArea className="flex-grow pr-4">
                    <div className="space-y-4">
                        {fields.map((field) => {
                            const fieldKey = `${field.x},${field.y}`;
                            const fieldType = getFieldType(field);
                            const lockedRecipient = zonesRef.current && isInZone(field, zonesRef.current.recipient);

                            return (
                                <div key={fieldKey} className="space-y-1.5">
                                    <Label htmlFor={fieldKey} className="text-xs text-muted-foreground">
                                        {labelMap[fieldKey] ?? `Campo em (X: ${field.x}, Y: ${field.y})`}
                                        {lockedRecipient && " – bloqueado (Destinatário)"}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={fieldKey}
                                            name={fieldKey}
                                            value={editedValues[fieldKey] ?? ''}
                                            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                                            className="font-mono text-sm"
                                            disabled={lockedRecipient}
                                        />
                                        {fieldType && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleRemixField(fieldKey, field.value, fieldType)} 
                                                disabled={!!isRemixing || isRemixingAll}
                                                title={`Remixar ${fieldType} com IA`}
                                            >
                                                {isRemixing === fieldKey ? <Loader2 className="animate-spin" /> : <Wand2 />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </ScrollArea>
                 {isRemixingAll && (
                    <div className="space-y-1">
                        <Progress value={remixProgress} />
                        <p className="text-xs text-muted-foreground text-center">Remixando campos...</p>
                    </div>
                )}
                <div className="flex justify-end items-center sticky bottom-0 bg-background py-4 flex-shrink-0 gap-2">
                    <Button onClick={handleRemixAll} disabled={isRemixingAll || isUpdating || isRendering} variant="outline">
                        {isRemixingAll ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        Remixar Tudo com IA
                    </Button>
                    <Button onClick={handleUpdateZpl} disabled={isUpdating || isRendering || isRemixingAll}>
                        {isUpdating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
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

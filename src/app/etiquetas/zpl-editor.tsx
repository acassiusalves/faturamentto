
"use client";

import * as React from 'react';
import { Loader2, RefreshCw, Printer, Code, Image as ImageIcon, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { parseZplFields, updateCluster, type ZplField, clusterizeFields, encodeFH } from '@/lib/zpl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { assertElements } from "@/lib/assert-elements";
import type { RemixableField } from '@/lib/types';
import { remixLabelDataAction } from '@/app/actions';

assertElements({ Loader2, RefreshCw, Printer, Code, ImageIcon, Button, Input, Label, Image, ScrollArea, Wand2 });


interface ZplEditorProps {
  originalZpl: string;
}

export function ZplEditor({ originalZpl }: ZplEditorProps) {
    const { toast } = useToast();
    const printRef = React.useRef<HTMLDivElement>(null);
    const [fields, setFields] = React.useState<ZplField[]>([]);
    const clustersRef = React.useRef<Record<string, ZplField[]>>({});
    const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});
    const [currentZpl, setCurrentZpl] = React.useState(originalZpl);
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [isRendering, setIsRendering] = React.useState(false);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [showRawZpl, setShowRawZpl] = React.useState(false);
    const [isRemixing, setIsRemixing] = React.useState<string | null>(null);


    React.useEffect(() => {
        const parsed = parseZplFields(originalZpl);
        const { visible, byKey } = clusterizeFields(parsed);
        setFields(visible);
        clustersRef.current = byKey;

        const initialEdits: Record<string, string> = {};
        visible.forEach((f) => {
            const k = `${f.x},${f.y}`; // chave simples por coord (já dedupado)
            initialEdits[k] = f.value ?? "";
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

    const handleUpdateZpl = () => {
        setIsUpdating(true);
        try {
          // 1) Re-parseia o ZPL ATUAL (não o original!)
          const parsedNow = parseZplFields(currentZpl);
          const { visible, byKey } = clusterizeFields(parsedNow);
      
          // 2) Monta a lista de mudanças (todas as camadas de cada campo alterado)
          type Change = { field: ZplField; encoded: string };
          const changes: Change[] = [];
      
          for (const rep of visible) {
            const key = `${rep.x},${rep.y}`;
            const edited = editedValues[key] ?? "";
            const original = rep.value ?? "";
      
            if (edited === original) continue;
      
            // preserva prefixo tipo "Pedido: ", "Nota Fiscal: ", etc.
            let toWrite = edited;
            const idx = (rep.value ?? "").indexOf(": ");
            if (idx > -1) {
              toWrite = (rep.value ?? "").slice(0, idx + 2) + edited;
            }
      
            const enc = encodeFH(toWrite);
            const group = byKey[key] || [rep];
            for (const layer of group) {
              changes.push({ field: layer, encoded: enc });
            }
          }
      
          if (changes.length === 0) {
            setIsUpdating(false);
            return;
          }
      
          // 3) Aplica tudo de trás pra frente (start DESC) para não quebrar offsets
          changes.sort((a, b) => b.field.start - a.field.start);
      
          let out = currentZpl;
          for (const ch of changes) {
            out = out.slice(0, ch.field.start) + ch.encoded + out.slice(ch.field.end);
          }
      
          setCurrentZpl(out);
          toast({ title: 'Etiqueta Atualizada!', description: 'O ZPL foi reconstruído com os novos dados.' });
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
      
    // Função para determinar o tipo de campo com base no conteúdo
    const getFieldType = (value: string): RemixableField | null => {
        if (value.match(/^\d{10,}$/)) return 'trackingNumber'; // Long numbers are likely tracking numbers
        if (value.toLowerCase().includes('pedido')) return 'orderNumber';
        if (value.toLowerCase().includes('nota fiscal')) return 'invoiceNumber';
        if (value.toLowerCase().includes('lighthouse')) return 'senderName'; // Exemplo, pode ser melhorado
        if (value.toLowerCase().includes('rua') || value.toLowerCase().includes('alfandega')) return 'senderAddress';
        return null;
    }

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
                            const fieldType = getFieldType(field.value);
                            return (
                                <div key={fieldKey} className="space-y-1.5">
                                    <Label htmlFor={fieldKey} className="text-xs text-muted-foreground">
                                        Campo em (X: {field.x}, Y: {field.y})
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={fieldKey}
                                            name={fieldKey}
                                            value={editedValues[fieldKey] ?? ''}
                                            onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                                            className="font-mono text-sm"
                                        />
                                        {fieldType && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleRemixField(fieldKey, field.value, fieldType)} 
                                                disabled={!!isRemixing}
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
                <div className="flex justify-end items-center sticky bottom-0 bg-background py-4 flex-shrink-0">
                    <Button onClick={handleUpdateZpl} disabled={isUpdating || isRendering}>
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

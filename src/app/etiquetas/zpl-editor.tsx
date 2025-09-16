
"use client";

import * as React from 'react';
import { Loader2, RefreshCw, Printer, Code, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { parseZplFields, updateFieldAt, type ZplField } from '@/lib/zpl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { assertElements } from "@/lib/assert-elements";

assertElements({ Loader2, RefreshCw, Printer, Code, ImageIcon, Button, Input, Label, Image, ScrollArea });


interface ZplEditorProps {
  originalZpl: string;
}

export function ZplEditor({ originalZpl }: ZplEditorProps) {
    const { toast } = useToast();
    const printRef = React.useRef<HTMLDivElement>(null);
    const [fields, setFields] = React.useState<ZplField[]>([]);
    const [editedValues, setEditedValues] = React.useState<Record<string, string>>({});
    const [currentZpl, setCurrentZpl] = React.useState(originalZpl);
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [isRendering, setIsRendering] = React.useState(false);
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [showRawZpl, setShowRawZpl] = React.useState(false);

    React.useEffect(() => {
        const parsedFields = parseZplFields(originalZpl);
        setFields(parsedFields);
        const initialEdits: Record<string, string> = {};
        parsedFields.forEach((field, index) => {
             // Create a truly unique key using index as a tie-breaker for identical fields
            const fieldKey = `${field.x},${field.y},${index}`;
            initialEdits[fieldKey] = field.value;
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
        let newZpl = originalZpl;
        fields.forEach((field, index) => {
            const fieldKey = `${field.x},${field.y},${index}`;
            const editedValue = editedValues[fieldKey];
            const originalValue = field.value;

            if (editedValue !== originalValue) {
                // Use the original start/end positions to replace the content
                newZpl = updateFieldAt(newZpl, { x: field.x, y: field.y }, editedValue, field.start);
            }
        });
        setCurrentZpl(newZpl);
        toast({ title: 'Etiqueta Atualizada!', description: 'O ZPL foi reconstruído com os novos dados.' });
        setIsUpdating(false);
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
                        {fields.sort((a,b) => a.y - b.y || a.x - b.x).map((field, index) => {
                            const fieldKey = `${field.x},${field.y},${index}`;
                            if (field.kind === 'qrcode') return null; // Don't show QR code data for editing by default

                            return (
                                <div key={fieldKey} className="space-y-1.5">
                                    <Label htmlFor={fieldKey} className="text-xs text-muted-foreground">
                                        Campo em (X: {field.x}, Y: {field.y})
                                    </Label>
                                    <Input
                                        id={fieldKey}
                                        name={fieldKey}
                                        value={editedValues[fieldKey] || ''}
                                        onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                                        className="font-mono text-sm"
                                    />
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


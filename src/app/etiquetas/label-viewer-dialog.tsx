
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon, Printer, Download } from "lucide-react";
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface LabelViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  zplContent: string | null;
}

export function LabelViewerDialog({ isOpen, onClose, zplContent }: LabelViewerDialogProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && zplContent) {
      const generateImage = async () => {
        setIsRendering(true);
        setImageUrl(null);
        try {
          const response = await fetch('/api/zpl-preview', { method: 'POST', body: zplContent });
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
      };
      generateImage();
    } else {
        setImageUrl(null); // Clear image when dialog is closed or no zpl
    }
    // Cleanup function to revoke URL
    return () => {
        if(imageUrl) {
            URL.revokeObjectURL(imageUrl);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, zplContent, toast]);

  const handlePrint = () => {
    if (printRef.current) {
        const printWindow = window.open('', '', 'height=800,width=800');
        printWindow?.document.write('<html><head><title>Imprimir Etiqueta</title>');
        printWindow?.document.write('<style>@media print { body { margin: 0; } img { max-width: 100%; } }</style>');
        printWindow?.document.write('</head><body>');
        printWindow?.document.write(printRef.current.innerHTML);
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.focus();
        printWindow?.print();
    }
  };

  const handleDownload = () => {
    if (imageUrl) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `etiqueta-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Visualização da Etiqueta</DialogTitle>
          <DialogDescription>
            Esta é a prévia da etiqueta que foi gerada e salva no sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4 min-h-[400px] bg-muted rounded-md" ref={printRef}>
            {isRendering ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p>Renderizando etiqueta...</p>
                </div>
            ) : imageUrl ? (
                <Image src={imageUrl} alt="Pré-visualização da Etiqueta ZPL" width={500} height={750} style={{ objectFit: 'contain' }} />
            ) : (
                <div className="flex flex-col items-center gap-2 text-destructive">
                    <ImageIcon size={32} />
                    <p>Não foi possível carregar a imagem da etiqueta.</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDownload} disabled={!imageUrl || isRendering}>
            <Download className="mr-2 h-4 w-4" />
            Baixar
          </Button>
          <Button onClick={handlePrint} disabled={!imageUrl || isRendering}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

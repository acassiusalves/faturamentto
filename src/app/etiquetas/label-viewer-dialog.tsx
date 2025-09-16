
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Image as ImageIcon } from "lucide-react";
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";

interface LabelViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  zplContent: string | null;
}

export function LabelViewerDialog({ isOpen, onClose, zplContent }: LabelViewerDialogProps) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(false);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Visualização da Etiqueta</DialogTitle>
          <DialogDescription>
            Esta é a prévia da etiqueta que foi gerada e salva no sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4 min-h-[400px] bg-muted rounded-md">
            {isRendering ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p>Renderizando etiqueta...</p>
                </div>
            ) : imageUrl ? (
                <Image src={imageUrl} alt="Pré-visualização da Etiqueta ZPL" width={400} height={600} style={{ objectFit: 'contain' }} />
            ) : (
                <div className="flex flex-col items-center gap-2 text-destructive">
                    <ImageIcon size={32} />
                    <p>Não foi possível carregar a imagem da etiqueta.</p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

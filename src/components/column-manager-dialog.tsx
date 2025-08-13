
"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Columns3, EyeOff } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "./ui/scroll-area";
import { iderisFields } from "@/lib/ideris-fields";
import { loadAppSettings, saveAppSettings } from "@/services/firestore";

interface ColumnManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ColumnManagerDialog({ isOpen, onClose }: ColumnManagerDialogProps) {
  const [ignoredColumns, setIgnoredColumns] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      loadAppSettings().then(settings => {
        const ignored = settings?.ignoredIderisColumns || [];
        const initialState: Record<string, boolean> = {};
        ignored.forEach(key => {
          initialState[key] = true;
        });
        setIgnoredColumns(initialState);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const handleCheckedChange = (key: string, checked: boolean) => {
    setIgnoredColumns(prev => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ignoredKeys = Object.keys(ignoredColumns).filter(key => ignoredColumns[key]);
      await saveAppSettings({ ignoredIderisColumns: ignoredKeys });
      toast({
        title: "Configurações Salvas!",
        description: "Suas preferências de coluna foram atualizadas. As colunas ignoradas não aparecerão mais no seletor 'Exibir Colunas'."
      });
      onClose();
    } catch (error) {
      console.error("Failed to save ignored columns:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as configurações." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns3 />
            Gerenciar Colunas da Ideris
          </DialogTitle>
          <DialogDescription>
            Marque as colunas que você deseja ignorar. Elas não aparecerão no seletor "Exibir Colunas", simplificando sua visualização.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="py-4">
            <ScrollArea className="h-72 rounded-md border p-4">
              <div className="space-y-4">
                {iderisFields.map(field => (
                  <div key={field.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={`ignore-${field.key}`}
                      checked={ignoredColumns[field.key] || false}
                      onCheckedChange={(checked) => handleCheckedChange(field.key, !!checked)}
                    />
                    <Label htmlFor={`ignore-${field.key}`} className="font-normal cursor-pointer">
                      <span className="text-sm">{field.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({field.key})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="animate-spin mr-2" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

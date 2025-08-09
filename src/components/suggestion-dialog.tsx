"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, Save } from 'lucide-react';
import { getMappingSuggestions } from '@/lib/actions';
import { systemFields } from '@/lib/system-fields';
import { iderisFields } from '@/lib/ideris-fields';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

interface SuggestionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  marketplaceId: string;
  headers: string[];
  isIderisApi?: boolean;
  onSave: (marketplaceId: string, acceptedSuggestions: Record<string, string>) => void;
}

export function SuggestionDialog({ isOpen, onClose, marketplaceId, headers, isIderisApi = false, onSave }: SuggestionDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  const fieldsToMap = isIderisApi ? iderisFields : systemFields;

  useEffect(() => {
    if (isOpen) {
      const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
          const result = await getMappingSuggestions(marketplaceId, headers);
          setSuggestions(result);
          // Pre-accept all found suggestions
          const initialAccepted: Record<string, boolean> = {};
          for (const key in result) {
            if (result[key]) {
              initialAccepted[key] = true;
            }
          }
          setAccepted(initialAccepted);
        } catch (error) {
           toast({
            variant: "destructive",
            title: "Erro na Sugestão",
            description: "Não foi possível obter sugestões da IA. Tente novamente.",
           });
        } finally {
          setIsLoading(false);
        }
      };
      fetchSuggestions();
    }
  }, [isOpen, marketplaceId, headers, toast, isIderisApi]);
  
  const handleAcceptChange = (systemField: string, isChecked: boolean) => {
    setAccepted(prev => ({ ...prev, [systemField]: isChecked }));
  };

  const handleSave = () => {
    const acceptedSuggestions: Record<string, string> = {};
    for (const key in accepted) {
      if (accepted[key] && suggestions[key]) {
        acceptedSuggestions[key] = suggestions[key];
      }
    }
    onSave(marketplaceId, acceptedSuggestions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sugestões de Mapeamento com IA</DialogTitle>
          <DialogDescription>
            Analisamos os cabeçalhos do seu arquivo e sugerimos os seguintes mapeamentos.
            Marque os que deseja aceitar.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin" />
            <p className="ml-2">Analisando e buscando sugestões...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
             <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-4 px-4 pb-2 border-b">
                <div/>
                <h4 className="font-semibold text-sm text-muted-foreground">Campo do Sistema</h4>
                <div />
                <h4 className="font-semibold text-sm text-muted-foreground">Coluna Sugerida</h4>
            </div>
            {fieldsToMap.map(field => {
                const suggestion = suggestions[field.key];
                return (
                     <div key={field.key} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-4 py-2 hover:bg-muted/50 rounded-md">
                        <Checkbox
                            id={`accept-${field.key}`}
                            checked={!!accepted[field.key]}
                            onCheckedChange={(checked) => handleAcceptChange(field.key, !!checked)}
                            disabled={!suggestion}
                            className="ml-4"
                        />
                        <Label htmlFor={`accept-${field.key}`} className="cursor-pointer">
                            <span className="font-medium text-sm">{field.name}</span>
                        </Label>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        {suggestion ? (
                             <Badge variant="secondary" className="font-normal justify-start py-1.5">{suggestion}</Badge>
                        ) : (
                             <Badge variant="outline" className="font-normal justify-start py-1.5 border-dashed">Nenhuma sugestão encontrada</Badge>
                        )}
                    </div>
                )
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="mr-2" />
            Salvar Mapeamentos Aceitos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
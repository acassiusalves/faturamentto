"use client";

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowRight, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ColumnMapping } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface MappingFormProps {
  marketplaceId: string;
  systemFieldsToMap: { key: string; name: string; required?: boolean; description: string }[];
  sourceFields: string[];
  initialMappings: Partial<ColumnMapping>;
  onSave: (marketplaceId: string, mappings: Partial<ColumnMapping>) => void;
}

export function MappingForm({
  marketplaceId,
  systemFieldsToMap,
  sourceFields,
  initialMappings,
  onSave,
}: MappingFormProps) {
  const [mappings, setMappings] = useState<Partial<ColumnMapping>>(initialMappings);
  const { toast } = useToast();

  useEffect(() => {
    setMappings(initialMappings);
  }, [initialMappings]);

  const handleMappingChange = (systemField: string, sourceField: string) => {
    setMappings(prev => ({ ...prev, [systemField]: sourceField }));
  };
  
  const handleSaveChanges = () => {
    onSave(marketplaceId, mappings);
    toast({
      title: "Mapeamento Salvo!",
      description: `As associações para ${marketplaceId} foram salvas.`
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-4 pb-2 border-b">
          <h4 className="font-semibold text-sm text-muted-foreground">Campo do Sistema</h4>
          <div />
          <h4 className="font-semibold text-sm text-muted-foreground">Coluna do seu Arquivo</h4>
        </div>
        {systemFieldsToMap.map(field => (
          <div key={field.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4">
            <div className="flex flex-col">
              <span className="font-medium text-sm">{field.name}</span>
              <span className="text-xs text-muted-foreground">{field.description}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Select
              value={mappings[field.key] || ''}
              onValueChange={value => handleMappingChange(field.key, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma coluna..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Não Mapear --</SelectItem>
                {sourceFields.map(header => (
                  <SelectItem key={header} value={header}>{header}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
         <div className="flex justify-end pt-4">
            <Button onClick={handleSaveChanges}><Save className="mr-2"/>Salvar Mapeamento</Button>
         </div>
      </CardContent>
    </Card>
  );
}
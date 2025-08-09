"use client";

import { useState, useEffect } from "react";
import type { ColumnMapping } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { systemFields } from "@/lib/system-fields";
import { iderisFields } from "@/lib/ideris-fields";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Check, Save } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";

interface MappingFormProps {
  marketplaceId: string;
  sourceFields: string[]; // These are the headers from CSV or keys from Ideris
  systemFieldsToMap: typeof systemFields; // The system fields to display for mapping
  initialMappings: Partial<ColumnMapping>;
  onSave: (marketplaceId: string, mappings: Partial<ColumnMapping>) => void;
  isIderisApi?: boolean;
}

const getIderisFieldLabel = (key: string) => {
    return iderisFields.find(f => f.key === key)?.name || key;
};

export function MappingForm({ marketplaceId, sourceFields, systemFieldsToMap, initialMappings, onSave, isIderisApi = false }: MappingFormProps) {
  const [mappings, setMappings] = useState<Partial<ColumnMapping>>(initialMappings);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    setMappings(initialMappings);
  }, [initialMappings, marketplaceId]);

  const handleMappingChange = (systemField: keyof ColumnMapping, sourceFieldKey: string) => {
    setMappings((prev) => {
        const newMappings = { ...prev };
        
        // Deselect if the same sourceField is chosen
        if (newMappings[systemField] === sourceFieldKey) {
             delete newMappings[systemField];
        } else {
            // Unmap from any other systemField that might be using this sourceField
            for(const key in newMappings) {
                if(newMappings[key as keyof ColumnMapping] === sourceFieldKey) {
                    delete newMappings[key as keyof ColumnMapping];
                }
            }
            newMappings[systemField] = sourceFieldKey;
        }

        return newMappings;
    });
    setOpenPopovers(prev => ({ ...prev, [systemField]: false }));
  };
  
  const handleSaveClick = () => {
    onSave(marketplaceId, mappings);
      toast({
      title: "Mapeamento Salvo!",
      description: `As associações para ${marketplaceId} foram salvas.`
    })
  }

  const currentlyUsedSourceFields = new Set(Object.values(mappings).filter(Boolean));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4 p-4 border rounded-lg">
        {systemFieldsToMap.map((field) => {
          const currentSelectionKey = mappings[field.key as keyof ColumnMapping];
          
          return (
            <div key={field.key} className="space-y-2">
              <Label 
                htmlFor={`mapping-${marketplaceId}-${field.key}`}
                className={cn(currentSelectionKey && 'text-primary font-semibold')}
              >
                  {field.name}
              </Label>
               <Popover open={openPopovers[field.key]} onOpenChange={(isOpen) => setOpenPopovers(prev => ({ ...prev, [field.key]: isOpen }))}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openPopovers[field.key]}
                    className="w-full justify-between font-normal"
                     id={`mapping-${marketplaceId}-${field.key}`}
                  >
                    <span className="truncate">
                      {currentSelectionKey ? (isIderisApi ? getIderisFieldLabel(currentSelectionKey) : currentSelectionKey) : `Selecione um campo de ${isIderisApi ? 'Ideris' : 'origem'}...`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" style={{width: 'var(--radix-popover-trigger-width)'}}>
                  <Command>
                    <CommandInput placeholder="Buscar campo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum campo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {sourceFields
                          .filter(h => !currentlyUsedSourceFields.has(h) || h === currentSelectionKey)
                          .map((sourceFieldKey) => {
                            const label = isIderisApi ? getIderisFieldLabel(sourceFieldKey) : sourceFieldKey;
                            // The value for searching should contain both the label and the key
                            const searchValue = `${label} ${sourceFieldKey}`.toLowerCase();
                            return (
                              <CommandItem
                                key={sourceFieldKey}
                                value={searchValue}
                                onSelect={() => {
                                  handleMappingChange(field.key as keyof ColumnMapping, sourceFieldKey);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentSelectionKey === sourceFieldKey ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {label}
                              </CommandItem>
                            )
                          })}
                         {sourceFields.length === 0 && (
                           <CommandItem disabled>
                              Carregue os cabeçalhos...
                           </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSaveClick}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Mapeamento de {marketplaceId}
        </Button>
      </div>
    </div>
  );
}

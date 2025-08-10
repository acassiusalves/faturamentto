
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { iderisFields } from "@/lib/ideris-fields";
import { ArrowRight, Save } from "lucide-react";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface FriendlyMappingFormProps {
  initialNames: Record<string, string>;
  onSave: (newNames: Record<string, string>) => void;
}

export function FriendlyMappingForm({ initialNames, onSave }: FriendlyMappingFormProps) {
  const [friendlyNames, setFriendlyNames] = useState(initialNames);
  const { toast } = useToast();

  useEffect(() => {
    setFriendlyNames(initialNames);
  }, [initialNames]);

  const handleNameChange = (fieldKey: string, newName: string) => {
    setFriendlyNames(prev => ({ ...prev, [fieldKey]: newName }));
  };

  const handleSave = () => {
    onSave(friendlyNames);
  };
  
  const handleReset = (fieldKey: string) => {
     setFriendlyNames(prev => {
        const newNames = {...prev};
        delete newNames[fieldKey];
        return newNames;
     })
  }

  return (
    <div className="space-y-6">
        <div className="p-4 border rounded-lg bg-background space-y-4 max-h-[400px]">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-4 px-4 sticky top-0 bg-background pb-2 border-b">
                <h4 className="font-semibold text-sm text-muted-foreground">Nome do campo Ideris</h4>
                <div />
                <h4 className="font-semibold text-sm text-muted-foreground">Visualização no Sistema</h4>
                <div/>
            </div>
            <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                    {iderisFields.map((field) => (
                    <div key={field.key} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-4">
                        <div>
                            <Badge variant="secondary" className="w-full justify-start py-2">
                                {field.label}
                            </Badge>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <Input
                                id={`friendly-name-${field.key}`}
                                value={friendlyNames[field.key] || ""}
                                onChange={(e) => handleNameChange(field.key, e.target.value)}
                                placeholder={field.label} // Default to original label
                            />
                        </div>
                         <Button variant="ghost" size="sm" onClick={() => handleReset(field.key)}>
                            Redefinir
                         </Button>
                    </div>
                    ))}
                </div>
             </ScrollArea>
        </div>
      <div className="flex justify-end">
        <Button onClick={handleSave}>
            <Save className="mr-2" />
            Salvar Nomes Amigáveis
        </Button>
      </div>
    </div>
  );
}

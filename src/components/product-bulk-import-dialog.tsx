"use client";

import { useState } from "react";
import type { Product, ProductCategorySettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProductBulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category: "Celular";
  settings: ProductCategorySettings;
  onSave: (products: Omit<Product, 'id' | 'createdAt'>[]) => Promise<void>;
}

function parseAttributesFromName(name: string, settings: ProductCategorySettings): Record<string, string> {
    const attributes: Record<string, string> = {};
    let remainingName = name;

    // Iterate through all possible attribute values from settings
    for (const attribute of settings.attributes) {
        for (const value of attribute.values) {
            // Use a regex to find the value as a whole word to avoid partial matches
            const regex = new RegExp(`\\b${value}\\b`, 'i');
            if (regex.test(remainingName)) {
                attributes[attribute.key] = value;
                // Remove the found value from the string to avoid re-matching
                remainingName = remainingName.replace(regex, '').trim();
                // Move to the next attribute since we found a value for this one
                break; 
            }
        }
    }
    return attributes;
}


export function ProductBulkImportDialog({ isOpen, onClose, category, settings, onSave }: ProductBulkImportDialogProps) {
  const [textValue, setTextValue] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!textValue.trim()) {
        toast({ variant: 'destructive', title: 'Nenhum dado inserido', description: 'Por favor, cole os dados do produto na área de texto.'});
        return;
    }
    
    setIsParsing(true);
    try {
        const lines = textValue.trim().split('\n');
        const productsToImport: Omit<Product, 'id' | 'createdAt'>[] = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            // Regex to capture the name and the SKU at the end of the line
            const match = line.trim().match(/(.+?)\s+(#\w+)\s*$/);

            if (!match) {
                console.warn(`Linha ignorada (formato inválido): "${line}"`);
                continue;
            }

            const name = match[1].trim();
            const sku = match[2].trim();
            const attributes = parseAttributesFromName(name, settings);
            
            // Check if all attributes were found
            const allAttributesFound = settings.attributes.every(attr => attributes[attr.key]);
            if (!allAttributesFound) {
                 console.warn(`Atributos não encontrados para o produto: "${name}". Atributos encontrados:`, attributes);
            }

            productsToImport.push({
                name,
                sku,
                category,
                attributes,
                associatedSkus: [],
            });
        }
        
        if (productsToImport.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Nenhum Produto Válido Encontrado',
                description: 'Verifique o formato dos dados. O padrão esperado é "Nome do Produto" e o SKU no final (ex: #SKU123).',
            });
        } else {
            await onSave(productsToImport);
            onClose(); // Close dialog on successful save
        }
    } catch (error) {
        console.error("Erro na importação em massa:", error);
        toast({ variant: 'destructive', title: 'Erro na Importação', description: 'Ocorreu um erro inesperado.' });
    } finally {
        setIsParsing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
            setTextValue(""); // Clear state on close
        }
        onClose();
    }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Produtos em Massa</DialogTitle>
          <DialogDescription>
            Cole aqui a sua lista de produtos. Cada linha deve conter o nome completo do produto e o SKU no final.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
           <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Formato Esperado</AlertTitle>
              <AlertDescription>
                <p>Cada linha deve conter o nome e o SKU, separados por um espaço ou tab. Exemplo:</p>
                <code className="block bg-muted p-2 rounded-md mt-2 text-sm">
                    Xiaomi Poco M5S 128GB Global 6GB Azul 4G #83A
                </code>
              </AlertDescription>
           </Alert>
          <div className="space-y-2">
            <Label htmlFor="bulk-import-textarea">Lista de Produtos</Label>
            <Textarea
              id="bulk-import-textarea"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Motorola Moto G22 64GB Global 4GB Preto 4G 	#47P&#x0a;Xiaomi Poco M5S 128GB Global 6GB Azul 4G 	#83A"
              rows={15}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isParsing}>Cancelar</Button>
          <Button onClick={handleImport} disabled={isParsing}>
            {isParsing ? <Loader2 className="animate-spin" /> : <Upload />}
            Importar e Salvar Produtos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, Sparkles, Plus, Minus, X, Divide, Sigma, Trash2, Hash } from 'lucide-react';
import type { FormulaItem, CustomCalculation } from '@/lib/types';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (calculation: CustomCalculation) => Promise<void>;
  marketplaces: string[];
  availableColumns: { key: string; label: string }[];
}

export function CalculationDialog({ isOpen, onClose, onSave, marketplaces, availableColumns }: CalculationDialogProps) {
  const [formula, setFormula] = useState<FormulaItem[]>([]);
  const [columnName, setColumnName] = useState("");
  const [isPercentage, setIsPercentage] = useState(false);
  const [targetMarketplace, setTargetMarketplace] = useState<string>("all");
  const [numberValue, setNumberValue] = useState('');
  const { toast } = useToast();

  const handleItemClick = (item: FormulaItem) => {
    const lastItem = formula[formula.length - 1];
    
    if (item.type === 'operator' && item.value !== '(' && (!lastItem || lastItem.type === 'operator')) {
        // Prevent adding operator if last item is also an operator (except opening parenthesis)
        return;
    }
    if ((item.type === 'column' || item.type === 'number') && lastItem && lastItem.type !== 'operator') {
        // Prevent adding column/number if last item is not an operator
        return;
    }
    
    setFormula(prev => [...prev, item]);
  };
  
  const handleAddNumber = () => {
    const num = parseFloat(numberValue);
    if (!isNaN(num)) {
      handleItemClick({ type: 'number', value: numberValue, label: numberValue });
      setNumberValue('');
    } else {
      toast({ variant: 'destructive', title: 'Número inválido', description: 'Por favor, insira um número válido.' });
    }
  };

  const handleClear = () => {
    setFormula([]);
    setColumnName("");
    setIsPercentage(false);
    setTargetMarketplace("all");
    setNumberValue('');
  };

  const handleBackspace = () => {
    setFormula(prev => prev.slice(0, -1));
  };
  
  const handleSaveCalculation = async () => {
      if (!columnName.trim()) {
          toast({ variant: 'destructive', title: 'Nome da Coluna Obrigatório', description: 'Por favor, dê um nome para sua nova coluna.' });
          return;
      }
      if (formula.length === 0 || (formula[formula.length - 1].type === 'operator' && formula[formula.length - 1].value !== ')')) {
          toast({ variant: 'destructive', title: 'Fórmula Inválida', description: 'A fórmula não pode estar vazia ou terminar com um operador.' });
          return;
      }
      
      const newCalculation: CustomCalculation = {
          id: `custom_${columnName.toLowerCase().replace(/\s/g, '_')}_${Date.now()}`,
          name: columnName,
          formula: formula,
          isPercentage: isPercentage,
          targetMarketplace: targetMarketplace === 'all' ? undefined : targetMarketplace,
      };

      await onSave(newCalculation);
      toast({ title: 'Coluna Criada!', description: `A coluna "${columnName}" foi adicionada à tabela.` });
      handleClear();
      onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClear();
      onClose();
    }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Criar Coluna Calculada</DialogTitle>
          <DialogDescription>
            Crie colunas personalizadas com fórmulas para obter novos insights. O cálculo será aplicado em cada linha da tabela.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="column-name">1. Nome da Nova Coluna</Label>
                <Input 
                  id="column-name"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="Ex: Lucro Líquido Real"
                />
              </div>
              <div className="space-y-2 lg:col-span-1">
                 <Label htmlFor="target-marketplace">Canal de Venda (Opcional)</Label>
                 <Select value={targetMarketplace} onValueChange={setTargetMarketplace}>
                    <SelectTrigger id="target-marketplace">
                        <SelectValue placeholder="Aplicar a todos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Aplicar a todos</SelectItem>
                        {marketplaces.map(mp => (
                            <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
               <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-auto lg:col-span-1">
                    <div className="space-y-0.5">
                        <Label>É porcentagem?</Label>
                        <p className="text-xs text-muted-foreground">
                            O resultado final será x100.
                        </p>
                    </div>
                    <Switch
                        checked={isPercentage}
                        onCheckedChange={setIsPercentage}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>2. Monte a Fórmula</Label>
                <div className="p-4 border rounded-lg min-h-[80px] bg-muted/50">
                    <p className="text-sm text-muted-foreground">Fórmula:</p>
                    <ScrollArea className="h-20">
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-lg font-mono">
                            {formula.length > 0 ? formula.map((item, index) => (
                                <Badge key={index} variant={item.type === 'column' ? 'default' : (item.type === 'number' ? 'outline' : 'secondary')}>
                                    {item.label}
                                </Badge>
                            )) : <span className="text-sm text-muted-foreground">Clique nos campos e operadores abaixo...</span>}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Colunas Disponíveis</p>
                    <div className="flex flex-wrap gap-2">
                        {availableColumns.map(col => (
                            <Button 
                                key={col.key} 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleItemClick({ type: 'column', value: col.key, label: col.label })}
                            >
                                {col.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-semibold">Operadores</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleItemClick({ type: 'operator', value: '+', label: '+'})}><Plus/></Button>
                        <Button variant="outline" size="icon" onClick={() => handleItemClick({ type: 'operator', value: '-', label: '-' })}><Minus/></Button>
                        <Button variant="outline" size="icon" onClick={() => handleItemClick({ type: 'operator', value: '*', label: '×' })}><X/></Button>
                        <Button variant="outline" size="icon" onClick={() => handleItemClick({ type: 'operator', value: '/', label: '÷' })}><Divide/></Button>
                        <Button variant="outline" size="sm" onClick={() => handleItemClick({ type: 'operator', value: '(', label: '(' })}>(</Button>
                        <Button variant="outline" size="sm" onClick={() => handleItemClick({ type: 'operator', value: ')', label: ')' })}>)</Button>
                    </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-semibold">Adicionar Valor Numérico</p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="Ex: 0.18"
                            value={numberValue}
                            onChange={(e) => setNumberValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNumber(); } }}
                        />
                        <Button onClick={handleAddNumber}><Hash className="mr-2" /> Adicionar Número</Button>
                    </div>
                </div>
            </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex-1 justify-start">
                 <Button variant="ghost" onClick={handleBackspace}><Trash2 className="mr-2"/>Apagar último</Button>
                 <Button variant="secondary" onClick={handleClear}>Limpar Tudo</Button>
            </div>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSaveCalculation}><Sigma className="mr-2" /> Criar Coluna</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

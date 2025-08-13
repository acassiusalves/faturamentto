
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
import { Calculator, Sparkles, Plus, Minus, X, Divide, Sigma, Trash2 } from 'lucide-react';
import type { FormulaItem, CustomCalculation } from '@/lib/types';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';

interface CalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (calculation: CustomCalculation) => Promise<void>;
}

const availableColumns: { key: string; label: string }[] = [
    { key: 'value_with_shipping', label: 'Venda Bruta' },
    { key: 'fee_order', label: 'Comissão' },
    { key: 'fee_shipment', label: 'Frete' },
    { key: 'product_cost', label: 'Custo do Produto' },
    { key: 'left_over', label: 'Lucro (Ideris)' },
];

export function CalculationDialog({ isOpen, onClose, onSave }: CalculationDialogProps) {
  const [formula, setFormula] = useState<FormulaItem[]>([]);
  const [columnName, setColumnName] = useState("");
  const [isPercentage, setIsPercentage] = useState(false);
  const { toast } = useToast();

  const handleItemClick = (item: FormulaItem) => {
    const lastItem = formula[formula.length - 1];
    if(item.type === 'operator' && (item.value === '(' || item.value === ')')) {
      // Allow parenthesis
    } else if (lastItem && lastItem.type === item.type) {
      return;
    }
    setFormula(prev => [...prev, item]);
  };

  const handleClear = () => {
    setFormula([]);
    setColumnName("");
    setIsPercentage(false);
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="column-name">1. Nome da Nova Coluna</Label>
                <Input 
                  id="column-name"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="Ex: Lucro Líquido Real"
                />
              </div>
               <div className="flex flex-row items-center justify-between rounded-lg border p-3 mt-auto">
                    <div className="space-y-0.5">
                        <Label>É porcentagem?</Label>
                        <p className="text-xs text-muted-foreground">
                            O resultado final será multiplicado por 100.
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
                                <Badge key={index} variant={item.type === 'column' ? 'default' : 'secondary'}>
                                    {item.label}
                                </Badge>
                            )) : <span className="text-sm text-muted-foreground">Clique nos campos e operadores abaixo...</span>}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
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


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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Sparkles, Plus, Minus, X, Divide, Sigma } from 'lucide-react';
import type { Sale } from '@/lib/types';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface CalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  salesData: Sale[];
  productCostSource: Map<string, number>;
}

type FormulaItem = { type: 'column' | 'operator'; value: string; label: string };

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function CalculationDialog({ isOpen, onClose, salesData, productCostSource }: CalculationDialogProps) {
  const [formula, setFormula] = useState<FormulaItem[]>([]);
  const [result, setResult] = useState<number | null>(null);

  const availableColumns = useMemo(() => {
    return [
        { key: 'value_with_shipping', label: 'Venda Bruta' },
        { key: 'fee_order', label: 'Comissão' },
        { key: 'fee_shipment', label: 'Frete' },
        { key: 'product_cost', label: 'Custo do Produto' },
        { key: 'left_over', label: 'Lucro (Ideris)' },
    ];
  }, []);

  const handleItemClick = (item: FormulaItem) => {
    // Basic validation: prevent two operators or two columns in a row
    const lastItem = formula[formula.length - 1];
    if (lastItem && lastItem.type === item.type) {
        return; // Don't add if the type is the same as the last one
    }
    setFormula(prev => [...prev, item]);
  };
  
  const handleClear = () => {
    setFormula([]);
    setResult(null);
  };
  
  const handleBackspace = () => {
      setFormula(prev => prev.slice(0, -1));
  };
  
  const calculateTotal = () => {
      if (formula.length === 0 || formula[formula.length - 1].type === 'operator') {
          setResult(0);
          return;
      }
      
      let total = 0;
      
      salesData.forEach(sale => {
          let saleResult = 0;
          let currentOperator = '+';

          // Inject product cost into the sale object for calculation
          const saleWithCost = {
              ...sale,
              product_cost: productCostSource.get((sale as any).order_code) || 0,
          };

          for(let i = 0; i < formula.length; i++) {
              const item = formula[i];
              if (item.type === 'column') {
                  const value = (saleWithCost as any)[item.value] || 0;
                  switch(currentOperator) {
                      case '+': saleResult += value; break;
                      case '-': saleResult -= value; break;
                      case '*': saleResult *= value; break;
                      case '/': if(value !== 0) saleResult /= value; break;
                  }
              } else {
                  currentOperator = item.value;
              }
          }
          total += saleResult;
      });
      
      setResult(total);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClear();
        onClose();
    }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Calculadora da Conciliação</DialogTitle>
          <DialogDescription>
            Crie fórmulas personalizadas usando as colunas da tabela para obter novos insights sobre as vendas filtradas.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="calculator" className="w-full py-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calculator">
              <Calculator className="mr-2" />
              Cálculo Rápido
            </TabsTrigger>
            <TabsTrigger value="ai_suggestions" disabled>
              <Sparkles className="mr-2" />
              Sugestões com IA
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calculator" className="mt-6 space-y-4">
            <div className="p-4 border rounded-lg min-h-[80px] bg-muted/50">
                <p className="text-sm text-muted-foreground">Fórmula:</p>
                <ScrollArea className="h-20">
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-lg font-mono">
                        {formula.length > 0 ? formula.map((item, index) => (
                            <Badge key={index} variant={item.type === 'column' ? 'default' : 'secondary'}>
                                {item.label}
                            </Badge>
                        )) : <span className="text-sm text-muted-foreground">Clique nos campos abaixo para montar a fórmula...</span>}
                    </div>
                </ScrollArea>
            </div>

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
                 </div>
            </div>

            <div className="p-4 border-2 border-dashed rounded-lg text-center bg-background">
                <p className="text-sm text-muted-foreground">Resultado do Cálculo ({salesData.length} vendas)</p>
                <p className="text-3xl font-bold text-primary">
                    {result !== null ? formatCurrency(result) : 'R$ 0,00'}
                </p>
            </div>
            
          </TabsContent>
          
          <TabsContent value="ai_suggestions">
            {/* Placeholder for AI suggestions */}
          </TabsContent>
        </Tabs>

        <DialogFooter>
            <Button variant="ghost" onClick={handleBackspace}>Apagar último</Button>
            <Button variant="secondary" onClick={handleClear}>Limpar Tudo</Button>
            <Button onClick={calculateTotal}><Sigma className="mr-2" /> Calcular Total</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

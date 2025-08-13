
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

interface CalculationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  salesData: Sale[];
  productCostSource: Map<string, number>;
}

export function CalculationDialog({ isOpen, onClose, salesData, productCostSource }: CalculationDialogProps) {
  const [formula, setFormula] = useState<any[]>([]);
  const [result, setResult] = useState<number | null>(null);

  const availableColumns = useMemo(() => {
    // This should be expanded with all available columns from sales-table
    return [
        { key: 'value_with_shipping', label: 'Valor com Frete' },
        { key: 'fee_order', label: 'Comissão' },
        { key: 'fee_shipment', label: 'Frete' },
        { key: 'product_cost', label: 'Custo do Produto' },
        { key: 'left_over', label: 'Lucro (Ideris)' },
    ];
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Calculadora da Conciliação</DialogTitle>
          <DialogDescription>
            Crie fórmulas personalizadas usando as colunas da tabela para obter novos insights.
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
                <div className="text-lg font-mono">
                    {formula.length > 0 ? 'Formula placeholder' : 'Clique nos campos abaixo...'}
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold">Colunas Disponíveis</p>
                <div className="flex flex-wrap gap-2">
                    {availableColumns.map(col => (
                        <Button key={col.key} variant="outline" size="sm" disabled>
                            {col.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold">Operadores</p>
                 <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="icon" disabled><Plus/></Button>
                    <Button variant="outline" size="icon" disabled><Minus/></Button>
                    <Button variant="outline" size="icon" disabled><X/></Button>
                    <Button variant="outline" size="icon" disabled><Divide/></Button>
                 </div>
            </div>

            <div className="p-4 border-2 border-dashed rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Resultado do Cálculo</p>
                <p className="text-3xl font-bold text-primary">
                    {result !== null ? result.toFixed(2) : 'R$ 0,00'}
                </p>
            </div>
            
          </TabsContent>
          
          <TabsContent value="ai_suggestions">
            {/* Placeholder for AI suggestions */}
          </TabsContent>
        </Tabs>

        <DialogFooter>
            <Button variant="secondary" onClick={() => { setFormula([]); setResult(null); }}>Limpar</Button>
            <Button disabled><Sigma className="mr-2" /> Calcular Total</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

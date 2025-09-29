
"use client";

import * as React from 'react';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { findAveragePriceAction } from '@/app/actions';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface PriceAverageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productSku: string;
  onPriceCalculated: (price: number) => void;
}

const initialPriceState = { averagePrice: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Calculator className="mr-2" />}
      Calcular Média
    </Button>
  );
}

export function PriceAverageDialog({ isOpen, onClose, productName, productSku, onPriceCalculated }: PriceAverageDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [state, formAction] = useFormState(findAveragePriceAction, initialPriceState);

  React.useEffect(() => {
    // Preenche a busca com o nome ou sku do produto
    setSearchTerm(productName || productSku);
  }, [productName, productSku]);

  React.useEffect(() => {
    if (state.error) {
      toast({ variant: 'destructive', title: 'Erro ao Calcular', description: state.error });
    }
  }, [state.error, toast]);
  
  const handleConfirmPrice = () => {
    if (state.averagePrice !== null) {
      onPriceCalculated(state.averagePrice);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calcular Preço Médio de Custo</DialogTitle>
          <DialogDescription>
            Busque o preço médio de um produto com base nas últimas listas de fornecedores salvas no Feed.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-term">Produto/SKU para Buscar</Label>
            <Input
              id="search-term"
              name="searchTerm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome ou SKU do produto..."
            />
          </div>
          <SubmitButton />
        </form>
        {state.averagePrice !== null && (
          <Alert>
            <AlertTitle className="text-lg">Preço Médio Calculado</AlertTitle>
            <AlertDescription className="text-2xl font-bold text-primary py-2">
              {formatCurrency(state.averagePrice)}
            </AlertDescription>
          </Alert>
        )}
         {state.error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
            </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirmPrice} disabled={state.averagePrice === null}>
            Usar este Preço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

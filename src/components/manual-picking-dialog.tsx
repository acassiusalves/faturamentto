"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { PickedItemLog } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ManualPickingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PickedItemLog, 'logId' | 'productId' | 'gtin' | 'origin' | 'quantity' | 'id' | 'createdAt'>) => Promise<void>;
}

const manualPickingSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório'),
  sku: z.string().min(1, 'SKU é obrigatório'),
  serialNumber: z.string().min(1, 'Número de série é obrigatório'),
  costPrice: z.coerce.number().min(0, 'Custo deve ser um valor positivo'),
  orderNumber: z.string().min(1, 'Número do pedido é obrigatório'),
  pickedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data de saída inválida',
  }),
});

type ManualPickingFormValues = z.infer<typeof manualPickingSchema>;

export function ManualPickingDialog({ isOpen, onClose, onSave }: ManualPickingDialogProps) {
  const form = useForm<ManualPickingFormValues>({
    resolver: zodResolver(manualPickingSchema),
    defaultValues: {
      name: '',
      sku: '',
      serialNumber: '',
      costPrice: 0,
      orderNumber: '',
      pickedAt: new Date().toISOString().substring(0, 16),
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (values: ManualPickingFormValues) => {
    const dataToSave = {
        ...values,
        pickedAt: new Date(values.pickedAt).toISOString(),
    }
    await onSave(dataToSave as any);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Registro de Picking Manual</DialogTitle>
          <DialogDescription>
            Insira os dados para um item que saiu do estoque sem passar pelo processo normal.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: iPhone 14 Pro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: IPH14PRO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Série (SN)</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o SN do item" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="costPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço de Custo (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Ex: 5000.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orderNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Pedido</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: PEDIDO-123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pickedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e Hora da Saída</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Salvar Registro
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

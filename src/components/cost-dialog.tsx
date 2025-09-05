
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type Cost, type Sale } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { Switch } from "./ui/switch";

interface CostDialogProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (costs: Cost[]) => void;
  formatCurrency: (value: number) => string;
}

const formSchema = z.object({
  type: z.string().min(2, {
    message: "O tipo deve ter pelo menos 2 caracteres.",
  }),
  value: z.coerce.number().min(0, "O valor deve ser um número positivo."),
  isPercentage: z.boolean().default(false),
});

export function CostDialog({
  sale,
  isOpen,
  onClose,
  onSave,
  formatCurrency,
}: CostDialogProps) {
  const { toast } = useToast();
  const [costs, setCosts] = useState<Cost[]>([]);

  useEffect(() => {
    if (sale) {
      setCosts(sale.costs || []);
    }
  }, [sale]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "",
      value: 0,
      isPercentage: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const newCost: Cost = {
      id: `COST-${Date.now()}`,
      type: values.type,
      value: values.value,
      isPercentage: values.isPercentage,
    };
    setCosts(prev => [...prev, newCost]);
    toast({
      title: "Custo Adicionado!",
      description: `O custo "${values.type}" foi adicionado temporariamente.`,
    });
    form.reset();
  }
  
  const handleRemoveCost = (costId: string) => {
    setCosts(prev => prev.filter(c => c.id !== costId));
  };
  
  const handleSaveChanges = () => {
    onSave(costs);
  }
  
  const calculateTotalAddedCosts = () => {
    if (!sale) return 0;
    const grossRevenue = (sale as any).value_with_shipping || 0;
    return costs.reduce((acc, cost) => {
       const costValue = cost.isPercentage ? (grossRevenue * cost.value) / 100 : cost.value;
       return acc + costValue;
    }, 0);
  }

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if(!open) {
            form.reset();
        }
        onClose();
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Custos da Venda</DialogTitle>
          <DialogDescription>
            Adicione ou remova custos para a venda <span className="font-bold">#{(sale as any).order_code || sale.orderNumber}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
                <h4 className="font-medium text-center">Adicionar Novo Custo</h4>
                 <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo/Descrição</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Imposto ST" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor (R$ ou %)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="15.50" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPercentage"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <FormLabel>É porcentagem?</FormLabel>
                                <p className="text-xs text-muted-foreground">
                                    Calculado sobre a receita bruta.
                                </p>
                            </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">Adicionar Custo à Lista</Button>
                  </form>
                </Form>
            </div>
            <div className="space-y-4">
                 <h4 className="font-medium text-center">Custos Adicionados</h4>
                 <div className="space-y-2 p-4 border rounded-lg min-h-[300px]">
                    {costs.length > 0 ? (
                        costs.map(cost => (
                           <div key={cost.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                             <div>
                                <p className="font-semibold">{cost.type}</p>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="font-mono">{formatCurrency(cost.value)}{cost.isPercentage && '%'}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveCost(cost.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                             </div>
                           </div>
                        ))
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Nenhum custo manual adicionado.
                        </div>
                    )}
                 </div>
                 <div className="p-4 border rounded-lg bg-background">
                     <div className="flex justify-between items-center font-semibold">
                         <span>Total de Custos Manuais:</span>
                         <span className="text-destructive">{formatCurrency(calculateTotalAddedCosts())}</span>
                     </div>
                 </div>
            </div>
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSaveChanges}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

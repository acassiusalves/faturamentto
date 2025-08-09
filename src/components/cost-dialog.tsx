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
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCategorySuggestion } from "@/lib/actions";
import { COST_CATEGORIES, type Cost, type Sale } from "@/lib/types";
import { Loader2, Sparkles, Trash2, Edit } from "lucide-react";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";

interface CostDialogProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (costs: Cost[]) => void;
  formatCurrency: (value: number) => string;
}

const formSchema = z.object({
  description: z.string().min(2, {
    message: "A descrição deve ter pelo menos 2 caracteres.",
  }),
  value: z.coerce.number().min(0, "O valor deve ser um número positivo."),
  category: z.enum(COST_CATEGORIES, {
    errorMap: () => ({ message: "Por favor, selecione uma categoria válida." }),
  }),
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
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [costs, setCosts] = useState<Cost[]>([]);

  useEffect(() => {
    if (sale) {
      setCosts(sale.costs || []);
    }
  }, [sale]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      value: 0,
      isPercentage: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const newCost: Cost = {
      id: `COST-${Date.now()}`,
      description: values.description,
      value: values.value,
      category: values.category,
      isPercentage: values.isPercentage,
    };
    setCosts(prev => [...prev, newCost]);
    toast({
      title: "Custo Adicionado!",
      description: `O custo "${values.description}" foi adicionado temporariamente.`,
    });
    form.reset();
  }
  
  const handleRemoveCost = (costId: string) => {
    setCosts(prev => prev.filter(c => c.id !== costId));
  };
  
  const handleSaveChanges = () => {
    onSave(costs);
  }

  const handleSuggestCategory = async () => {
    setIsSuggesting(true);
    const costDescription = form.getValues("description");
    if (!costDescription) {
      toast({
        variant: "destructive",
        title: "Descrição necessária",
        description: "Por favor, insira uma descrição para obter uma sugestão.",
      });
      setIsSuggesting(false);
      return;
    }

    try {
      const result = await getCategorySuggestion({
        transactionDescription: costDescription,
        availableCategories: [...COST_CATEGORIES],
      });
      if (result.suggestedCategory) {
        form.setValue("category", result.suggestedCategory as (typeof COST_CATEGORIES)[number], { shouldValidate: true });
        toast({
            title: "Sugestão de Categoria",
            description: `Sugerimos "${result.suggestedCategory}" com ${Math.round(result.confidenceScore * 100)}% de confiança.`,
        });
      } else {
        throw new Error("No suggestion returned");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na Sugestão",
        description: "Não foi possível obter uma sugestão. Tente novamente.",
      });
    } finally {
      setIsSuggesting(false);
    }
  };
  
  const calculateTotalAddedCosts = () => {
    if (!sale) return 0;
    return costs.reduce((acc, cost) => {
       const costValue = cost.isPercentage ? (sale.grossRevenue * cost.value) / 100 : cost.value;
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
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
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
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <div className="flex items-center gap-2">
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COST_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleSuggestCategory}
                                disabled={isSuggesting}
                                className="flex-shrink-0"
                                aria-label="Sugerir Categoria com IA"
                            >
                                {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormMessage />
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
                                <p className="font-semibold">{cost.description}</p>
                                <p className="text-xs text-muted-foreground">{cost.category}</p>
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

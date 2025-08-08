"use client";

import { useState } from "react";
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
import { Loader2, Sparkles } from "lucide-react";

interface AddCostDialogProps {
  sale: Sale | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddCost: (saleId: string, cost: Cost) => void;
}

const formSchema = z.object({
  description: z.string().min(2, {
    message: "A descrição deve ter pelo menos 2 caracteres.",
  }),
  amount: z.coerce.number().positive({
    message: "O valor deve ser um número positivo.",
  }),
  category: z.enum(COST_CATEGORIES, {
    errorMap: () => ({ message: "Por favor, selecione uma categoria válida." }),
  }),
});

export function AddCostDialog({
  sale,
  isOpen,
  onOpenChange,
  onAddCost,
}: AddCostDialogProps) {
  const { toast } = useToast();
  const [isSuggesting, setIsSuggesting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!sale) return;
    const newCost: Cost = {
      id: `COST-${Date.now()}`,
      ...values,
    };
    onAddCost(sale.id, newCost);
    toast({
      title: "Custo Adicionado!",
      description: `O custo "${values.description}" foi adicionado à venda.`,
    });
    form.reset();
    onOpenChange(false);
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

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Custo</DialogTitle>
          <DialogDescription>
            Adicione um novo custo para a venda de "{sale.productDescription}".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Custo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Taxa de processamento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="15.50" {...field} />
                  </FormControl>
                  <FormMessage />
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
                          <SelectValue placeholder="Selecione uma categoria" />
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
            <DialogFooter>
              <Button type="submit" className="bg-accent hover:bg-accent/90">Adicionar Custo</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

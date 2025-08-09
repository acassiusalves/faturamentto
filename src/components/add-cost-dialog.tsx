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
import { Switch } from "./ui/switch";

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
  value: z.coerce.number().positive({
    message: "O valor deve ser um número positivo.",
  }),
  category: z.enum(COST_CATEGORIES, {
    errorMap: () => ({ message: "Por favor, selecione uma categoria válida." }),
  }),
  isPercentage: z.boolean().default(false),
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
      value: 0,
      isPercentage: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!sale) return;
    const newCost: Cost = {
      id: `COST-${Date.now()}`,
      description: values.description,
      amount: values.value,
      category: values.category,
      isPercentage: values.isPercentage,
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
    <Dialog open={isOpen} onOpenChange={(open) => {
        if(!open) {
            form.reset();
        }
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Custo Manual</DialogTitle>
          <DialogDescription>
            Adicione um novo custo para a venda <span className="font-bold">#{(sale as any).order_code}</span>.
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
                        <FormLabel>É uma porcentagem?</FormLabel>
                        <p className="text-xs text-muted-foreground">
                            Ative se o custo for um percentual sobre o valor bruto da venda.
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
              <Button type="submit">Adicionar Custo</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

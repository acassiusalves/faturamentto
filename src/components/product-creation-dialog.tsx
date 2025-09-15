
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, ChevronsUpDown, Check, Hash } from 'lucide-react';
import type { Product, ProductCategorySettings, ProductAttribute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { saveProduct } from '@/services/firestore';
import { cn } from '@/lib/utils';
import { deburr } from 'lodash';
import { Card, CardContent } from '@/components/ui/card';

interface ProductCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string | null;
  products: Product[];
  settings: ProductCategorySettings;
  onProductCreated: (newProduct: Product) => void;
}

const productSchema = z.object({
  name: z.string(),
  sku: z.string(),
});

const attributeOrder: string[] = ['marca', 'modelo', 'armazenamento', 'memoria', 'cor', 'rede'];

export function ProductCreationDialog({ isOpen, onClose, productName, products, settings, onProductCreated }: ProductCreationDialogProps) {
  const { toast } = useToast();
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const form = useForm<Record<string, string>>({
    defaultValues: {},
  });
  const { control, watch, handleSubmit, reset, setValue, formState: { isSubmitting } } = form;
  const formValues = watch();

  const orderedAttributes = useMemo(() => {
    return attributeOrder
      .map(key => settings.attributes.find(attr => attr.key === key))
      .filter((attr): attr is ProductAttribute => !!attr);
  }, [settings]);

  // Pre-fill form when productName changes
  useEffect(() => {
    if (productName && settings) {
      const initialFormState: Record<string, string> = {};
      const lowerProductName = productName.toLowerCase();
      
      orderedAttributes.forEach(attr => {
        let foundValue = '';
        for (const val of attr.values) {
          if (lowerProductName.includes(val.toLowerCase())) {
            foundValue = val;
            break;
          }
        }
        initialFormState[attr.key] = foundValue;
      });
      reset(initialFormState);
    } else {
      const initialFormState: Record<string, string> = {};
      orderedAttributes.forEach(attr => { initialFormState[attr.key] = ""; });
      reset(initialFormState);
    }
  }, [productName, settings, reset, orderedAttributes]);

  const generatedName = useMemo(() => {
    return orderedAttributes
      .map(attr => formValues[attr.key])
      .filter(Boolean)
      .join(" ");
  }, [formValues, orderedAttributes]);

  const canSubmit = useMemo(() => {
    const allRequiredFilled = orderedAttributes.every(attr => !!formValues[attr.key]);
    return allRequiredFilled && generatedName.length > 0;
  }, [formValues, generatedName, orderedAttributes]);

  const generatedSku = useMemo(() => {
    if (!canSubmit) return "";
    
    const baseName = orderedAttributes
      .filter(attr => attr.key !== 'cor')
      .map(attr => formValues[attr.key])
      .filter(Boolean)
      .join(" ");

    const existingProductWithSameBase = products.find(p => {
        const pBaseName = attributeOrder
            .filter(key => key !== 'cor')
            .map(key => p.attributes[key])
            .filter(Boolean)
            .join(" ");
        return pBaseName === baseName;
    });

    let sequentialNumberPart: string;

    if (existingProductWithSameBase?.sku) {
        sequentialNumberPart = existingProductWithSameBase.sku.replace(/[^0-9]/g, '');
    } else {
        const maxSkuNum = products.reduce((max, p) => {
            if (!p.sku) return max;
            const num = parseInt(p.sku.replace(/[^0-9]/g, ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        sequentialNumberPart = (maxSkuNum + 1).toString();
    }
    
    const color = formValues['cor'] || '';
    const colorCode = color.length > 2 && color.includes(' ') 
      ? color.split(' ').map(w => w.charAt(0)).join('').toUpperCase() 
      : color.charAt(0).toUpperCase();

    return `#${sequentialNumberPart}${colorCode}`;
  }, [products, formValues, canSubmit, orderedAttributes]);


  const onSubmit = async (data: Record<string, string>) => {
    if (!canSubmit || !generatedSku) return;
    if (products.some(p => p.name.toLowerCase() === generatedName.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Produto Duplicado', description: `Um produto com o nome "${generatedName}" já existe.` });
      return;
    }
    if (products.some(p => p.sku === generatedSku)) {
      toast({ variant: 'destructive', title: 'SKU Duplicado', description: `O SKU "${generatedSku}" já está sendo usado.` });
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      category: 'Celular',
      name: generatedName,
      sku: generatedSku,
      attributes: data,
      createdAt: new Date().toISOString(),
      associatedSkus: [],
    };

    try {
      await saveProduct(newProduct);
      onProductCreated(newProduct);
      toast({ title: "Produto Criado!", description: `O modelo "${generatedName}" foi salvo com sucesso.` });
      onClose();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o modelo do produto.' });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar Novo Modelo de Produto</DialogTitle>
          <DialogDescription>
            Atributos preenchidos a partir de: <span className="font-semibold text-primary">{productName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card className="border-none shadow-none">
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orderedAttributes.map(attr => (
                    <FormField
                      key={attr.key}
                      control={control}
                      name={attr.key}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{attr.label}</FormLabel>
                          {attr.key === 'modelo' ? (
                            <Popover open={openPopovers[attr.key]} onOpenChange={(isOpen) => setOpenPopovers(prev => ({...prev, [attr.key]: isOpen}))}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                                  >
                                    {field.value ? field.value : `Selecione ${attr.label.toLowerCase()}...`}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput placeholder={`Buscar ${attr.label.toLowerCase()}...`} />
                                  <CommandList>
                                    <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {attr.values.map(val => (
                                        <CommandItem
                                          key={val}
                                          value={val}
                                          onSelect={() => {
                                            field.onChange(val);
                                            setOpenPopovers(prev => ({...prev, [attr.key]: false}));
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", field.value === val ? "opacity-100" : "opacity-0")} />
                                          {val}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={`Selecione ${attr.label.toLowerCase()}...`} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {attr.values.map(val => (
                                  <SelectItem key={val} value={val}>{val}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2 col-span-2">
                      <Label className="text-muted-foreground">Nome Gerado</Label>
                      <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                        <span className={generatedName ? "text-primary font-semibold" : "text-muted-foreground"}>
                          {generatedName || "Selecione as opções acima..."}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> SKU Gerado</Label>
                      <div className="w-full min-h-[40px] px-3 py-2 rounded-md border border-dashed flex items-center">
                        <span className={generatedSku ? "text-accent font-semibold" : "text-muted-foreground"}>
                          {generatedSku || "Selecione as opções..."}
                        </span>
                      </div>
                    </div>
                </div>
              </CardContent>
            </Card>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || !canSubmit}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                    Criar Modelo de Produto
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

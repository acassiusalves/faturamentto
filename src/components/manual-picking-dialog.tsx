"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { PickedItemLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';


const manualLogSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório."),
  sku: z.string().min(1, "SKU é obrigatório."),
  serialNumber: z.string().min(1, "Número de série é obrigatório."),
  costPrice: z.coerce.number().min(0, "Custo deve ser um valor positivo."),
  orderNumber: z.string().min(1, "Número do pedido é obrigatório."),
  createdAt: z.date({ required_error: "Data de entrada é obrigatória." }),
  pickedAtDate: z.date({ required_error: "Data de saída é obrigatória." }),
  pickedAtTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM).")
});

type ManualLogFormValues = z.infer<typeof manualLogSchema>;

interface ManualPickingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<PickedItemLog, 'logId' | 'productId' | 'gtin' | 'origin' | 'quantity' | 'id' | 'createdAt' >) => Promise<void>;
}

export function ManualPickingDialog({ isOpen, onClose, onSave }: ManualPickingDialogProps) {
    const form = useForm<ManualLogFormValues>({
        resolver: zodResolver(manualLogSchema),
        defaultValues: {
            name: "",
            sku: "",
            serialNumber: "",
            costPrice: 0,
            orderNumber: "",
            pickedAtTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
    });
    
    const { formState: { isSubmitting } } = form;

    const handleSubmit = async (data: ManualLogFormValues) => {
        const [hours, minutes] = data.pickedAtTime.split(':').map(Number);
        const pickedAt = new Date(data.pickedAtDate);
        pickedAt.setHours(hours, minutes);

        const saveData = {
            name: data.name,
            sku: data.sku,
            serialNumber: data.serialNumber,
            costPrice: data.costPrice,
            orderNumber: data.orderNumber,
            createdAt: data.createdAt.toISOString(),
            pickedAt: pickedAt.toISOString(),
            attributes: {}, // Manual entry won't have detailed attributes
        };
        
        await onSave(saveData as any);
        form.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                form.reset();
            }
            onClose();
        }}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Adicionar Registro de Picking Manual</DialogTitle>
                    <DialogDescription>
                        Insira os detalhes do item que saiu do estoque. Este registro será adicionado ao arquivo.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Produto</FormLabel>
                                    <FormControl><Input placeholder="Ex: Xiaomi Poco C75" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="sku" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU</FormLabel>
                                    <FormControl><Input placeholder="Ex: #01P" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <FormField control={form.control} name="serialNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nº de Série (SN)</FormLabel>
                                    <FormControl><Input placeholder="SN do item" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="costPrice" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Custo (R$)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="Ex: 700.00" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="orderNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Número do Pedido</FormLabel>
                                <FormControl><Input placeholder="Nº do pedido de venda" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="createdAt" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Data de Entrada</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-2 gap-4 items-end">
                             <FormField control={form.control} name="pickedAtDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Data de Saída</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="pickedAtTime" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hora da Saída</FormLabel>
                                    <FormControl><Input placeholder="HH:MM" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
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


"use client";

import { useState } from 'react';
import type { Sale } from '@/lib/types';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Ticket, FileText, Package, User, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

interface TicketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Sale | null;
}

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
};

const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


export function TicketDialog({ isOpen, onClose, order }: TicketDialogProps) {
    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket />
                        Detalhes do Pedido: {(order as any).order_code}
                    </DialogTitle>
                    <DialogDescription>Visualize todos os detalhes da venda selecionada.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><FileText/> Detalhes da Venda</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                <div className="flex justify-between"><span>ID:</span> <span className="font-semibold">{(order as any).order_id}</span></div>
                                <div className="flex justify-between"><span>Código:</span> <span className="font-mono">{(order as any).order_code}</span></div>
                                <div className="flex justify-between items-center"><span>Marketplace:</span> <Badge variant="secondary">{(order as any).marketplace_name}</Badge></div>
                                <div className="flex justify-between items-center"><span>Conta:</span> <Badge variant="outline">{(order as any).auth_name}</Badge></div>
                                <div className="flex justify-between items-center"><span>Status:</span> <Badge>{(order as any).status}</Badge></div>
                                <div className="flex justify-between"><span>Data Venda:</span> <span className="font-semibold">{formatDate((order as any).payment_approved_date)}</span></div>
                                <div className="flex justify-between"><span>Valor Pago:</span> <span className="font-bold text-primary">{formatCurrency((order as any).paid_amount)}</span></div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><Package/> Produto Vendido</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                <p className="font-semibold leading-tight">{(order as any).item_title}</p>
                                <div className="flex justify-between"><span>SKU:</span> <span className="font-mono">{(order as any).item_sku}</span></div>
                                <div className="flex justify-between"><span>Qtd:</span> <span className="font-semibold">{(order as any).item_quantity}</span></div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-1">
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><User/> Cliente</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                 <div className="flex justify-between items-start gap-2">
                                    <span>Nome:</span> 
                                    <span className="font-semibold text-right">{(order as any).customer_name} {(order as any).customerLastName}</span>
                                </div>
                                <div className="flex justify-between"><span>Doc:</span> <span className="font-semibold">{(order as any).document_value}</span></div>
                                <div className="flex justify-between items-start gap-2">
                                    <span className="whitespace-nowrap flex items-center gap-1.5"><MapPin className="h-3 w-3"/> Ender:</span> 
                                    <span className="font-semibold text-right">
                                        {(order as any).address_line}, {(order as any).address_district} - {(order as any).address_city}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


"use client";

import { useState, useEffect } from 'react';
import type { Sale } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Ticket, FileText, Package, User, MapPin, CalendarClock, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

interface TicketTabProps {
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


export function TicketTab({ order }: TicketTabProps) {
    const [isLoading, setIsLoading] = useState(false);

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border rounded-lg bg-card">
                 <Ticket className="h-12 w-12 mb-4" />
                 <p className="font-semibold">Nenhum pedido selecionado.</p>
                 <p className="text-sm">Vá para a aba "Acompanhamento" e clique em "Abrir Ticket" em um pedido.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Ticket />
                        Abrindo Ticket para o Pedido: {(order as any).order_code}
                    </CardTitle>
                    <CardDescription>Crie um novo ticket de atendimento para resolver o problema do cliente.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText/> Detalhes da Venda</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between"><span>ID do Pedido:</span> <span className="font-semibold">{(order as any).order_id}</span></div>
                                <div className="flex justify-between"><span>Código:</span> <span className="font-mono">{(order as any).order_code}</span></div>
                                <div className="flex justify-between"><span>Data da Venda:</span> <span className="font-semibold">{formatDate((order as any).payment_approved_date)}</span></div>
                                <div className="flex justify-between items-center"><span>Marketplace:</span> <Badge variant="secondary">{(order as any).marketplace_name}</Badge></div>
                                <div className="flex justify-between items-center"><span>Conta:</span> <Badge variant="outline">{(order as any).auth_name}</Badge></div>
                                <div className="flex justify-between items-center"><span>Status:</span> <Badge>{(order as any).status}</Badge></div>
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4"/> Data de Envio:</span> 
                                    <span className="font-semibold">{formatDate((order as any).sent_date)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="flex items-center gap-1.5"><Truck className="h-4 w-4"/> Rastreio:</span> 
                                    <span className="font-mono">{(order as any).deliveryTrackingCode || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between"><span>Valor Pago:</span> <span className="font-bold text-primary">{formatCurrency((order as any).paid_amount)}</span></div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Package/> Produto Vendido</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <p className="font-semibold text-base leading-tight">{(order as any).item_title}</p>
                                <div className="flex justify-between"><span>SKU:</span> <span className="font-mono">{(order as any).item_sku}</span></div>
                                <div className="flex justify-between"><span>Quantidade:</span> <span className="font-semibold">{(order as any).item_quantity}</span></div>
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><User/> Cliente e Entrega</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between items-start gap-2">
                                    <span>Nome:</span> 
                                    <span className="font-semibold text-right">{(order as any).customer_name} {(order as any).customerLastName}</span>
                                </div>
                                <div className="flex justify-between"><span>Documento:</span> <span className="font-semibold">{(order as any).document_value}</span></div>
                                <div className="flex justify-between items-start gap-2">
                                    <span className="whitespace-nowrap flex items-center gap-1.5"><MapPin className="h-4 w-4"/> Endereço:</span> 
                                    <span className="font-semibold text-right">
                                        {(order as any).address_line}, {(order as any).address_district} - {(order as any).address_city}, {(order as any).state_name} - CEP: {(order as any).address_zip_code}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                     
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados do Atendimento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                    <Label htmlFor="devolucao-status">Status da devolução</Label>
                                     <Select>
                                        <SelectTrigger id="devolucao-status">
                                            <SelectValue placeholder="Selecione um status..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="aguardando-envio">Aguardando envio do cliente</SelectItem>
                                            <SelectItem value="em-transito">Em trânsito para o centro</SelectItem>
                                            <SelectItem value="recebido">Recebido</SelectItem>
                                            <SelectItem value="em-analise">Em análise</SelectItem>
                                            <SelectItem value="finalizado">Finalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                               </div>
                                <div className="space-y-2">
                                    <Label htmlFor="chamado">Chamado</Label>
                                    <Input id="chamado" placeholder="Insira o nº do chamado" />
                               </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="observacoes">Observações</Label>
                                <Textarea id="observacoes" placeholder="Adicione notas sobre o atendimento..." rows={4} />
                            </div>
                            <div className="flex justify-end">
                                <Button disabled>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Criar Ticket
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </CardContent>
            </Card>
        </div>
    );
}

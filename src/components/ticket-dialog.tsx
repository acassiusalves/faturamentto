
"use client";

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Package, FileText, Banknote, Truck, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm py-2 border-b">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-right">{value}</span>
    </div>
);

export function TicketDialog({ isOpen, onClose, order }: TicketDialogProps) {
    if (!order) return null;

    const saleData = order as any;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Detalhes do Pedido: #{saleData.order_id}</DialogTitle>
                    <DialogDescription>
                        Exibindo todas as informações detalhadas para o pedido da loja <span className="font-semibold">{saleData.order_code}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-6">
                            <TabsTrigger value="general">Geral</TabsTrigger>
                            <TabsTrigger value="client">Cliente</TabsTrigger>
                            <TabsTrigger value="items">Itens</TabsTrigger>
                            <TabsTrigger value="financial">Financeiro</TabsTrigger>
                            <TabsTrigger value="transport">Transporte</TabsTrigger>
                            <TabsTrigger value="notes">Observações</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="mt-4">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><FileText size={18}/> Informações Gerais</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
                                     <DetailItem label="Nº Pedido Loja" value={saleData.order_code} />
                                     <DetailItem label="Data do Pedido" value={formatDate(saleData.payment_approved_date)} />
                                     <DetailItem label="Data Prevista" value="N/A" />
                                     <DetailItem label="Data da Saída" value={formatDate(saleData.sent_date)} />
                                     <DetailItem label="ID Nota Fiscal" value={saleData.invoiceNumber || 'N/A'} />
                                     <DetailItem label="Status" value={<Badge>{saleData.status}</Badge>} />
                                     <DetailItem label="Vendedor" value={saleData.auth_name} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="client">
                             <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><User size={18}/> Informações do Cliente</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
                                     <DetailItem label="Nome" value={`${saleData.customer_name} ${saleData.customerLastName}`} />
                                     <DetailItem label="Email" value={saleData.customerEmail} />
                                     <DetailItem label="Documento" value={`${saleData.documentType}: ${saleData.document_value}`} />
                                     <DetailItem label="Telefone" value={`(${saleData.phoneAreaCode}) ${saleData.phoneNumber}`} />
                                     <DetailItem label="Endereço" value={`${saleData.addressStreet}, ${saleData.addressNumber} - ${saleData.address_district}`} />
                                     <DetailItem label="Cidade/Estado" value={`${saleData.address_city} - ${saleData.stateAbbreviation}`} />
                                     <DetailItem label="CEP" value={saleData.address_zip_code} />
                                     <DetailItem label="País" value={saleData.countryName} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                         <TabsContent value="items">
                             <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Package size={18}/> Itens do Pedido</CardTitle></CardHeader>
                                <CardContent>
                                    <DetailItem label="Produto" value={saleData.item_title} />
                                    <DetailItem label="SKU" value={<span className="font-mono">{saleData.item_sku}</span>} />
                                    <DetailItem label="Quantidade" value={saleData.item_quantity} />
                                    <DetailItem label="Valor Unitário" value={formatCurrency(saleData.paid_amount / saleData.item_quantity)} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                         <TabsContent value="financial">
                             <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Banknote size={18}/> Informações Financeiras</CardTitle></CardHeader>
                                <CardContent>
                                     <DetailItem label="Valor Pago" value={formatCurrency(saleData.paid_amount)} />
                                     <DetailItem label="Desconto" value={formatCurrency(saleData.discount)} />
                                     <DetailItem label="Comissão" value={formatCurrency(saleData.fee_order)} />
                                     <DetailItem label="Valor Líquido" value={formatCurrency(saleData.net_amount)} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="transport">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Truck size={18}/> Informações de Transporte</CardTitle></CardHeader>
                                <CardContent>
                                    <DetailItem label="Custo do Envio" value={formatCurrency(saleData.fee_shipment)} />
                                    <DetailItem label="Código de Rastreio" value={<span className="font-mono">{saleData.deliveryTrackingCode || 'N/A'}</span>} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare size={18}/> Observações</CardTitle></CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{saleData.addressComment || 'Nenhuma observação no pedido.'}</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

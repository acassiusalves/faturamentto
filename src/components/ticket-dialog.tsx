

"use client";

import { useState, useEffect } from 'react';
import type { Sale, CustomCalculation } from '@/lib/types';
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
import { User, Package, FileText, Banknote, Truck, MessageSquare, FileSpreadsheet, Save, Loader2, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';


interface TicketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Sale | null;
  onSaveChanges: (saleId: string, updatedData: Partial<Sale>) => void;
  customCalculations: CustomCalculation[];
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
    <div className="flex justify-between items-start text-sm py-2 border-b gap-4">
        <span className="text-muted-foreground capitalize">{label.replace(/_/g, ' ')}</span>
        <span className="font-semibold text-right">{value || 'N/A'}</span>
    </div>
);

export function TicketDialog({ isOpen, onClose, order, onSaveChanges, customCalculations }: TicketDialogProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("general");
    const [editedSheetData, setEditedSheetData] = useState<Record<string, any> | undefined>(undefined);
    const [editedCustomData, setEditedCustomData] = useState<Record<string, any> | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (order) {
            setEditedSheetData({ ...(order as any).sheetData });
            setEditedCustomData({ ...(order as any).customData });
            setActiveTab("general");
        }
    }, [order]);

    if (!order) return null;

    const saleData = order as any;
    const hasSheetData = saleData.sheetData && Object.keys(saleData.sheetData).length > 0;
    
    const handleSheetDataChange = (key: string, value: string) => {
        setEditedSheetData(prev => ({ ...prev, [key]: value }));
    };
    
    const handleCustomDataChange = (key: string, value: string) => {
        const numericValue = parseFloat(value.replace(',', '.'));
        setEditedCustomData(prev => ({ ...prev, [key]: isNaN(numericValue) ? value : numericValue }));
    };

    const handleSaveClick = async () => {
        setIsSaving(true);
        try {
            const updatedData: Partial<Sale> = {};
            if(JSON.stringify(editedSheetData) !== JSON.stringify(saleData.sheetData)) {
                updatedData.sheetData = editedSheetData;
            }
             if(JSON.stringify(editedCustomData) !== JSON.stringify(saleData.customData)) {
                updatedData.customData = editedCustomData;
            }
            await onSaveChanges(order.id, updatedData);
            toast({
                title: "Dados da Planilha Atualizados!",
                description: "As alterações foram salvas no pedido."
            });
            onClose();
        } catch (e) {
            toast({
                variant: 'destructive',
                title: "Erro ao Salvar",
                description: "Não foi possível salvar as alterações."
            })
        } finally {
            setIsSaving(false);
        }
    };
    
    const hasSheetChanges = JSON.stringify(editedSheetData) !== JSON.stringify(saleData.sheetData);
    const hasCustomChanges = JSON.stringify(editedCustomData) !== JSON.stringify(saleData.customData);
    const hasChanges = hasSheetChanges || hasCustomChanges;


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Detalhes do Pedido: #{saleData.order_id}</DialogTitle>
                    <DialogDescription>
                        Exibindo todas as informações detalhadas para o pedido da loja <span className="font-semibold">{saleData.order_code}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex-grow overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className={`grid w-full ${hasSheetData ? 'grid-cols-7' : 'grid-cols-6'}`}>
                            <TabsTrigger value="general">Geral</TabsTrigger>
                            <TabsTrigger value="client">Cliente</TabsTrigger>
                            <TabsTrigger value="items">Itens</TabsTrigger>
                            <TabsTrigger value="financial">Financeiro</TabsTrigger>
                             <TabsTrigger value="system">Sistema</TabsTrigger>
                            <TabsTrigger value="transport">Transporte</TabsTrigger>
                            <TabsTrigger value="notes">Observações</TabsTrigger>
                            {hasSheetData && <TabsTrigger value="sheet">Planilha</TabsTrigger>}
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
                        <TabsContent value="client" className="mt-4">
                             <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><User size={18}/> Informações do Cliente</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 gap-x-8">
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
                         <TabsContent value="items" className="mt-4">
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
                         <TabsContent value="financial" className="mt-4">
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
                         <TabsContent value="system" className="mt-4 flex-grow overflow-hidden">
                             <Card className="h-full flex flex-col">
                                <CardHeader><CardTitle className="flex items-center gap-2"><Calculator size={18}/> Dados do Sistema (Calculados)</CardTitle></CardHeader>
                                <CardContent className="flex-grow overflow-hidden">
                                    <ScrollArea className="h-full">
                                       <div className="space-y-4 pr-4">
                                            {customCalculations.map(calc => (
                                               <div key={calc.id} className="space-y-1">
                                                    <Label htmlFor={`custom-${calc.id}`} className="capitalize">{calc.name}</Label>
                                                    <Input
                                                        id={`custom-${calc.id}`}
                                                        value={editedCustomData?.[calc.id] ?? ''}
                                                        onChange={(e) => handleCustomDataChange(calc.id, e.target.value)}
                                                    />
                                               </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="transport" className="mt-4">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Truck size={18}/> Informações de Transporte</CardTitle></CardHeader>
                                <CardContent>
                                    <DetailItem label="Custo do Envio" value={formatCurrency(saleData.fee_shipment)} />
                                    <DetailItem label="Código de Rastreio" value={<span className="font-mono">{saleData.deliveryTrackingCode || 'N/A'}</span>} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="mt-4">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare size={18}/> Observações</CardTitle></CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{saleData.addressComment || 'Nenhuma observação no pedido.'}</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                         {hasSheetData && (
                            <TabsContent value="sheet" className="mt-4 flex-grow overflow-hidden">
                                <Card className="h-full flex flex-col">
                                    <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet size={18}/> Dados da Planilha</CardTitle></CardHeader>
                                    <CardContent className="flex-grow overflow-hidden">
                                         <ScrollArea className="h-full">
                                            <div className="space-y-4 pr-4">
                                                {Object.entries(editedSheetData || {}).map(([key, value]) => (
                                                   <div key={key} className="space-y-1">
                                                        <Label htmlFor={`sheet-${key}`} className="capitalize">{key.replace(/_/g, ' ')}</Label>
                                                        <Input
                                                            id={`sheet-${key}`}
                                                            value={value as string}
                                                            onChange={(e) => handleSheetDataChange(key, e.target.value)}
                                                        />
                                                   </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                     {(activeTab === 'sheet' || activeTab === 'system') && hasChanges && (
                        <Button onClick={handleSaveClick} disabled={isSaving}>
                            {isSaving && <Loader2 className="animate-spin mr-2" />}
                            <Save className="mr-2" />
                            Salvar Alterações
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

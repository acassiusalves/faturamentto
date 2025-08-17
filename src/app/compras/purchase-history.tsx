
"use client";

import { useState, useEffect, useCallback } from 'react';
import { loadPurchaseHistory, deletePurchaseList, updatePurchaseList } from '@/services/firestore';
import type { PurchaseList, PurchaseListItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, PackageSearch, Pencil, Trash2, Save, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';


export function PurchaseHistory() {
    const { toast } = useToast();
    const [history, setHistory] = useState<PurchaseList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<PurchaseListItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);


    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        const purchaseHistory = await loadPurchaseHistory();
        setHistory(purchaseHistory);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    const handleDelete = async (id: string) => {
        try {
            await deletePurchaseList(id);
            setHistory(prev => prev.filter(item => item.id !== id));
            toast({
                title: 'Lista Apagada!',
                description: 'A lista de compras foi removida do histórico.',
            });
        } catch (error) {
            console.error('Error deleting purchase list:', error);
            toast({
                variant: 'destructive',
                title: 'Erro ao Apagar',
                description: 'Não foi possível remover a lista de compras.',
            });
        }
    };
    
    const handleEditStart = (purchase: PurchaseList) => {
        setEditingId(purchase.id);
        setPendingItems([...purchase.items]); // Create a deep copy for editing
        // Expand the accordion item automatically
        if (!openAccordionItems.includes(purchase.id)) {
            setOpenAccordionItems(prev => [...prev, purchase.id]);
        }
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setPendingItems([]);
    };
    
    const handleCostChange = (sku: string, newCost: string) => {
        const numericCost = parseFloat(newCost);
        if (!isNaN(numericCost)) {
            setPendingItems(prev => 
                prev.map(item => item.sku === sku ? { ...item, unitCost: numericCost } : item)
            );
        }
    };

    const handleSaveChanges = async () => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            const newTotalCost = pendingItems.reduce((acc, item) => acc + (item.unitCost * item.quantity), 0);
            await updatePurchaseList(editingId, { items: pendingItems, totalCost: newTotalCost });
            
            // Update local state to reflect changes instantly
            setHistory(prev => prev.map(p => p.id === editingId ? { ...p, items: pendingItems, totalCost: newTotalCost } : p));
            
            toast({ title: 'Alterações Salvas', description: 'O custo da lista de compras foi atualizado.'});
            handleEditCancel();
        } catch(error) {
            console.error('Error saving changes:', error);
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar as alterações.' });
        } finally {
            setIsSaving(false);
        }
    };


    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string) => {
        return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="ml-4">Carregando histórico...</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    <div>
                        <CardTitle>Histórico de Listas de Compras</CardTitle>
                        <CardDescription>
                            Consulte todas as listas de compras que foram salvas no sistema.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {history.length > 0 ? (
                    <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-4">
                        {history.map(purchase => {
                            const isEditingThis = editingId === purchase.id;
                            const itemsToDisplay = isEditingThis ? pendingItems : purchase.items;
                            const currentTotal = itemsToDisplay.reduce((acc, item) => acc + item.unitCost * item.quantity, 0);

                            return (
                                <AccordionItem key={purchase.id} value={purchase.id} className="border rounded-lg">
                                    <div className="flex justify-between items-center w-full px-4 py-3">
                                        <AccordionTrigger className="p-0 hover:no-underline flex-1 text-left">
                                            <div className="flex flex-col">
                                                <span className="font-semibold">Compra de {formatDate(purchase.createdAt)}</span>
                                                <span className="text-sm text-muted-foreground">{purchase.items.length} produto(s) diferente(s)</span>
                                            </div>
                                        </AccordionTrigger>
                                        <div className="flex items-center gap-4 pl-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                {isEditingThis ? (
                                                    <>
                                                        <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isSaving}>
                                                            <XCircle className="mr-2" /> Cancelar
                                                        </Button>
                                                        <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                                                            {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                                            Salvar
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="destructive" size="sm"><Trash2 className="mr-2"/>Apagar</Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta ação não pode ser desfeita. A lista de compras será permanentemente apagada.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(purchase.id)}>Sim, Apagar</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <Button variant="outline" size="sm" onClick={() => handleEditStart(purchase)}>
                                                            <Pencil className="mr-2"/>
                                                            Editar Lista
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">Custo Total:</span>
                                                <Badge variant="default" className="text-base">{formatCurrency(currentTotal)}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="rounded-md border mt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Produto</TableHead>
                                                        <TableHead>SKU</TableHead>
                                                        <TableHead className="text-center">Quantidade</TableHead>
                                                        <TableHead className="text-right">Custo Unit.</TableHead>
                                                        <TableHead className="text-right">Custo Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {itemsToDisplay.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{item.productName}</TableCell>
                                                            <TableCell className="font-mono">{item.sku}</TableCell>
                                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                                            <TableCell className="text-right">
                                                                {isEditingThis ? (
                                                                    <Input
                                                                        type="number"
                                                                        defaultValue={item.unitCost}
                                                                        onChange={(e) => handleCostChange(item.sku, e.target.value)}
                                                                        className="w-28 ml-auto text-right"
                                                                    />
                                                                ) : (
                                                                    formatCurrency(item.unitCost)
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold">{formatCurrency(item.unitCost * item.quantity)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <PackageSearch className="mx-auto h-12 w-12 mb-4" />
                        <p>Nenhuma lista de compra salva no histórico.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

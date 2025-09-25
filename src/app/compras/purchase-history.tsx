

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadPurchaseHistory, deletePurchaseList, updatePurchaseList, loadAppSettings, loadEntryLogsByDateFromPermanentLog } from '@/services/firestore';
import type { PurchaseList, PurchaseListItem, InventoryItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History, PackageSearch, Pencil, Trash2, Save, XCircle, Wallet, SplitSquareHorizontal, Check, ShieldAlert, Package, PackageCheck } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';


// Add a temporary `isSplit` property to our item type for highlighting
type EditablePurchaseListItem = PurchaseListItem & { tempId: string; isSplit?: boolean };

// Helper para agrupar as compras por data (string 'yyyy-MM-dd')
const groupPurchasesByDay = (purchases: PurchaseList[]) => {
    const grouped = new Map<string, PurchaseList[]>();
    purchases.forEach(p => {
        const dateKey = format(new Date(p.createdAt), 'yyyy-MM-dd');
        if (!grouped.has(dateKey)) {
            grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(p);
    });
    return Array.from(grouped.entries());
};


export function PurchaseHistory() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [history, setHistory] = useState<PurchaseList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<EditablePurchaseListItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
    const [availableStores, setAvailableStores] = useState<string[]>([]);
    const [entryLogsByDate, setEntryLogsByDate] = useState<Map<string, InventoryItem[]>>(new Map());


    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        const [purchaseHistory, settings] = await Promise.all([
            loadPurchaseHistory(),
            loadAppSettings()
        ]);

        const uniqueDates = Array.from(new Set(purchaseHistory.map(p => format(new Date(p.createdAt), 'yyyy-MM-dd'))));
        const entryLogsMap = new Map<string, InventoryItem[]>();
        
        const norm = (v: any) => String(v ?? '').trim().toLowerCase();

        for (const dateKey of uniqueDates) {
            const [y, m, d] = dateKey.split('-').map(n => parseInt(n, 10));
            const midLocal = new Date(y, (m - 1), d, 12, 0, 0);

            const logs = await loadEntryLogsByDateFromPermanentLog(midLocal);
            
            const cellularLogs = logs.filter((log: any) => {
                const cat  = norm(log.category ?? 'Celular');
                const cond = norm(log.condition);
                return cat === 'celular' && cond === 'novo';
            });
            entryLogsMap.set(dateKey, cellularLogs);
        }

        setEntryLogsByDate(entryLogsMap);
        setHistory(purchaseHistory);
        if (settings?.stores) {
            setAvailableStores(settings.stores);
        }
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
                description: 'Não foi possível remover la lista de compras.',
            });
        }
    };
    
    const handleEditStart = (purchase: PurchaseList) => {
        setEditingId(purchase.id);
        const itemsWithTempIds: EditablePurchaseListItem[] = purchase.items.map((item, index) => ({
             ...item,
             tempId: `${item.sku}-${index}-${Date.now()}` 
        }));
        setPendingItems(itemsWithTempIds);
        if (!openAccordionItems.includes(purchase.id)) {
            setOpenAccordionItems(prev => [...prev, purchase.id]);
        }
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setPendingItems([]);
    };
    
    const handleItemChange = (tempId: string, field: 'unitCost' | 'storeName' | 'isPaid' | 'surplus' | 'quantity', value: string | boolean | number) => {
        setPendingItems(prev =>
            prev.map(item => {
                if (item.tempId === tempId) {
                     let updatedItem = { ...item };
                    if (field === 'unitCost') {
                        const numericCost = parseFloat(value as string);
                        updatedItem.unitCost = isNaN(numericCost) ? item.unitCost : numericCost;
                    } else if (field === 'surplus') {
                        const numericSurplus = parseInt(value as string, 10);
                        updatedItem.surplus = isNaN(numericSurplus) || numericSurplus < 0 ? 0 : numericSurplus;
                    } else if (field === 'quantity') {
                         const numericQuantity = parseInt(value as string, 10);
                         updatedItem.quantity = isNaN(numericQuantity) || numericQuantity < 1 ? 1 : numericQuantity;
                    } else if (field === 'isPaid') {
                        updatedItem.isPaid = value as boolean;
                    } else {
                        (updatedItem as any)[field] = value;
                    }
                    return updatedItem;
                }
                return item;
            })
        );
    };

    const handleSplitItem = (tempIdToSplit: string) => {
        setPendingItems(prev => {
            const itemIndex = prev.findIndex(item => item.tempId === tempIdToSplit);
            if (itemIndex === -1) return prev;

            const itemToSplit = prev[itemIndex];
            if (itemToSplit.quantity <= 1) return prev;

            const clearedItems = prev.map(it => ({ ...it, isSplit: false }));

            const newItem: EditablePurchaseListItem = {
                ...itemToSplit,
                quantity: 1,
                surplus: 0,
                isSplit: true,
                tempId: `${itemToSplit.sku}-${clearedItems.length}-${Date.now()}`
            };
            
            const updatedOriginalItem: EditablePurchaseListItem = {
                ...itemToSplit,
                quantity: itemToSplit.quantity - 1,
                isSplit: true, 
            };

            clearedItems[itemIndex] = updatedOriginalItem;
            clearedItems.splice(itemIndex + 1, 0, newItem);
            
            return clearedItems;
        });
         toast({
            title: "Item Dividido",
            description: "Uma nova linha foi criada. Ajuste os custos e lojas conforme necessário.",
        });
    }

    const handleRemoveItem = (tempIdToRemove: string) => {
        setPendingItems(prev => prev.filter(item => item.tempId !== tempIdToRemove));
        toast({
            variant: "default",
            title: "Item Removido",
            description: "O item foi removido da lista. Clique em Salvar para confirmar.",
        });
    };
    
    const handleItemPaidChange = async (purchaseId: string, sku: string, isPaid: boolean) => {
        const purchaseToUpdate = history.find(p => p.id === purchaseId);
        if (!purchaseToUpdate) return;

        const updatedItems = purchaseToUpdate.items.map(item => 
            item.sku === sku ? { ...item, isPaid } : item
        );

        try {
            await updatePurchaseList(purchaseId, { items: updatedItems });
            setHistory(prev => prev.map(p => p.id === purchaseId ? { ...p, items: updatedItems } : p));
             toast({
                title: `Pagamento ${isPaid ? 'Confirmado' : 'Desmarcado'}`,
                description: `O status de pagamento para o SKU ${sku} foi atualizado.`
            });
        } catch (error) {
            console.error('Error updating payment status:', error);
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar o status de pagamento.' });
        }
    }


    const handleSaveChanges = async () => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            const itemsToSave = pendingItems.map(({ tempId, isSplit, ...rest }) => rest);
            const newTotalCost = itemsToSave.reduce((acc, item) => {
                const q = (item.quantity || 0) + (item.surplus || 0);
                return acc + (item.unitCost * q);
            }, 0);
            await updatePurchaseList(editingId, { items: itemsToSave, totalCost: newTotalCost });
            
            setHistory(prev => prev.map(p => p.id === editingId ? { ...p, items: itemsToSave, totalCost: newTotalCost } : p));
            
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

    const getLogQty = (log: any) => Number(log?.quantity) || 1;
    
    const groupedHistory = useMemo(() => groupPurchasesByDay(history), [history]);

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
                            Consulte todas as listas de compras que foram salvas no sistema, agrupadas por dia.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {history.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {groupedHistory.map(([dateKey, purchases]) => {
                            const totalDayPurchases = purchases.reduce((sum, p) => sum + p.items.reduce((itemSum, i) => itemSum + ((i.quantity || 0) + (i.surplus || 0)), 0), 0);
                            const totalDayEntries = (entryLogsByDate.get(dateKey) ?? []).reduce((sum, log) => sum + getLogQty(log), 0);
                            const totalDayCost = purchases.reduce((sum, p) => sum + p.totalCost, 0);

                            return (
                                <AccordionItem key={dateKey} value={dateKey} className="border rounded-lg bg-muted/20">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline font-semibold">
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex flex-col text-left">
                                                <span className="text-lg">Compras de {format(new Date(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                                                <span className="text-sm font-normal text-muted-foreground">{purchases.length} lista(s) neste dia</span>
                                            </div>
                                             <div className="flex items-center gap-6 text-sm text-right">
                                                <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Total Comprado</span>
                                                    <Badge variant="secondary">{totalDayPurchases} unidades</Badge>
                                                </div>
                                                 <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Total Entradas</span>
                                                    <Badge variant={totalDayEntries === totalDayPurchases ? 'default' : 'destructive'} className={cn(totalDayEntries === totalDayPurchases && 'bg-green-600')}>{totalDayEntries} unidades</Badge>
                                                </div>
                                                 <div className="flex flex-col">
                                                    <span className="text-muted-foreground">Custo Total do Dia</span>
                                                    <Badge variant="default" className="text-base">{formatCurrency(totalDayCost)}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 space-y-4">
                                        {purchases.map(purchase => {
                                            const isEditingThis = editingId === purchase.id;
                                            const itemsToDisplay = isEditingThis ? pendingItems : purchase.items;
                                            const currentTotal = itemsToDisplay.reduce((acc, item) => {
                                                const q = (item.quantity || 0) + (item.surplus || 0);
                                                return acc + (item.unitCost * q);
                                            }, 0);
                                            const areAllItemsPaid = itemsToDisplay.every(item => item.isPaid);

                                            return (
                                                <Accordion key={purchase.id} type="single" collapsible className="w-full">
                                                    <AccordionItem value={purchase.id} className="border rounded-lg bg-background">
                                                        <div className="flex justify-between items-center w-full px-4 py-3">
                                                            <AccordionTrigger className="p-0 hover:no-underline flex-1 text-left">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold">Compra de {formatDate(purchase.createdAt)}</span>
                                                                    <span className="text-sm text-muted-foreground">{purchase.items.length} produto(s) diferente(s)</span>
                                                                </div>
                                                            </AccordionTrigger>
                                                            <div className="flex items-center gap-4 pl-4" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center gap-2">
                                                                    <Wallet className={cn("h-6 w-6 text-muted-foreground", areAllItemsPaid && "text-green-600")} />
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
                                                                    <span className="text-muted-foreground">Custo:</span>
                                                                    <Badge variant="default" className="text-sm">{formatCurrency(currentTotal)}</Badge>
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
                                                                            <TableHead>Loja</TableHead>
                                                                            <TableHead className="text-center">Quantidade</TableHead>
                                                                            <TableHead className="text-center">Excedente</TableHead>
                                                                            <TableHead className="text-right">Custo Unit.</TableHead>
                                                                            <TableHead className="text-right">Custo Total</TableHead>
                                                                            <TableHead className="text-center">Pago</TableHead>
                                                                            {isEditingThis && <TableHead className="text-center">Ações</TableHead>}
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {itemsToDisplay.map((item) => (
                                                                            <TableRow key={item.tempId || item.sku} className={cn(item.isSplit && 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500')}>
                                                                                <TableCell>{item.productName}</TableCell>
                                                                                <TableCell className="font-mono">{item.sku}</TableCell>
                                                                                <TableCell>
                                                                                    {isEditingThis ? (
                                                                                        <Select 
                                                                                            onValueChange={(value) => handleItemChange(item.tempId, 'storeName', value)} 
                                                                                            value={item.storeName}
                                                                                        >
                                                                                            <SelectTrigger className="w-32">
                                                                                                <SelectValue placeholder="Selecione..." />
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                {availableStores.map(store => (
                                                                                                    <SelectItem key={store} value={store}>{store}</SelectItem>
                                                                                                ))}
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    ) : (
                                                                                        item.storeName || 'N/A'
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-center">
                                                                                    {isEditingThis ? (
                                                                                        <Input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            value={item.quantity}
                                                                                            onChange={(e) => handleItemChange(item.tempId, 'quantity', e.target.value)}
                                                                                            className="w-16 text-center"
                                                                                        />
                                                                                    ) : (
                                                                                        item.quantity
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-center">
                                                                                    {isEditingThis ? (
                                                                                        <Input
                                                                                            type="number"
                                                                                            defaultValue={item.surplus}
                                                                                            onChange={(e) => handleItemChange(item.tempId, 'surplus', e.target.value)}
                                                                                            className="w-20"
                                                                                        />
                                                                                    ) : (
                                                                                        item.surplus || 0
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                    {isEditingThis ? (
                                                                                        <Input
                                                                                            type="number"
                                                                                            defaultValue={item.unitCost}
                                                                                            onChange={(e) => handleItemChange(item.tempId, 'unitCost', e.target.value)}
                                                                                            className="w-28 ml-auto text-right"
                                                                                        />
                                                                                    ) : (
                                                                                        formatCurrency(item.unitCost)
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-right font-semibold">{formatCurrency(item.unitCost * ((item.quantity || 0) + (item.surplus || 0)))}</TableCell>
                                                                                <TableCell className="text-center">
                                                                                    {(user?.role === 'admin' || user?.role === 'socio' || user?.role === 'financeiro') ? (
                                                                                        <Switch
                                                                                            checked={item.isPaid}
                                                                                            onCheckedChange={(checked) => isEditingThis ? handleItemChange(item.tempId, 'isPaid', checked) : handleItemPaidChange(purchase.id, item.sku, checked)}
                                                                                        />
                                                                                    ) : (
                                                                                        <Badge variant={item.isPaid ? 'default' : 'secondary'} className={cn(item.isPaid && 'bg-green-600')}>
                                                                                            {item.isPaid ? 'Sim' : 'Não'}
                                                                                        </Badge>
                                                                                    )}
                                                                                </TableCell>
                                                                                {isEditingThis && (
                                                                                    <TableCell className="text-center">
                                                                                        <Button 
                                                                                            variant="ghost" 
                                                                                            size="icon" 
                                                                                            onClick={() => handleSplitItem(item.tempId)} 
                                                                                            disabled={item.quantity <= 1}
                                                                                            title="Dividir este item em duas linhas"
                                                                                        >
                                                                                            <SplitSquareHorizontal className="h-4 w-4" />
                                                                                        </Button>
                                                                                        <AlertDialog>
                                                                                            <AlertDialogTrigger asChild>
                                                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                                                                    <XCircle className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </AlertDialogTrigger>
                                                                                            <AlertDialogContent>
                                                                                                <AlertDialogHeader>
                                                                                                    <AlertDialogTitle>Remover este item?</AlertDialogTitle>
                                                                                                    <AlertDialogDescription>
                                                                                                        Esta ação removerá o item "{item.productName}" desta lista de compras. A ação será permanente após salvar.
                                                                                                    </AlertDialogDescription>
                                                                                                </AlertDialogHeader>
                                                                                                <AlertDialogFooter>
                                                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                                    <AlertDialogAction onClick={() => handleRemoveItem(item.tempId)}>Sim, Remover</AlertDialogAction>
                                                                                                </AlertDialogFooter>
                                                                                            </AlertDialogContent>
                                                                                        </AlertDialog>
                                                                                    </TableCell>
                                                                                )}
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>
                                            )
                                        })}
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                            );
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

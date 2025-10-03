
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { findInventoryItemBySN, deleteInventoryItem } from '@/services/firestore';
import type { InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ScanLine, Trash2, Package, Save, ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function RetiradasFullPage() {
    const { toast } = useToast();
    const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
    const [currentSN, setCurrentSN] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const snInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        snInputRef.current?.focus();
    }, []);

    const handleAddItem = async () => {
        if (!currentSN.trim()) return;
        
        setIsSearching(true);
        const snToAdd = currentSN.trim();

        if (scannedItems.some(item => item.serialNumber === snToAdd)) {
            toast({ variant: 'destructive', title: 'Item já adicionado', description: 'Este SN já está na lista de retirada.' });
            setIsSearching(false);
            setCurrentSN('');
            return;
        }

        try {
            const item = await findInventoryItemBySN(snToAdd);
            if (item) {
                setScannedItems(prev => [item, ...prev]);
                toast({ title: 'Item Adicionado!', description: `${item.name} adicionado à remessa.` });
            } else {
                toast({ variant: 'destructive', title: 'Item não encontrado', description: 'Nenhum item com este SN foi encontrado no estoque.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao buscar', description: 'Não foi possível buscar o item no estoque.' });
        } finally {
            setIsSearching(false);
            setCurrentSN('');
            snInputRef.current?.focus();
        }
    };

    const handleSNKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        }
    };

    const handleRemoveItem = (itemId: string) => {
        setScannedItems(prev => prev.filter(item => item.id !== itemId));
    };

    const handleSaveBatch = async () => {
        if (scannedItems.length === 0) {
            toast({ variant: 'destructive', title: 'Lista vazia', description: 'Adicione itens antes de salvar.' });
            return;
        }

        setIsSaving(true);
        try {
            const deletePromises = scannedItems.map(item => deleteInventoryItem(item.id));
            await Promise.all(deletePromises);
            
            // Aqui você pode adicionar a lógica para salvar um log da remessa, se necessário
            
            toast({
                title: 'Remessa Salva!',
                description: `${scannedItems.length} itens foram removidos do estoque e registrados como enviados para o Full.`,
            });
            setScannedItems([]);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Não foi possível dar baixa nos itens do estoque.' });
        } finally {
            setIsSaving(false);
        }
    };

    const totalCost = useMemo(() => {
        return scannedItems.reduce((acc, item) => acc + (item.costPrice * item.quantity), 0);
    }, [scannedItems]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
             <Link href="/estoque" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit mb-0">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Estoque
            </Link>
            <div>
                <h1 className="text-3xl font-bold font-headline">Registrar Retirada para o Full</h1>
                <p className="text-muted-foreground">Bipe os produtos para adicioná-los à remessa de envio para o Fulfillment.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 items-start">
                <Card className="md:col-span-1 sticky top-24">
                    <CardHeader>
                        <CardTitle>Bipar Produto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="sn-input">Número de Série (SN)</Label>
                            <Input
                                id="sn-input"
                                ref={snInputRef}
                                placeholder="Aguardando leitura do SN..."
                                value={currentSN}
                                onChange={e => setCurrentSN(e.target.value)}
                                onKeyDown={handleSNKeyDown}
                                disabled={isSearching}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button className="w-full" onClick={handleAddItem} disabled={isSearching || !currentSN}>
                            {isSearching ? <Loader2 className="animate-spin" /> : <ScanLine />}
                            Adicionar Item
                        </Button>
                    </CardFooter>
                </Card>

                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Remessa Atual</CardTitle>
                                    <CardDescription>
                                        {scannedItems.length} item(ns) na lista para envio.
                                    </CardDescription>
                                </div>
                                 <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Custo Total da Remessa</p>
                                    <p className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border max-h-[50vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>SN</TableHead>
                                            <TableHead>Condição</TableHead>
                                            <TableHead className="text-right">Custo</TableHead>
                                            <TableHead className="text-center">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {scannedItems.length > 0 ? (
                                            scannedItems.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell><Badge variant="outline">{item.sku}</Badge></TableCell>
                                                    <TableCell className="font-mono">{item.serialNumber}</TableCell>
                                                    <TableCell><Badge variant="secondary">{item.condition}</Badge></TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(item.costPrice)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <Package className="h-10 w-10 mb-4" />
                                                        Aguardando leitura de produtos...
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <Button size="lg" disabled={isSaving || scannedItems.length === 0}>
                                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                                        Finalizar e Salvar Remessa
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Finalizar Remessa?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação removerá permanentemente os {scannedItems.length} itens do estoque principal.
                                            O custo total da remessa é de {formatCurrency(totalCost)}. Deseja continuar?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleSaveBatch}>Sim, Finalizar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

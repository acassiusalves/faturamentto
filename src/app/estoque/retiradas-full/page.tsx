
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { findProductByEanOrSku, updateInventoryQuantity } from '@/services/firestore';
import type { Product, InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ScanLine, Trash2, Package, Save, ArrowLeft, PackageMinus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface RemittanceItem {
    product: Product;
    inventoryItem: InventoryItem;
    quantity: number;
}

export default function RetiradasFullPage() {
    const { toast } = useToast();
    const [remittanceItems, setRemittanceItems] = useState<RemittanceItem[]>([]);
    const [currentCode, setCurrentCode] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState('1');
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const codeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        codeInputRef.current?.focus();
    }, []);

    const handleAddItem = async () => {
        if (!currentCode.trim()) return;
        
        setIsSearching(true);
        const codeToAdd = currentCode.trim();
        const quantityToAdd = parseInt(currentQuantity, 10);

        if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
            toast({ variant: 'destructive', title: 'Quantidade inválida', description: 'Por favor, insira um número maior que zero.' });
            setIsSearching(false);
            return;
        }

        try {
            const { product, inventoryItem } = await findProductByEanOrSku(codeToAdd, 'Geral');

            if (product && inventoryItem) {
                if (inventoryItem.quantity < quantityToAdd) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'Estoque Insuficiente', 
                        description: `Apenas ${inventoryItem.quantity} unidades de "${product.name}" estão disponíveis.` 
                    });
                    setIsSearching(false);
                    return;
                }

                setRemittanceItems(prev => {
                    const existingIndex = prev.findIndex(item => item.product.id === product.id);
                    if (existingIndex > -1) {
                        const newItems = [...prev];
                        const newQuantity = newItems[existingIndex].quantity + quantityToAdd;
                         if (newQuantity > inventoryItem.quantity) {
                             toast({ 
                                variant: 'destructive', 
                                title: 'Estoque Insuficiente', 
                                description: `Você já adicionou ${newItems[existingIndex].quantity}. Adicionar mais ${quantityToAdd} excederia o estoque de ${inventoryItem.quantity}.` 
                            });
                            return prev;
                         }
                        newItems[existingIndex].quantity = newQuantity;
                        toast({ title: 'Quantidade Atualizada!', description: `${product.name} agora com ${newQuantity} unidades.` });
                        return newItems;
                    } else {
                        toast({ title: 'Item Adicionado!', description: `${product.name} adicionado à remessa.` });
                        return [...prev, { product, inventoryItem, quantity: quantityToAdd }];
                    }
                });

            } else {
                toast({ variant: 'destructive', title: 'Produto não encontrado', description: 'Nenhum produto com este EAN/código foi encontrado no estoque.' });
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Não foi possível buscar o produto.';
            toast({ variant: 'destructive', title: 'Erro ao buscar', description: msg });
        } finally {
            setIsSearching(false);
            setCurrentCode('');
            setCurrentQuantity('1');
            codeInputRef.current?.focus();
        }
    };
    
    const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        }
    };

    const handleRemoveItem = (productId: string) => {
        setRemittanceItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const handleSaveBatch = async () => {
        if (remittanceItems.length === 0) {
            toast({ variant: 'destructive', title: 'Lista vazia', description: 'Adicione itens antes de salvar.' });
            return;
        }

        setIsSaving(true);
        try {
             for (const item of remittanceItems) {
                const update = {
                    inventoryItem: item.inventoryItem,
                    quantityToRemove: item.quantity
                };
                 await updateInventoryQuantity(update);
            }
            
            toast({
                title: 'Remessa Salva!',
                description: `${remittanceItems.length} tipo(s) de produto foram baixados do estoque e registrados para o Full.`,
            });
            setRemittanceItems([]);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Não foi possível dar baixa nos itens do estoque.';
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: msg });
        } finally {
            setIsSaving(false);
        }
    };

    const totalCost = useMemo(() => {
        return remittanceItems.reduce((acc, item) => acc + (item.inventoryItem.costPrice * item.quantity), 0);
    }, [remittanceItems]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
             <Link href="/estoque" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit mb-0">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Estoque
            </Link>
            <div>
                <h1 className="text-3xl font-bold font-headline">Registrar Retirada para o Full</h1>
                <p className="text-muted-foreground">Bipe o EAN dos produtos gerais e informe a quantidade para adicioná-los à remessa.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 items-start">
                <Card className="md:col-span-1 sticky top-24">
                    <CardHeader>
                        <CardTitle>Bipar Produto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code-input">EAN / Código do Produto</Label>
                            <Input
                                id="code-input"
                                ref={codeInputRef}
                                placeholder="Aguardando leitura do código..."
                                value={currentCode}
                                onChange={e => setCurrentCode(e.target.value)}
                                onKeyDown={handleCodeKeyDown}
                                disabled={isSearching}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="quantity-input">Quantidade</Label>
                            <Input
                                id="quantity-input"
                                type="number"
                                min="1"
                                placeholder="1"
                                value={currentQuantity}
                                onChange={e => setCurrentQuantity(e.target.value)}
                                onKeyDown={handleCodeKeyDown}
                                disabled={isSearching}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button className="w-full" onClick={handleAddItem} disabled={isSearching || !currentCode}>
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
                                        {remittanceItems.length} item(ns) na lista para envio.
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
                                            <TableHead className="text-center">Quantidade</TableHead>
                                            <TableHead className="text-right">Custo Unit.</TableHead>
                                            <TableHead className="text-right">Custo Total</TableHead>
                                            <TableHead className="text-center">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {remittanceItems.length > 0 ? (
                                            remittanceItems.map(item => (
                                                <TableRow key={item.product.id}>
                                                    <TableCell className="font-medium">{item.product.name}</TableCell>
                                                    <TableCell><Badge variant="outline">{item.product.sku}</Badge></TableCell>
                                                    <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                                                    <TableCell className="text-right font-semibold">{formatCurrency(item.inventoryItem.costPrice)}</TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(item.inventoryItem.costPrice * item.quantity)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.product.id)}>
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
                                     <Button size="lg" disabled={isSaving || remittanceItems.length === 0}>
                                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                                        Finalizar e Salvar Remessa
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Finalizar Remessa?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação dará baixa na quantidade dos {remittanceItems.length} tipo(s) de produto(s) do estoque principal e irá registrar a saída no histórico.
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

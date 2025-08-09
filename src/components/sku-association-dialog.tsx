"use client";

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { XCircle, PlusCircle } from 'lucide-react';
import type { Product } from '@/lib/types';

interface SkuAssociationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    onSave: (product: Product, newSkus: string[]) => void;
}

export function SkuAssociationDialog({ isOpen, onClose, product, onSave }: SkuAssociationDialogProps) {
    const [skus, setSkus] = useState<string[]>([]);
    const [currentSku, setCurrentSku] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (product && product.associatedSkus) {
            setSkus(product.associatedSkus);
        } else {
            setSkus([]);
        }
    }, [product]);

    const handleAddSku = () => {
        if (!currentSku.trim()) return;
        const newSku = currentSku.trim();
        if (skus.includes(newSku)) {
            toast({
                variant: 'destructive',
                title: 'SKU Duplicado',
                description: 'Este SKU já foi adicionado para este produto.',
            });
            return;
        }
        setSkus(prev => [...prev, newSku]);
        setCurrentSku('');
    };

    const handleRemoveSku = (skuToRemove: string) => {
        setSkus(prev => prev.filter(sku => sku !== skuToRemove));
    };
    
    const handleSave = () => {
        onSave(product, skus);
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Associar SKUs de Marketplaces</DialogTitle>
                    <DialogDescription>
                        Adicione os SKUs deste produto (<span className="font-bold">{product?.name}</span>) de outros marketplaces para vinculá-los ao SKU principal (<span className="font-mono">{product?.sku}</span>).
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="sku-input">Novo SKU do Marketplace</Label>
                        <div className="flex gap-2">
                            <Input
                                id="sku-input"
                                value={currentSku}
                                onChange={(e) => setCurrentSku(e.target.value)}
                                placeholder="Digite o SKU e pressione Enter"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddSku();
                                    }
                                }}
                            />
                            <Button onClick={handleAddSku} size="icon">
                                <PlusCircle />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>SKUs Associados</Label>
                        <div className="p-3 border rounded-md min-h-[80px] bg-muted/50">
                            {skus.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {skus.map(sku => (
                                        <Badge key={sku} variant="default" className="flex items-center gap-1.5 pr-1 text-sm">
                                            {sku}
                                            <button onClick={() => handleRemoveSku(sku)} className="rounded-full hover:bg-black/20">
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-2">Nenhum SKU associado.</p>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Associações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

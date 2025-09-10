"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SearchableProduct } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { searchMercadoLivreAction } from '@/app/actions';
import { Loader2, Package, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface SearchResultsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: SearchableProduct | null;
}

export function SearchResultsDialog({ isOpen, onClose, product }: SearchResultsDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && product) {
            const performSearch = async () => {
                setIsLoading(true);
                setError(null);
                setResults([]);
                try {
                    const formData = new FormData();
                    formData.append('productName', product.refinedQuery || product.name);
                    formData.append('quantity', '20');
                    const searchResult = await searchMercadoLivreAction({ result: null, error: null }, formData);
                    if (searchResult.error) {
                        throw new Error(searchResult.error);
                    }
                    if (searchResult.result) {
                        setResults(searchResult.result);
                    }
                } catch (err: any) {
                    setError(err.message || 'Falha ao buscar ofertas.');
                } finally {
                    setIsLoading(false);
                }
            };
            performSearch();
        }
    }, [isOpen, product]);

    const matchingResults = useMemo(() => {
        if (!results || !product) return [];
        return results.filter(r => r.model?.toLowerCase() === product.model?.toLowerCase());
    }, [results, product]);

    const otherResults = useMemo(() => {
        if (!results || !product) return [];
        return results.filter(r => r.model?.toLowerCase() !== product.model?.toLowerCase());
    }, [results, product]);

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Resultados da Busca no Mercado Livre</DialogTitle>
                    <DialogDescription>
                        Buscando por: <span className="font-semibold text-primary">{product?.refinedQuery || product?.name}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto pr-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary" size={32}/>
                        </div>
                    ) : error ? (
                        <div className="text-destructive font-medium">{error}</div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-2">Resultados Correspondentes ({matchingResults.length})</h3>
                                <div className="space-y-2">
                                    {matchingResults.length > 0 ? matchingResults.map(offer => (
                                         <div key={offer.id} className="flex items-center gap-4 p-2 border rounded-md">
                                             <div className="relative h-16 w-16 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                {offer.thumbnail && <Image src={offer.thumbnail} alt={offer.name} fill className="object-contain" />}
                                            </div>
                                            <div className="flex-grow">
                                                <p className="font-medium line-clamp-2">{offer.name}</p>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Marca: <Badge variant="outline">{offer.brand}</Badge> | Vendedor: <Badge variant="outline">{offer.seller_nickname}</Badge>
                                                </div>
                                            </div>
                                            <div className="font-bold text-lg text-primary">{formatCurrency(offer.price)}</div>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">Nenhuma correspondência exata encontrada para o modelo.</p>}
                                </div>
                            </div>
                             <div>
                                <h3 className="font-semibold mb-2">Outros Resultados ({otherResults.length})</h3>
                                <div className="space-y-2">
                                    {otherResults.map(offer => (
                                         <div key={offer.id} className="flex items-center gap-4 p-2 border rounded-md opacity-70">
                                            <div className="relative h-16 w-16 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                {offer.thumbnail && <Image src={offer.thumbnail} alt={offer.name} fill className="object-contain" />}
                                            </div>
                                            <div className="flex-grow">
                                                <p className="font-medium line-clamp-2">{offer.name}</p>
                                                 <div className="text-xs text-muted-foreground mt-1">
                                                    Marca: <Badge variant="outline">{offer.brand}</Badge> | Vendedor: <Badge variant="outline">{offer.seller_nickname}</Badge>
                                                </div>
                                            </div>
                                            <div className="font-bold text-lg">{formatCurrency(offer.price)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

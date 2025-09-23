
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
import { Loader2, Package, Search, CheckCircle, ExternalLink, TrendingDown, Wallet, HandCoins } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FullIcon, MercadoEnviosIcon } from '@/components/icons';
import { cn, formatBRL } from '@/lib/utils';

interface SearchResultsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    product: SearchableProduct | null;
}

interface EnrichedOffer extends SearchableProduct {
    sale_fee_amount?: number;
    shipping_estimate?: { service: string; cost: number } | null;
    net_estimated?: number | null;
}


const listingTypeMap: Record<string, string> = {
    "gold_special": "Clássico",
    "gold_pro": "Premium"
};

export function SearchResultsDialog({ isOpen, onClose, product }: SearchResultsDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<EnrichedOffer[]>([]);
    const [showOnlyActive, setShowOnlyActive] = useState(true);

    useEffect(() => {
        if (isOpen && product) {
            const performSearch = async () => {
                setIsLoading(true);
                setIsEnriching(true);
                setError(null);
                setResults([]);
                try {
                    const formData = new FormData();
                    formData.append('productName', product.refinedQuery || product.name);
                    formData.append('quantity', '50'); // Fetch more results
                    const searchResult = await searchMercadoLivreAction({ result: null, error: null }, formData);
                    
                    if (searchResult.error) {
                        throw new Error(searchResult.error);
                    }
                    if (searchResult.result) {
                        setResults(searchResult.result); // Set initial results

                        // Now, enrich with cost data
                        const costResponse = await fetch('/api/ml/costs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                results: searchResult.result,
                                siteId: 'MLB',
                                zipCode: '01001-000' // CEP de São Paulo como padrão
                            })
                        });
                        if (!costResponse.ok) {
                            console.warn("Could not fetch costs, but showing results anyway.");
                        } else {
                            const costData = await costResponse.json();
                            const costMap = new Map(costData.items.map((item: any) => [item.id, item]));
                            
                            setResults(prevResults => prevResults.map(res => {
                                const costs = costMap.get(res.id);
                                return costs ? { ...res, ...costs } : res;
                            }));
                        }
                    }
                } catch (err: any) {
                    setError(err.message || 'Falha ao buscar ofertas.');
                } finally {
                    setIsLoading(false);
                    setIsEnriching(false);
                }
            };
            performSearch();
        }
    }, [isOpen, product]);

    const filteredResults = useMemo(() => {
        if (!results) return [];
        if (showOnlyActive) {
            return results.filter(r => r.price > 0);
        }
        return results;
    }, [results, showOnlyActive]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Resultados da Busca: <span className="text-primary">{product?.refinedQuery || product?.name}</span></DialogTitle>
                    <DialogDescription>
                        Exibindo os anúncios encontrados no Mercado Livre para o termo de busca.
                    </DialogDescription>
                </DialogHeader>
                 <div className="flex items-center justify-between pb-4 border-b">
                    <Badge variant="secondary">{filteredResults.length} anúncios listados</Badge>
                     <div className="flex items-center space-x-2">
                        <Switch id="active-only" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                        <Label htmlFor="active-only">Apenas ativos</Label>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto pr-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary" size={32}/>
                        </div>
                    ) : error ? (
                        <div className="text-destructive font-medium">{error}</div>
                    ) : (
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Imagem</TableHead>
                                    <TableHead>Nome do Produto</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                    <TableHead className="text-right">Comissão</TableHead>
                                    <TableHead className="text-right">Frete</TableHead>
                                    <TableHead className="text-right">Líquido Est.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? filteredResults.map(offer => {
                                    const isModelMatch = product?.model && offer.model && offer.model?.toLowerCase() === product?.model?.toLowerCase();
                                    return (
                                     <TableRow key={offer.id}>
                                        <TableCell>
                                            <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                {offer.thumbnail && <Image src={offer.thumbnail} alt={offer.name} fill className="object-contain" data-ai-hint="product image"/>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Link href={`https://www.mercadolivre.com.br/p/${offer.catalog_product_id}`} target="_blank" className="font-medium text-primary hover:underline">
                                                    {offer.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                </Link>
                                                <p className="text-xs text-muted-foreground">ID Catálogo: {offer.catalog_product_id}</p>
                                                <p className="text-xs text-muted-foreground">Marca: {offer.brand} | Modelo: {offer.model}</p>
                                                <p className="text-xs text-muted-foreground">Vendedor: <span className="font-semibold">{offer.seller_nickname}</span> {offer.is_official_store && <Badge variant="outline">Loja Oficial</Badge>}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {offer.shipping_logistic_type === 'fulfillment' ? <FullIcon /> : <MercadoEnviosIcon />}
                                                    {offer.listing_type_id && <Badge variant="outline">{listingTypeMap[offer.listing_type_id] || offer.listing_type_id}</Badge>}
                                                    {isModelMatch && (
                                                        <Badge className="bg-green-600 text-white hover:bg-green-700">
                                                            <CheckCircle className="mr-1 h-3 w-3" />
                                                            Correspondência de modelo
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-lg">{formatBRL(offer.price)}</TableCell>
                                        <TableCell className="text-right text-sm text-destructive">
                                            {isEnriching ? <Loader2 size={16} className="animate-spin" /> : offer.sale_fee_amount ? formatBRL(offer.sale_fee_amount) : '–'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-destructive">
                                            {isEnriching ? <Loader2 size={16} className="animate-spin" /> : offer.shipping_estimate ? formatBRL(offer.shipping_estimate.cost) : '–'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-bold text-green-600">
                                            {isEnriching ? <Loader2 size={16} className="animate-spin" /> : offer.net_estimated ? formatBRL(offer.net_estimated) : '–'}
                                        </TableCell>
                                     </TableRow>
                                )}) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Nenhum anúncio encontrado para os filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


"use client";

import { useState, useEffect, useMemo } from 'react';
import type { SearchableProduct, PostedOnAccount } from '@/lib/types';
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

// Offer type is now based on the more detailed ProductResult from actions
type Offer = import('@/lib/types').ProductResult;

// Helpers seguros para texto
const safeText = (v: any) =>
  v == null ? "" : (typeof v === "string" || typeof v === "number") ? String(v) : JSON.stringify(v);

const getListingType = (offer: any) => {
  const raw = offer?.listing_type_id ?? offer?.listingTypeId;
  return typeof raw === "string" ? raw : safeText(raw);
};


const listingTypeMap: Record<string, string> = {
    "gold_special": "Clássico",
    "gold_pro": "Premium"
};

export function SearchResultsDialog({ isOpen, onClose, product }: SearchResultsDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Offer[]>([]);
    const [showOnlyActive, setShowOnlyActive] = useState(true);

    useEffect(() => {
        if (isOpen && product) {
            const performSearch = async () => {
                setIsLoading(true);
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

    const filteredResults = useMemo(() => {
        if (!results) return [];
        if (showOnlyActive) {
            return results.filter(r => (r as any).price > 0);
        }
        return results;
    }, [results, showOnlyActive]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? filteredResults.map(offer => {
                                    const isModelMatch = product?.model && offer.model && offer.model?.toLowerCase() === product?.model?.toLowerCase();
                                    const rawPosted = (offer as any).postedOnAccounts;
                                    const postedOnAccounts: PostedOnAccount[] = Array.isArray(rawPosted)
                                      ? rawPosted
                                      : rawPosted ? [rawPosted] : [];
                                    return (
                                     <TableRow key={offer.id}>
                                        <TableCell>
                                            <div className="relative h-20 w-20 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                                {offer.thumbnail && (
                                                  <Image
                                                    src={offer.thumbnail}
                                                    alt={safeText(offer.name) || "Produto"}
                                                    fill
                                                    className="object-contain"
                                                    data-ai-hint="product image"
                                                  />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <Link
                                                    href={offer.catalog_product_id ? `https://www.mercadolivre.com.br/p/${safeText(offer.catalog_product_id)}` : "#"}
                                                    target="_blank"
                                                    className="font-medium text-primary hover:underline"
                                                  >
                                                    {safeText(offer.name)} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                  </Link>

                                                  {postedOnAccounts.map((account: PostedOnAccount, idx) => {
                                                    // GARANTE string SEMPRE:
                                                    const label = safeText(
                                                      (account as any)?.accountName ??
                                                      (account as any)?.name ??
                                                      account
                                                    );
                                                    const keyVal = (account as any)?.accountId ?? idx;

                                                    return (
                                                      <Badge key={String(keyVal)} className="bg-yellow-400 text-black hover:bg-yellow-500">
                                                        <CheckCircle className="mr-1 h-3 w-3" />
                                                        {/* Só string aqui */}
                                                        {"Postado em: "}{label}
                                                      </Badge>
                                                    );
                                                  })}
                                                </div>

                                                <p className="text-xs text-muted-foreground">
                                                  ID Catálogo: {safeText(offer.catalog_product_id)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  Marca: {safeText(offer.brand)} | Modelo: {safeText(offer.model)}
                                                </p>

                                                <p className="text-xs text-muted-foreground">Vendedor: <span className="font-semibold">{safeText((offer as any).seller_nickname)}</span> {(offer as any).is_official_store && <Badge variant="outline">Loja Oficial</Badge>}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                  {(offer as any).shipping_logistic_type === "fulfillment" ? <FullIcon /> : <MercadoEnviosIcon />}
                                                  {!!((offer as any).listing_type_id ?? (offer as any).listingTypeId) && (
                                                    <Badge variant="outline">
                                                      {listingTypeMap[getListingType(offer)] ?? getListingType(offer)}
                                                    </Badge>
                                                  )}
                                                  {isModelMatch && (
                                                    <Badge className="bg-green-600 text-white hover:bg-green-700">
                                                      <CheckCircle className="mr-1 h-3 w-3" />
                                                      Correspondência de modelo
                                                    </Badge>
                                                  )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-lg">{formatBRL((offer as any).price)}</TableCell>
                                     </TableRow>
                                )}) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
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


"use client";

import React, { useState, useActionState, useEffect, useMemo, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Search, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { searchMercadoLivreAction } from '@/app/actions';
import { formatCurrency, cn } from '@/lib/utils';
import { FullIcon, FreteGratisIcon, CorreiosLogo, MercadoEnviosIcon } from '@/components/icons';

interface SearchableProduct {
    name: string;
    model: string;
    refinedQuery?: string;
    description: string;
    price: string;
    imageUrl?: string;
}

interface SearchResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: SearchableProduct;
}

const initialSearchState = {
    result: null,
    error: null,
};

const listingTypeMap: Record<string, string> = {
    "gold_special": "Clássico",
    "gold_pro": "Premium"
};


export function SearchResultsDialog({ isOpen, onClose, product }: SearchResultsDialogProps) {
  const [searchState, formAction, isSearchingAction] = useActionState(searchMercadoLivreAction, initialSearchState);
  const [isPending, startTransition] = useTransition();
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && product) {
        startTransition(() => {
            const formData = new FormData();
            const searchTerm = product.refinedQuery || `${product.name} ${product.model}`;
            formData.append('productName', searchTerm);
            formData.append('quantity', '10');
            formAction(formData);
        });
    }
  }, [isOpen, product, formAction]);
  
  const filteredResults = useMemo(() => {
    if (!searchState.result) return [];
    if (!showOnlyActive) return searchState.result;
    return searchState.result.filter((p: any) => p.price > 0);
  }, [searchState.result, showOnlyActive]);
  
  const isSearching = isSearchingAction || isPending;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Resultados da Busca: <span className="text-primary">{product.refinedQuery || product.name}</span></DialogTitle>
          <DialogDescription>
            Exibindo os anúncios encontrados no Mercado Livre para o termo de busca.
          </DialogDescription>
        </DialogHeader>
        
        <div className="border-b pb-4 flex justify-end">
             <div className="flex items-center space-x-2">
                <Label htmlFor="active-only-switch" className="text-sm font-medium">Apenas ativos</Label>
                <Switch id="active-only-switch" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
            </div>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="ml-4">Buscando anúncios...</p>
            </div>
          ) : searchState.error ? (
            <div className="text-destructive font-semibold p-4 text-center">
              Erro ao buscar: {searchState.error}
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Imagem</TableHead>
                    <TableHead>Nome do Produto</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((p: any) => {
                     const displayName = (p.name ?? "").trim() || "Produto do Mercado Livre";
                     return (
                        <TableRow key={p.id}>
                            <TableCell>
                                <div className="w-24 h-24 bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                                    {p.thumbnail && !broken.has(p.id) ? (
                                        <Image 
                                            src={p.thumbnail}
                                            alt={displayName}
                                            fill
                                            sizes="96px"
                                            className="object-contain" 
                                            data-ai-hint="product image"
                                            onError={() => setBroken(prev => new Set(prev).add(p.id))}
                                        />
                                    ) : (
                                        <Package className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Link href={`https://www.mercadolivre.com.br/p/${p.catalog_product_id}`} target="_blank" className="font-semibold text-primary hover:underline">
                                    {p.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                </Link>
                                <div className="text-xs text-muted-foreground mt-1">ID Catálogo: {p.catalog_product_id}</div>
                                <div className="text-xs text-muted-foreground mt-1">Marca: {p.brand || ''} | Modelo: {p.model || ''}</div>
                                 <div className="text-xs text-muted-foreground mt-1">
                                    Vendedor: 
                                    {p.seller_nickname ? (
                                        <Link href={`https://www.mercadolivre.com.br/perfil/${p.seller_nickname}`} target="_blank" className="text-blue-600 hover:underline ml-1">
                                            {p.seller_nickname}
                                        </Link>
                                    ) : ''}
                                    {p.official_store_id && (
                                        <Badge variant="secondary" className="ml-2">Loja Oficial</Badge>
                                    )}
                                </div>
                                <div className="flex flex-col items-start gap-1 mt-1.5">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                                        {p.shipping_logistic_type === "fulfillment" && <FullIcon />}
                                        {p.shipping_type === 'Correios' && <CorreiosLogo />}
                                        {p.shipping_logistic_type === 'cross_docking' && <MercadoEnviosIcon />}
                                        {p.free_shipping && (
                                            <div className={cn(p.shipping_logistic_type === 'fulfillment' && 'ml-2')}>
                                                <FreteGratisIcon />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {p.listing_type_id && (
                                        <Badge variant="outline" className="text-xs">{listingTypeMap[p.listing_type_id] || p.listing_type_id || ''}</Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="font-semibold text-right">{formatCurrency(p.price)}</TableCell>
                        </TableRow>
                     )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Nenhum resultado encontrado.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

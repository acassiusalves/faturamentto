
"use client";

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Package, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Users, Shield, TrendingDown, ThumbsDown, Clock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchMercadoLivreAction } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { FullIcon, FreteGratisIcon, CorreiosLogo, MercadoEnviosIcon } from '@/components/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltersSidebar } from "@/components/filters-sidebar";
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';


interface ProductResult {
    thumbnail: string;
    name: string;
    catalog_product_id: string;
    id: string;
    brand: string;
    model: string;
    price: number;
    shipping_type: string;
    shipping_logistic_type: string;
    free_shipping: boolean;
    category_id: string;
    listing_type_id: string;
    seller_nickname: string;
    official_store_id: number | null;
    is_official_store: boolean;
    offerCount: number;
    reputation?: {
        level_id: string | null;
        power_seller_status: string | null;
        metrics: {
            claims_rate: number;
            cancellations_rate: number;
            delayed_rate: number;
        }
    }
    seller_state?: string | null;
    seller_state_id?: string | null;
    seller_city?: string | null;
    seller_city_id?: string | null;
    fees?: {
      listing_fee_amount: number;
      sale_fee_amount: number;
      sale_fee_percent: number;
    };
}

const initialSearchState = {
    result: null as ProductResult[] | null,
    error: null as string | null,
};

const listingTypeMap: Record<string, string> = {
    "gold_special": "Clássico",
    "gold_pro": "Premium"
};

const reputationLevelMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    "5_green": { label: "MercadoLíder Platinum", color: "bg-green-500", icon: ShieldCheck },
    "4_green": { label: "MercadoLíder Gold", color: "bg-yellow-400", icon: ShieldCheck },
    "3_green": { label: "MercadoLíder", color: "bg-yellow-500", icon: ShieldCheck },
    "2_orange": { label: "Reputação Laranja", color: "bg-orange-500", icon: Shield },
    "1_red": { label: "Reputação Vermelha", color: "bg-red-500", icon: Shield },
};

const freightMap: Record<string, string> = {
    "drop_off": "Correios",
    "xd_drop_off": "Correios",
    "xd_pick_up": "Correios",
    "fulfillment": "Full ML",
    "cross_docking": "Agência ML",
    "pick_up": "Retirada",
    "prepaid": "Frete pré-pago",
    "self_service": "Sem Mercado Envios",
    "custom": "A combinar"
};


export default function BuscarMercadoLivrePage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [quantity, setQuantity] = useState(50);
    const [state, setState] = useState(initialSearchState);
    const [isSearching, startTransition] = useTransition();
    const [broken, setBroken] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState(0);

    // Filter states
    const [shippingFilter, setShippingFilter] = useState<string[]>([]);
    const [brandFilter, setBrandFilter] = useState<string[]>([]);
    const [officialStoreFilter, setOfficialStoreFilter] = useState<("yes"|"no")[]>([]);
    const [showOnlyActive, setShowOnlyActive] = useState(true);


    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    
    // Memoized unique filter options with counts
    const { shippingOptionsWithCounts, brandOptionsWithCounts, storeTypeCounts } = useMemo(() => {
        const shippingCounts: Record<string, number> = {};
        const brandCounts: Record<string, number> = {};
        const storeCounts = { official: 0, nonOfficial: 0 };


        (state.result || []).forEach(p => {
            if (p.shipping_type) {
                shippingCounts[p.shipping_type] = (shippingCounts[p.shipping_type] || 0) + 1;
            }
            if (p.brand) {
                brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
            }
            if (p.is_official_store) {
                storeCounts.official++;
            } else {
                storeCounts.nonOfficial++;
            }
        });

        const shippingOptions = Object.keys(shippingCounts).sort();
        const brandOptions = Object.keys(brandCounts).sort();

        return {
            shippingOptionsWithCounts: shippingOptions.map(opt => ({
                value: opt,
                label: freightMap[opt] || opt,
                count: shippingCounts[opt]
            })),
            brandOptionsWithCounts: brandOptions.map(opt => ({
                value: opt,
                label: opt,
                count: brandCounts[opt]
            })),
            storeTypeCounts: storeCounts,
        };
    }, [state.result]);

    const filteredResults = useMemo(() => {
        return (
            state.result?.filter((p) => {
                const shippingMatch = shippingFilter.length === 0 || shippingFilter.includes(p.shipping_type);
                const brandMatch = brandFilter.length === 0 || brandFilter.includes(p.brand);
                
                const storeOk =
                  officialStoreFilter.length === 0 ||
                  officialStoreFilter.length === 2 ||
                  (officialStoreFilter.includes("yes") && p.is_official_store) ||
                  (officialStoreFilter.includes("no") && !p.is_official_store);

                const activeMatch = !showOnlyActive || p.price > 0;

                return shippingMatch && brandMatch && storeOk && activeMatch;
            }) || []
        );
    }, [state.result, shippingFilter, brandFilter, officialStoreFilter, showOnlyActive]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            toast({
                variant: 'destructive',
                title: 'Termo de busca vazio',
                description: 'Por favor, insira um termo para buscar.',
            });
            return;
        }
        startTransition(async () => {
            const formData = new FormData();
            formData.append('productName', searchTerm);
            formData.append('quantity', String(quantity));
            const result = await searchMercadoLivreAction(initialSearchState, formData);
            setState(result);
        });
    };
    
    const pageCount = useMemo(() => {
        return Math.ceil((filteredResults.length || 0) / pageSize);
    }, [filteredResults, pageSize]);

    const paginatedResults = useMemo(() => {
        const startIndex = pageIndex * pageSize;
        return filteredResults.slice(startIndex, startIndex + pageSize) || [];
    }, [filteredResults, pageIndex, pageSize]);
    
    useEffect(() => {
      setPageIndex(0);
    }, [shippingFilter, brandFilter, officialStoreFilter]);

    useEffect(() => {
        if (pageIndex >= pageCount && pageCount > 0) {
            setPageIndex(pageCount - 1);
        } else if (pageCount === 0) {
            setPageIndex(0);
        }
    }, [filteredResults, pageIndex, pageCount]);
    
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isSearching) {
            setProgress(10); // Start with a small progress
            timer = setInterval(() => {
                setProgress(prev => (prev >= 90 ? 90 : prev + 5)); // Increment but stop at 90
            }, 500);
        } else {
            setProgress(100); // Complete on finish
            setTimeout(() => setProgress(0), 1000); // Reset after a short delay
        }
        return () => clearInterval(timer);
    }, [isSearching]);


    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline">Buscar Produtos no Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Use esta página para fazer buscas diretas na API de produtos do Mercado Livre e entender os dados retornados.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Busca Manual</CardTitle>
                    <CardDescription>
                        Insira um termo de busca, a quantidade de anúncios e veja a resposta da API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-grow space-y-2 w-full">
                            <Label htmlFor="search-term">Termo de Busca</Label>
                            <Input
                                id="search-term"
                                placeholder="Ex: Xiaomi Poco X6 Pro"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2 w-full sm:w-auto">
                             <Label htmlFor="quantity">Quantidade</Label>
                             <Input
                                id="quantity"
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full sm:w-28"
                            />
                        </div>
                        <Button type="submit" disabled={isSearching} className="w-full sm:w-auto">
                            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                            Buscar
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            {isSearching && (
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <p className="font-semibold">Buscando no Mercado Livre...</p>
                    <Progress value={progress} className="w-full max-w-sm transition-all duration-500" />
                </div>
            )}
            
            {state?.result && !isSearching && (
                 <div className="grid grid-cols-1 md:grid-cols-[256px,1fr] gap-6">
                    <FiltersSidebar
                        shippingOptions={shippingOptionsWithCounts}
                        brandOptions={brandOptionsWithCounts}
                        storeTypeCounts={storeTypeCounts}
                        selectedShipping={shippingFilter}
                        setSelectedShipping={setShippingFilter}
                        selectedBrands={brandFilter}
                        setSelectedBrands={setBrandFilter}
                        storeFilter={officialStoreFilter}
                        setStoreFilter={setOfficialStoreFilter}
                    />

                    <Card>
                        <CardHeader>
                             <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Resultados da Busca ({filteredResults.length})</CardTitle>
                                    <CardDescription>Produtos encontrados no catálogo do Mercado Livre.</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="active-only-switch" className="text-sm font-medium">Apenas ativos</Label>
                                    <Switch id="active-only-switch" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
                                </div>
                            </div>
                             {!isSearching && state?.result && (
                              <div className="text-xs text-muted-foreground pt-2">
                                oficiais: <b>{state.result.filter(r => r.is_official_store).length}</b> / {state.result.length}
                              </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[120px]">Imagem</TableHead>
                                            <TableHead>Nome do Produto</TableHead>
                                            <TableHead>Preço</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedResults.length > 0 ? paginatedResults.map(product => {
                                            const displayName = (product.name ?? "").trim() || "Produto do Mercado Livre";
                                            const repLevel = product.reputation?.level_id ? reputationLevelMap[product.reputation.level_id] : null;

                                            return (
                                            <TableRow key={product.id} className={cn(product.price === 0 && "opacity-50 bg-muted/50")}>
                                                <TableCell>
                                                    <div className="w-24 h-24 bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                                                        {product.thumbnail && !broken.has(product.id) ? (
                                                            <Image 
                                                                src={product.thumbnail}
                                                                alt={displayName}
                                                                fill
                                                                sizes="96px"
                                                                className="object-contain" 
                                                                data-ai-hint="product image"
                                                                onError={() => setBroken(prev => new Set(prev).add(product.id))}
                                                            />
                                                        ) : (
                                                            <Package className="h-8 w-8 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`https://www.mercadolivre.com.br/p/${product.catalog_product_id}`} target="_blank" className="font-semibold text-primary hover:underline">
                                                        {product.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                    </Link>
                                                    <div className="text-xs text-muted-foreground mt-1">ID Catálogo: {product.catalog_product_id}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Categoria: {product.category_id}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Marca: {product.brand || ''}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Modelo: {product.model || ''}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Vendedor:
                                                        {product.seller_nickname ? (
                                                            <Link
                                                            href={`https://www.mercadolivre.com.br/perfil/${product.seller_nickname}`}
                                                            target="_blank"
                                                            className="text-blue-600 hover:underline ml-1"
                                                            >
                                                            {product.seller_nickname}
                                                            </Link>
                                                        ) : null}
                                                    </div>

                                                    {(product.seller_city || product.seller_state) && (
                                                      <div className="text-[11px] text-muted-foreground mt-0.5">
                                                        {product.seller_city
                                                          ? `${product.seller_city}${product.seller_state ? " • " : ""}`
                                                          : ""}
                                                        {product.seller_state || ""}
                                                      </div>
                                                    )}
                                                     <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                        <Users className="h-3 w-3" />
                                                        <span><b>{Number.isFinite(product.offerCount) ? product.offerCount : 0}</b> ofertas</span>
                                                    </div>
                                                    {product.is_official_store && (
                                                        <Badge variant="secondary" className="mt-1.5">Loja Oficial</Badge>
                                                    )}

                                                    {product.reputation && (
                                                        <TooltipProvider>
                                                        <div className="mt-2 flex items-center gap-4 text-xs">
                                                            {repLevel && (
                                                                <Badge style={{ backgroundColor: repLevel.color }} className="text-white text-xs">
                                                                    <repLevel.icon className="mr-1 h-3 w-3"/>
                                                                    {repLevel.label}
                                                                </Badge>
                                                            )}
                                                            <div className="flex items-center gap-3">
                                                                <Tooltip>
                                                                    <TooltipTrigger className="flex items-center gap-1"><ThumbsDown className="text-red-500" size={14}/> {(product.reputation.metrics.claims_rate * 100).toFixed(2)}%</TooltipTrigger>
                                                                    <TooltipContent>Reclamações</TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="flex items-center gap-1"><TrendingDown className="text-orange-500" size={14}/> {(product.reputation.metrics.cancellations_rate * 100).toFixed(2)}%</TooltipTrigger>
                                                                    <TooltipContent>Cancelamentos</TooltipContent>
                                                                </Tooltip>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="flex items-center gap-1"><Clock className="text-yellow-500" size={14}/> {(product.reputation.metrics.delayed_rate * 100).toFixed(2)}%</TooltipTrigger>
                                                                    <TooltipContent>Atrasos no Envio</TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        </div>
                                                        </TooltipProvider>
                                                    )}
                                                    
                                                    <div className="flex flex-col items-start gap-2 mt-2">
                                                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                                                            {product.shipping_logistic_type === "fulfillment" && <FullIcon />}
                                                            {product.shipping_type === 'Correios' && <CorreiosLogo />}
                                                            {product.shipping_logistic_type === 'cross_docking' && <MercadoEnviosIcon />}
                                                            {product.free_shipping && (
                                                                <div className={cn(product.shipping_logistic_type === 'fulfillment' && 'ml-2')}>
                                                                    <FreteGratisIcon />
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 text-sm">
                                                          {product.listing_type_id && (
                                                            <Badge variant="outline">{listingTypeMap[product.listing_type_id] || product.listing_type_id}</Badge>
                                                          )}
                                                          {product.fees && (
                                                            <div className="text-muted-foreground">
                                                              <span>Comissão: <b>{formatCurrency(product.fees.sale_fee_amount)}</b> ({(product.fees.sale_fee_percent * 100).toFixed(1)}%)</span>
                                                              {product.fees.listing_fee_amount > 0 && (
                                                                <span className="ml-2"> | Taxa Fixa: {formatCurrency(product.fees.listing_fee_amount)}</span>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-lg text-right align-top">
                                                  {formatCurrency(product.price)}
                                                </TableCell>
                                            </TableRow>
                                        )}) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center">
                                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                        <Package className="h-10 w-10 mb-2"/>
                                                        Nenhum produto encontrado para os filtros selecionados.
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                            <div className="text-sm text-muted-foreground">
                                Total de {filteredResults.length} registros.
                            </div>
                            <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">Itens por página</p>
                                    <Select
                                        value={`${pageSize}`}
                                        onValueChange={(value) => {
                                            setPageSize(Number(value));
                                            setPageIndex(0);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-[70px]">
                                            <SelectValue placeholder={pageSize.toString()} />
                                        </SelectTrigger>
                                        <SelectContent side="top">
                                            {[10, 20, 50, 100].map((size) => (
                                                <SelectItem key={size} value={`${size}`}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="text-sm font-medium">
                                    Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                                </div>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )}
            
            {state?.error && !isSearching && (
                <div className="text-destructive font-semibold p-4 border border-destructive/50 rounded-md bg-destructive/10">
                    Erro: {state.error}
                </div>
            )}
        </main>
    );
}

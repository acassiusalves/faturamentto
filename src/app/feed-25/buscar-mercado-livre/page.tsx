

'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Package, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Users, Shield, TrendingDown, Clock, ShieldCheck, HelpCircle, Database, Star, Truck, CheckCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchMercadoLivreAction } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FullIcon, FreteGratisIcon, CorreiosLogo, MercadoEnviosIcon } from '@/components/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltersSidebar } from "@/components/filters-sidebar";
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CreateListingDialog } from '@/app/feed-25/buscar-mercado-livre/create-listing-form'; // Ajuste o caminho se necessário
import type { MlAccount, PostedOnAccount } from '@/lib/types';
import { useAuth } from '@/context/auth-context';


type MoneyLike = string | number | null | undefined;

interface ProductResult {
    thumbnail: string;
    name: string;
    catalog_product_id: string;
    id: string;
    item_id?: string | null;
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
    attributes: { id: string, name: string, value_name: string | null }[]; // Adicionado
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
    date_created?: string | null;
    rating_average?: number;
    reviews_count?: number;
    postedOnAccounts?: PostedOnAccount[];
    raw_data?: {
      catalog_product?: any;
      winner_item?: any;
      fees_data?: any;
      reviews_data?: any;
    };
    fees?: {
      listing_fee_amount: number;
      sale_fee_amount: number;
      sale_fee_percent: number;
      fee_total?: number;
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

const formatCurrency = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return 'R$ 0,00';
  const n = Number(String(v).replace(',', '.'));
  if (isNaN(n)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const formatPercentNoRound = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return null;
  return `${String(v).replace('.', ',')}%`; // sem toFixed
};

const toNumberSafe = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

// Calcula o custo do frete com base na faixa de preço para produtos entre 1kg e 2kg
const getShippingCostFor1To2Kg = (price: number): number | null => {
    if (price >= 200) return 28.14;
    if (price >= 150) return 25.80;
    if (price >= 120) return 23.45;
    if (price >= 100) return 21.11;
    if (price >= 79) return 18.76;
    return null; // Retorna null se for menor que 79
};


export default function BuscarMercadoLivrePage() {
    const { toast } = useToast();
    const { user, pagePermissions } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [quantity, setQuantity] = useState(50);
    const [state, setState] = useState(initialSearchState);
    const [isSearching, startTransition] = useTransition();
    const [broken, setBroken] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState(0);

    // Filter states
    const [showOnlyActive, setShowOnlyActive] = useState(true);
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
    const [selectedShipping, setSelectedShipping] = useState<string[]>([]);
    const [brandSearch, setBrandSearch] = useState("");
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [selectedStoreTypes, setSelectedStoreTypes] = useState<string[]>([]);
    const [modelSearch, setModelSearch] = useState('');
    
    // Create Listing Dialog State
    const [isCreateListingOpen, setIsCreateListingOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
    const [accounts, setAccounts] = useState<MlAccount[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);


    // Pagination state
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    
    const canCreateListing = useMemo(() => {
        if (!user || !pagePermissions) return false;
        const createPerms = pagePermissions['/actions/ml/create-listing'];
        return createPerms?.includes(user.role);
    }, [user, pagePermissions]);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await fetch('/api/ml/accounts');
                if (!response.ok) throw new Error('Falha ao buscar contas');
                const data = await response.json();
                setAccounts(data.accounts || []);
            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Erro', description: e.message });
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        fetchAccounts();
    }, [toast]);
    
    const { dynamicFilterOptions, brandOptions, shippingOptions, storeTypeOptions } = useMemo(() => {
      if (!state.result) return { dynamicFilterOptions: [], brandOptions: [], shippingOptions: [], storeTypeOptions: { official: 0, nonOfficial: 0 } };

      const attributesMap = new Map<string, { name: string, values: Map<string, number> }>();
      const brandMap = new Map<string, number>();
      const shippingMap = new Map<string, number>();
      const storeTypeMap = { official: 0, nonOfficial: 0 };
      const attributeWhitelist = new Set(['MODEL', 'RAM', 'INTERNAL_MEMORY', 'COLOR']);
  
      state.result.forEach(product => {
        // Dynamic Attributes
        product.attributes.forEach(attr => {
          if (attributeWhitelist.has(attr.id) && attr.value_name) {
            if (!attributesMap.has(attr.id)) {
              attributesMap.set(attr.id, { name: attr.name, values: new Map() });
            }
            const valueMap = attributesMap.get(attr.id)!.values;
            valueMap.set(attr.value_name, (valueMap.get(attr.value_name) || 0) + 1);
          }
        });

        // Brands
        if (product.brand) {
            brandMap.set(product.brand, (brandMap.get(product.brand) || 0) + 1);
        }
        
        // Shipping
        const shippingLabel = freightMap[product.shipping_logistic_type] || product.shipping_logistic_type;
        if(shippingLabel) {
            shippingMap.set(shippingLabel, (shippingMap.get(shippingLabel) || 0) + 1);
        }
        
        // Store Type
        if (product.is_official_store) {
            storeTypeMap.official++;
        } else {
            storeTypeMap.nonOfficial++;
        }

      });
  
      const dynFilters = Array.from(attributesMap.entries())
        .map(([id, { name, values }]) => ({
          id,
          name,
          options: Array.from(values.entries()).map(([optionName, count]) => ({ name: optionName, count })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const brandOpts = Array.from(brandMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
        
      const shippingOpts = Array.from(shippingMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { dynamicFilterOptions: dynFilters, brandOptions: brandOpts, shippingOptions: shippingOpts, storeTypeOptions: storeTypeMap };

    }, [state.result]);


    const filteredResults = useMemo(() => {
        if (!state.result) return [];
        return state.result.filter((p) => {
            // Active filter
            const activeMatch = !showOnlyActive || p.price > 0;
            if (!activeMatch) return false;
            
            // Dynamic attribute filters
            for(const filterId in activeFilters) {
                const filterValues = activeFilters[filterId];
                if(filterValues.length === 0) continue;
                
                const productAttribute = p.attributes.find(attr => attr.id === filterId);
                if (!productAttribute || !filterValues.includes(productAttribute.value_name || '')) {
                    return false;
                }
            }

            // Brand filter
            if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) {
                return false;
            }

            // Shipping filter
            const shippingLabel = freightMap[p.shipping_logistic_type] || p.shipping_logistic_type;
            if (selectedShipping.length > 0 && !selectedShipping.includes(shippingLabel)) {
                return false;
            }

            // Store type filter
            if (selectedStoreTypes.length > 0 && !selectedStoreTypes.includes(p.is_official_store ? 'official' : 'non-official')) {
                return false;
            }


            return true;
        });
    }, [state.result, activeFilters, showOnlyActive, selectedBrands, selectedShipping, selectedStoreTypes]);


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
            setState(result as any);
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
      setActiveFilters({}); // Reset dynamic filters on new search
      setSelectedBrands([]);
      setSelectedShipping([]);
      setSelectedStoreTypes([]);
      setBrandSearch('');
      setModelSearch('');
    }, [state.result]);

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

    const handleCreateListing = (product: ProductResult) => {
        setSelectedProduct(product);
        setIsCreateListingOpen(true);
    };

    return (
        <>
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
                        dynamicFilterOptions={dynamicFilterOptions}
                        brandOptions={brandOptions}
                        shippingOptions={shippingOptions}
                        storeTypeOptions={storeTypeOptions}
                        activeFilters={activeFilters}
                        selectedBrands={selectedBrands}
                        selectedShipping={selectedShipping}
                        selectedStoreTypes={selectedStoreTypes}
                        brandSearch={brandSearch}
                        modelSearch={modelSearch}
                        onFilterChange={(filterId, values) => {
                            setActiveFilters(prev => ({...prev, [filterId]: values}));
                        }}
                        onBrandChange={setSelectedBrands}
                        onShippingChange={setSelectedShipping}
                        onStoreTypeChange={setSelectedStoreTypes}
                        onBrandSearchChange={setBrandSearch}
                        onModelSearchChange={setModelSearch}
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
                                            <TableHead className="text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedResults.length > 0 ? paginatedResults.map(product => {
                                            const displayName = (product.name ?? "").trim() || "Produto do Mercado Livre";
                                            const repLevel = product.reputation?.level_id ? reputationLevelMap[product.reputation.level_id] : null;
                                            const shippingCost = getShippingCostFor1To2Kg(product.price);
                                            
                                            const rawPosted = (product as any).postedOnAccounts;
                                            const postedOnAccounts: PostedOnAccount[] = Array.isArray(rawPosted)
                                              ? rawPosted
                                              : rawPosted ? [rawPosted] : [];


                                            return (
                                                <TableRow key={product.id} className={cn("align-top", product.price === 0 && "opacity-50 bg-muted/50")}>
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
                                                        <div className="flex flex-col gap-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Link href={`https://www.mercadolivre.com.br/p/${product.catalog_product_id}`} target="_blank" className="font-semibold text-primary hover:underline">
                                                                {product.name} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                                </Link>
                                                                {postedOnAccounts.map((account, idx) => {
                                                                    const name = typeof account?.accountName === 'string'
                                                                        ? account.accountName
                                                                        : typeof (account as any)?.name === 'string'
                                                                        ? (account as any).name
                                                                        : typeof account === 'object'
                                                                        ? JSON.stringify(account)
                                                                        : String(account);
                                                                    
                                                                    const listingType = listingTypeMap[account.listingTypeId] || 'N/A';

                                                                    return (
                                                                        <Badge key={account.accountId ?? idx} className="bg-yellow-400 text-black hover:bg-yellow-500">
                                                                            <CheckCircle className="mr-1 h-3 w-3"/>
                                                                            {name}: <span className="font-bold ml-1">{listingType}</span>
                                                                        </Badge>
                                                                    );
                                                                })}
                                                            </div>
                                                            
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                              ID Anúncio: {product.catalog_product_id ?? "-"}
                                                            </div>

                                                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                <span>Criado em: {product.date_created ? new Date(product.date_created).toLocaleString('pt-BR') : "-"}</span>
                                                            </div>

                                                            <div className="text-xs text-muted-foreground mt-1">Marca: {product.brand || ''}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">Modelo: {product.model || ''}</div>

                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                Vendedor:
                                                                <Link
                                                                    href={`https://www.mercadolivre.com.br/perfil/${product.seller_nickname}`}
                                                                    target="_blank"
                                                                    className="text-blue-600 hover:underline ml-1"
                                                                >
                                                                    {product.seller_nickname}
                                                                </Link>
                                                                {(product.seller_city || product.seller_state) && (
                                                                    <span className="text-muted-foreground text-xs ml-1">
                                                                        ({product.seller_city} • {product.seller_state})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <Users className="h-3 w-3" />
                                                                <span><b>{Number.isFinite(product.offerCount) ? product.offerCount : 0}</b> ofertas</span>
                                                            </div>

                                                            {product.is_official_store && (
                                                                <Badge variant="secondary" className="mt-1.5 w-fit">Loja Oficial</Badge>
                                                            )}

                                                            <div className="mt-2 flex items-center gap-4 text-xs">
                                                                {repLevel && (
                                                                    <Badge style={{ backgroundColor: repLevel.color }} className="text-white text-xs">
                                                                        <repLevel.icon className="mr-1 h-3 w-3"/>
                                                                        {repLevel.label}
                                                                    </Badge>
                                                                )}
                                                                {product.rating_average > 0 && (
                                                                    <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                                                                        <Star className="h-4 w-4 fill-current"/>
                                                                        <span>{product.rating_average.toFixed(1)}</span>
                                                                        <span className="text-muted-foreground font-normal">({product.reviews_count} op.)</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
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
                                                                      <div className="text-muted-foreground flex items-center gap-x-2">
                                                                          {/* % SEM ARREDONDAR: vem do bruto */}
                                                                          {product.raw_data?.fees_data?.sale_fee_details?.percentage_fee != null && (
                                                                          <span className="text-xs">
                                                                              ({formatPercentNoRound(product.raw_data.fees_data.sale_fee_details.percentage_fee)})
                                                                          </span>
                                                                          )}

                                                                          {/* Comissão: pode continuar usando o calculado */}
                                                                          <span className="text-xs">
                                                                          Comissão: <b className="font-semibold text-foreground">{formatCurrency(product.fees.sale_fee_amount)}</b>
                                                                          </span>

                                                                          {/* Taxa fixa: usar sale_fee_details.fixed_fee; se não vier, cai pro listing_fee_amount */}
                                                                          <span className="text-xs">
                                                                          Taxa fixa:{' '}
                                                                          <b className="font-semibold text-foreground">
                                                                              {formatCurrency(
                                                                              product.raw_data?.fees_data?.sale_fee_details?.fixed_fee != null
                                                                                  ? toNumberSafe(product.raw_data.fees_data.sale_fee_details.fixed_fee)
                                                                                  : toNumberSafe(product.raw_data?.fees_data?.listing_fee_amount)
                                                                              )}
                                                                          </b>
                                                                          </span>
                                                                          {/* Custo de Frete Estimado */}
                                                                          {shippingCost !== null && (
                                                                            <span className="text-xs flex items-center gap-1">
                                                                              <Truck className="h-3 w-3" /> Frete:
                                                                              <b className="font-semibold text-foreground">{formatCurrency(shippingCost)}</b>
                                                                            </span>
                                                                          )}
                                                                      </div>
                                                                  )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-lg text-right align-top">
                                                      {formatCurrency(product.price)}
                                                    </TableCell>
                                                    <TableCell className="text-center align-middle">
                                                        {canCreateListing && (
                                                            <Button variant="secondary" size="sm" onClick={() => handleCreateListing(product)}>
                                                                <PlusCircle className="h-4 w-4 mr-2" />
                                                                Criar Anúncio
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center">
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
        
        {selectedProduct && (
            <CreateListingDialog
                isOpen={isCreateListingOpen}
                onClose={() => setIsCreateListingOpen(false)}
                product={selectedProduct}
                accounts={accounts}
            />
        )}
        </>
    );
}

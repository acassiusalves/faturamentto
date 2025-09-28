

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package, ExternalLink, Users, PackageCheck, Info, DollarSign, Tag, Truck, ShieldCheck, ShoppingCart, Hash, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { loadMyItems, loadMlAccounts } from '@/services/firestore';
import type { MyItem, MlAccount } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MercadoLivreIcon, FullIcon, CorreiosLogo, MercadoEnviosIcon, FreteGratisIcon } from '@/components/icons';


const getSku = (attributes: MyItem['attributes'] | MyItem['variations'][0]['attributes'], sellerCustomField: string | null) => {
    if (!Array.isArray(attributes)) {
        return sellerCustomField || 'N/A';
    }
    const skuAttribute = attributes.find(attr => attr.id === 'SELLER_SKU');
    return skuAttribute?.value_name || sellerCustomField || 'N/A';
};

export default function MeusAnunciosSalvosPage() {
    const [items, setItems] = useState<MyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    // Filters and pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [accounts, setAccounts] = useState<MlAccount[]>([]);
    

    useEffect(() => {
        async function fetchItems() {
            setIsLoading(true);
            try {
                const [savedItems, mlAccounts] = await Promise.all([
                    loadMyItems(),
                    loadMlAccounts()
                ]);
                setItems(savedItems);
                setAccounts(mlAccounts);
            } catch (error: any) {
                 toast({
                    variant: 'destructive',
                    title: 'Erro ao Carregar Anúncios',
                    description: error.message || 'Não foi possível buscar os anúncios do banco de dados.',
                });
            } finally {
                setIsLoading(false);
            }
        }
        fetchItems();
    }, [toast]);
    
    const accountMap = useMemo(() => {
        return new Map(accounts.map(acc => [acc.id, acc.nickname || acc.id]));
    }, [accounts]);
    
    const filteredItems = useMemo(() => {
        const filtered = items.filter(item => {
            const term = searchTerm.toLowerCase();
            const searchMatch = !term ||
                item.title?.toLowerCase().includes(term) ||
                item.id?.toLowerCase().includes(term) ||
                item.seller_custom_field?.toLowerCase().includes(term) ||
                item.catalog_product_id?.toLowerCase().includes(term) ||
                item.category_id?.toLowerCase().includes(term);

            return searchMatch;
        });
        
        return filtered;
    }, [items, searchTerm]);

    const pageCount = Math.ceil(filteredItems.length / pageSize);
    const paginatedItems = useMemo(() => {
        const startIndex = pageIndex * pageSize;
        return filteredItems.slice(startIndex, startIndex + pageSize);
    }, [filteredItems, pageIndex, pageSize]);

     useEffect(() => {
        if (pageIndex >= pageCount && pageCount > 0) {
            setPageIndex(pageCount - 1);
        } else if(pageCount === 0) {
            setPageIndex(0);
        }
    }, [filteredItems, pageIndex, pageCount]);


    if (isLoading) {
        return (
            <div className="flex flex-col gap-8 p-4 md:p-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Meus Anúncios Salvos</h1>
                    <p className="text-muted-foreground">Consulte os anúncios do Mercado Livre que foram salvos no banco de dados.</p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    <p className="ml-4">Carregando anúncios...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Meus Anúncios Salvos</h1>
                <p className="text-muted-foreground">Consulte os anúncios que foram salvos no banco de dados da coleção 'anuncios'.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Anúncios Armazenados</CardTitle>
                            <CardDescription>
                                Exibindo {filteredItems.length} de {items.length} anúncios salvos.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative">
                                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por título, ID ou SKU..." 
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full space-y-2">
                        {paginatedItems.map(item => {
                            const mainSku = getSku(item.attributes, item.seller_custom_field);
                            const dataSyncDate = item.data_sync ? new Date(item.data_sync).toLocaleString('pt-BR') : 'N/A';
                            const lastUpdatedDate = item.last_updated ? new Date(item.last_updated).toLocaleString('pt-BR') : 'N/A';
                            const accountName = accountMap.get(item.accountId) || item.accountId;

                            return (
                            <AccordionItem value={item.id} key={item.id}>
                               <Card>
                                 <AccordionTrigger className="w-full p-3 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left w-full">
                                         <div className="relative h-20 w-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                             <Image src={item.thumbnail} alt={item.title} fill className="object-contain" data-ai-hint="product image" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Link href={item.permalink} target="_blank" className="font-semibold text-primary hover:underline line-clamp-2" title={item.title}>
                                                {item.title} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                            </Link>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                                <div className='flex items-center gap-2'><MercadoLivreIcon className="h-5 w-auto text-yellow-400"/> <Badge variant="outline">{accountName}</Badge></div>
                                                <span>ID: <span className="font-mono">{item.id}</span></span>
                                                {mainSku !== 'N/A' && <span>| SKU: <span className="font-mono">{mainSku}</span></span>}
                                                {item.catalog_product_id && <span>| Catálogo: <span className="font-mono">{item.catalog_product_id}</span></span>}
                                            </div>
                                        </div>
                                         <div className="text-right">
                                            <p className="font-bold text-lg">{formatCurrency(item.price)}</p>
                                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={cn('mt-1', item.status === 'active' ? 'bg-green-600' : '')}>
                                                {item.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-2">
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <h4 className="font-semibold flex items-center gap-1.5"><Info /> Informações Gerais</h4>
                                            <p className="text-sm">Garantia: <span className="font-medium">{item.warranty || 'Não especificada'}</span></p>
                                            <p className="text-sm">Disponível: <span className="font-medium">{item.available_quantity} un.</span></p>
                                            <p className="text-sm">Vendidos: <span className="font-medium">{item.sold_quantity} un.</span></p>
                                            <p className="text-sm">Estoque Inicial: <span className="font-medium">{item.initial_quantity} un.</span></p>
                                            {item.accepts_mercadopago && <Badge variant="secondary">Aceita Mercado Pago</Badge>}
                                             <Badge variant={item.precificacao_automatica ? "default" : "secondary"}>
                                                <Power className="mr-2 h-3 w-3"/>
                                                Precificação Automática: {item.precificacao_automatica ? 'Ativada' : 'Desativada'}
                                            </Badge>
                                        </div>
                                         <div className="space-y-2">
                                            <h4 className="font-semibold flex items-center gap-1.5"><Calendar /> Datas e IDs</h4>
                                            <p className="text-sm">ID Conta: <span className="font-mono text-xs">{item.id_conta_autenticada}</span></p>
                                            <p className="text-sm">ID Vendedor: <span className="font-mono text-xs">{item.seller_id}</span></p>
                                            <p className="text-sm">ID Categoria: <span className="font-mono text-xs">{item.category_id}</span></p>
                                            <p className="text-sm">Sincronizado em: <span className="font-medium">{dataSyncDate}</span></p>
                                            <p className="text-sm">Última Atualização: <span className="font-medium">{lastUpdatedDate}</span></p>
                                        </div>
                                        <div className="space-y-2">
                                             <h4 className="font-semibold flex items-center gap-1.5"><Truck /> Frete</h4>
                                            <div className="flex items-center gap-2">
                                                {item.shipping?.logistic_type === 'fulfillment' && <FullIcon />}
                                                {item.shipping?.logistic_type === 'drop_off' && <CorreiosLogo />}
                                                {item.shipping?.logistic_type === 'cross_docking' && <MercadoEnviosIcon />}
                                                {item.shipping?.free_shipping && <FreteGratisIcon />}
                                            </div>
                                            <p className="text-sm">Modo: <span className="font-medium">{item.shipping?.mode || 'N/A'}</span></p>
                                            <div className="flex flex-wrap gap-1">
                                                {item.shipping?.tags?.map((tag: string) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                                            </div>
                                        </div>
                                        {item.variations?.length > 0 && (
                                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                                                <h4 className="font-semibold flex items-center gap-1.5"><PackageCheck /> Variações ({item.variations.length})</h4>
                                                <ScrollArea className="h-48 rounded-md border p-2 bg-muted/50">
                                                    <div className="space-y-3">
                                                    {item.variations.map(variation => {
                                                        const variationSku = getSku(variation.attributes, variation.seller_custom_field);
                                                        const variationName = variation.attribute_combinations.map(v => v.value_name).join(' / ');
                                                        return (
                                                            <div key={variation.id} className="text-xs p-2 border-b last:border-0">
                                                                <div className="font-semibold">{variationName}</div>
                                                                <div className="flex justify-between items-center text-muted-foreground">
                                                                    <span>SKU: <span className="font-mono text-foreground">{variationSku}</span></span>
                                                                    <span>Qtd: <span className="font-semibold text-foreground">{variation.available_quantity}</span></span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                   </div>
                                </AccordionContent>
                               </Card>
                            </AccordionItem>
                        )})}
                    </Accordion>
                </CardContent>
                <CardFooter className="flex items-center justify-between flex-wrap gap-4">
                    <div className="text-sm text-muted-foreground">
                        Total de {filteredItems.length} registros.
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
    )
}

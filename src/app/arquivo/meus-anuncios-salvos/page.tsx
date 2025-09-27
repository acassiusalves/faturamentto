
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package, ExternalLink, Users, PackageCheck, Info, DollarSign, Tag, Truck, ShieldCheck, ShoppingCart, Hash, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { loadMyItems } from '@/services/firestore';
import type { MyItem } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MeusAnunciosSalvosPage() {
    const [items, setItems] = useState<MyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    // Filters and pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [accountFilter, setAccountFilter] = useState('all');
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    

    useEffect(() => {
        async function fetchItems() {
            setIsLoading(true);
            try {
                const savedItems = await loadMyItems();
                setItems(savedItems);
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
    
    const { filteredItems, uniqueAccounts } = useMemo(() => {
        const accounts = new Set<string>();
        const filtered = items.filter(item => {
            accounts.add(item.accountId);
            const term = searchTerm.toLowerCase();
            const searchMatch = !term ||
                item.title.toLowerCase().includes(term) ||
                item.id.toLowerCase().includes(term) ||
                item.seller_custom_field?.toLowerCase().includes(term);
            
            const statusMatch = statusFilter === 'all' || item.status === statusFilter;
            const accountMatch = accountFilter === 'all' || item.accountId === accountFilter;

            return searchMatch && statusMatch && accountMatch;
        });
        return {
            filteredItems: filtered,
            uniqueAccounts: ['all', ...Array.from(accounts)]
        };
    }, [items, searchTerm, statusFilter, accountFilter]);

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
                <p className="text-muted-foreground">Consulte os anúncios do Mercado Livre que foram salvos no banco de dados.</p>
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
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Status</SelectItem>
                                    <SelectItem value="active">Ativo</SelectItem>
                                    <SelectItem value="paused">Pausado</SelectItem>
                                </SelectContent>
                            </Select>
                             <Select value={accountFilter} onValueChange={setAccountFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtrar por conta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueAccounts.map(acc => (
                                        <SelectItem key={acc} value={acc}>{acc === 'all' ? 'Todas as Contas' : acc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Anúncio</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Disponível</TableHead>
                                    <TableHead>Vendido</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedItems.length > 0 ? paginatedItems.map(item => (
                                     <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-4">
                                                <div className="relative h-16 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                                                     <Image src={item.thumbnail} alt={item.title} fill className="object-contain" data-ai-hint="product image" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <Link href={item.permalink} target="_blank" className="font-semibold text-primary hover:underline">
                                                        {item.title}
                                                        <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                                     </Link>
                                                     <div className="text-xs text-muted-foreground space-x-2">
                                                         <span className="font-mono">ID: {item.id}</span>
                                                         {item.seller_custom_field && <span className="font-mono">SKU: {item.seller_custom_field}</span>}
                                                     </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className={cn('mt-1', item.status === 'active' ? 'bg-green-600' : '')}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">{item.available_quantity}</TableCell>
                                        <TableCell className="text-center font-semibold">{item.sold_quantity}</TableCell>
                                        <TableCell className="text-right font-bold text-lg">{formatCurrency(item.price)}</TableCell>
                                    </TableRow>
                                )) : (
                                     <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Nenhum anúncio encontrado com os filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
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

    

"use client";

import { useState, useActionState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Package, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchMercadoLivreAction } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface ProductResult {
    thumbnail: string;
    name: string;
    status: string;
    catalog_product_id: string;
    id: string;
    brand: string;
    model: string;
    price: number;
    shipping_type: string;
    free_shipping: boolean;
    category_id: string;
    listing_type_id: string;
    seller_id: string;
    seller_nickname: string;
    official_store_id: string;
}

const initialSearchState = {
    result: null as ProductResult[] | null,
    error: null as string | null,
};

export default function BuscarMercadoLivrePage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [quantity, setQuantity] = useState(10);
    const [state, formAction, isSearching] = useActionState(searchMercadoLivreAction, initialSearchState);
    const [isTransitioning, startTransition] = useTransition();
    const [broken, setBroken] = useState<Set<string>>(new Set());

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
        startTransition(() => {
            const formData = new FormData();
            formData.append('productName', searchTerm);
            formData.append('quantity', String(quantity));
            formAction(formData);
        });
    };

    const isPending = isSearching || isTransitioning;

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
                        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                            {isPending ? <Loader2 className="animate-spin" /> : <Search />}
                            Buscar
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            {isPending && (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4">Buscando no Mercado Livre...</p>
                </div>
            )}
            
            {state?.result && !isPending && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Resultados da Busca ({state.result.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="rounded-md border overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Imagem</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Marca</TableHead>
                                        <TableHead>Modelo</TableHead>
                                        <TableHead>Preço</TableHead>
                                        <TableHead>Modalidade de Entrega</TableHead>
                                        <TableHead>Frete</TableHead>
                                        <TableHead>ID Categoria</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Loja Oficial</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.result.length > 0 ? state.result.map(product => {
                                        const displayName = (product.name ?? "").trim() || "Produto do Mercado Livre";
                                        return (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="w-16 h-16 bg-muted rounded-md overflow-hidden relative flex items-center justify-center">
                                                    {product.thumbnail && !broken.has(product.id) ? (
                                                        <Image 
                                                            src={product.thumbnail}
                                                            alt={displayName}
                                                            fill
                                                            sizes="64px"
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
                                                <div className="text-xs text-muted-foreground">ID Catálogo: {product.catalog_product_id}</div>
                                                <div className="text-xs text-muted-foreground">ID Anúncio: {product.id}</div>
                                            </TableCell>
                                            <TableCell><Badge variant={product.status === 'active' ? 'default' : 'destructive'} className={product.status === 'active' ? 'bg-green-600' : ''}>{product.status}</Badge></TableCell>
                                            <TableCell>{product.brand}</TableCell>
                                            <TableCell>{product.model}</TableCell>
                                            <TableCell className="font-semibold">{formatCurrency(product.price)}</TableCell>
                                            <TableCell>{product.shipping_type || '-'}</TableCell>
                                            <TableCell>
                                                {product.free_shipping && (
                                                    <Badge variant="secondary" className="ml-2">Grátis</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{product.category_id}</TableCell>
                                            <TableCell>{product.listing_type_id}</TableCell>
                                            <TableCell>{product.official_store_id ? `Sim (${product.official_store_id})` : 'Não'}</TableCell>
                                            <TableCell>
                                                <Link href={`https://www.mercadolivre.com.br/perfil/${product.seller_nickname}`} target="_blank" className="text-blue-600 hover:underline">
                                                    {product.seller_nickname}
                                                </Link>
                                                <div className="text-xs text-muted-foreground">ID: {product.seller_id}</div>
                                            </TableCell>
                                        </TableRow>
                                    )}) : (
                                        <TableRow>
                                            <TableCell colSpan={12} className="h-24 text-center">
                                                 <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                    <Package className="h-10 w-10 mb-2"/>
                                                    Nenhum produto encontrado para este termo.
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                 </Card>
            )}
            
            {state?.error && !isPending && (
                <div className="text-destructive font-semibold p-4 border border-destructive/50 rounded-md bg-destructive/10">
                    Erro: {state.error}
                </div>
            )}
        </main>
    );
}

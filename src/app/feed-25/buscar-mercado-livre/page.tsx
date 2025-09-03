
"use client";

import { useState, useActionState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { searchMercadoLivreAction } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';

interface ProductResult {
    thumbnail: string;
    name: string;
    status: string;
    catalog_product_id: string;
    id: string;
    brand: string;
    model: string;
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
                                        <TableHead>ID Catálogo</TableHead>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Marca</TableHead>
                                        <TableHead>Modelo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.result.length > 0 ? state.result.map(product => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="w-16 h-16 bg-muted rounded-md overflow-hidden relative">
                                                    <Image src={(product.thumbnail || '').replace('http://','https://')} alt={product.name} fill className="object-contain" data-ai-hint="product image" />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Link href={`https://www.mercadolivre.com.br/p/${product.catalog_product_id}`} target="_blank" className="font-semibold text-primary hover:underline">
                                                    {product.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{product.status}</TableCell>
                                            <TableCell className="font-mono">{product.catalog_product_id}</TableCell>
                                            <TableCell className="font-mono">{product.id}</TableCell>
                                            <TableCell>{product.brand}</TableCell>
                                            <TableCell>{product.model}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
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

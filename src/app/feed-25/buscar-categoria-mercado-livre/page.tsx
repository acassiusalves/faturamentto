
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { MLCategory } from '@/lib/ml';

export default function BuscarCategoriaMercadoLivrePage() {
    const [rootCats, setRootCats] = useState<MLCategory[]>([]);
    const [childCats, setChildCats] = useState<MLCategory[]>([]);
    const [selectedCat, setSelectedCat] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    async function fetchRootCategories() {
        setIsLoading(true);
        try {
            const response = await fetch('/api/ml/categories');
            const data = await response.json();
            setRootCats(data.categories || []);
        } catch (error) {
            console.error("Failed to fetch root categories:", error);
            setRootCats([]);
        } finally {
            setIsLoading(false);
        }
    }

    async function loadChildren(catId: string) {
        setIsLoading(true);
        try {
            const r = await fetch(`/api/ml/categories?parent=${catId}`);
            const data = await r.json();
            setSelectedCat(catId);
            setChildCats(data.categories || []);
        } catch (error) {
            console.error(`Failed to load children for ${catId}:`, error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Buscar Categoria no Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Navegue pelas categorias de produtos do Mercado Livre.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Iniciar Busca</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={fetchRootCategories} disabled={isLoading}>
                         {isLoading && rootCats.length === 0 ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         ) : null}
                        Listar Todas as Categorias
                    </Button>
                </CardContent>
            </Card>

            {isLoading && rootCats.length === 0 ? (
                 <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin text-primary" size={32}/>
                 </div>
            ) : rootCats.length > 0 && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-base">Categorias (Topo)</CardTitle>
                        <CardDescription>Escolha uma categoria para refinar sua busca</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {rootCats.map(c => (
                            <Button
                            key={c.id}
                            variant={selectedCat === c.id ? 'default' : 'secondary'}
                            size="sm"
                            onClick={() => loadChildren(c.id)}
                            disabled={isLoading}
                            >
                            {c.name}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            )}

            {selectedCat && (
                <Card className="border-dashed">
                    <CardHeader className="py-3">
                    <CardTitle className="text-base">Subcategorias</CardTitle>
                    <CardDescription>Refine ainda mais</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {isLoading && childCats.length === 0 ? (
                             <div className="flex justify-center items-center h-24 w-full">
                                <Loader2 className="animate-spin text-primary"/>
                             </div>
                        ) : childCats.length > 0 ? (
                            childCats.map(c => (
                                <Button
                                key={c.id}
                                variant="outline"
                                size="sm"
                                disabled={isLoading}
                                >
                                {c.name}
                                </Button>
                            ))
                        ) : (
                             <p className="text-sm text-muted-foreground">Nenhuma subcategoria encontrada.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </main>
    );
}

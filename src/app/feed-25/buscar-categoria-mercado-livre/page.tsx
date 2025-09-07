
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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // carrega topo na primeira renderização
        fetch('/api/ml/categories')
            .then(r => r.json())
            .then(data => setRootCats(data.categories || []))
            .catch(() => setRootCats([]))
            .finally(() => setIsLoading(false));
    }, []);

    async function loadChildren(catId: string) {
        setIsLoading(true);
        const r = await fetch(`/api/ml/categories?parent=${catId}`);
        const data = await r.json();
        setSelectedCat(catId);
        setChildCats(data.categories || []);
        setIsLoading(false);
    }

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Buscar Categoria no Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Navegue pelas categorias de produtos do Mercado Livre.
                </p>
            </div>

            {isLoading && rootCats.length === 0 ? (
                 <div className="flex justify-center items-center h-48">
                    <Loader2 className="animate-spin text-primary" size={32}/>
                 </div>
            ) : (
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
                        {isLoading ? (
                             <div className="flex justify-center items-center h-24 w-full">
                                <Loader2 className="animate-spin text-primary"/>
                             </div>
                        ) : childCats.length > 0 ? (
                            childCats.map(c => (
                                <Button
                                key={c.id}
                                variant="outline"
                                size="sm"
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

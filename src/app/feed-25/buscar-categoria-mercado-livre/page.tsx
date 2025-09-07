"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

export default function BuscarCategoriaMercadoLivrePage() {

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline">Buscar Categoria no Mercado Livre</h1>
                <p className="text-muted-foreground">
                    Esta página permitirá a busca e análise de categorias de produtos do Mercado Livre.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Busca por Categoria</CardTitle>
                    <CardDescription>
                        Funcionalidade em desenvolvimento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center items-center h-48 border-2 border-dashed rounded-lg">
                        <div className="text-center text-muted-foreground">
                            <Search className="h-12 w-12 mx-auto mb-4" />
                            <p>Em breve, você poderá buscar categorias aqui.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}


"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookImage } from 'lucide-react';

export default function CatalogoPdfPage() {

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <BookImage className="h-6 w-6" />
                        Gerador de Catálogo PDF
                    </CardTitle>
                    <CardDescription>
                        Esta página permitirá a criação de catálogos em PDF a partir dos produtos no seu feed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-semibold">Em Breve</h3>
                        <p className="text-muted-foreground">A funcionalidade para gerar catálogos em PDF estará disponível aqui.</p>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}

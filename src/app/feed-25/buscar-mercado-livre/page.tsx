
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BuscarMercadoLivrePage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) {
            toast({
                variant: 'destructive',
                title: 'Termo de busca vazio',
                description: 'Por favor, insira um termo para buscar.',
            });
            return;
        }
        setIsLoading(true);
        setResults(null);
        // Aqui virá a chamada para a API
        console.log(`Buscando por: ${searchTerm}`);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simula a busca
        
        // Placeholder for results
        setResults({ message: `Resultado da busca por "${searchTerm}" aparecerá aqui.` });

        setIsLoading(false);
    };

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
                        Insira um termo de busca e veja a resposta bruta da API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex items-end gap-4">
                        <div className="flex-grow space-y-2">
                            <Label htmlFor="search-term">Termo de Busca</Label>
                            <Input
                                id="search-term"
                                placeholder="Ex: Xiaomi Poco X6 Pro"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                            Buscar
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            {results && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Resultado da API (JSON)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                            <code>
                                {JSON.stringify(results, null, 2)}
                            </code>
                        </pre>
                    </CardContent>
                 </Card>
            )}
        </main>
    );
}

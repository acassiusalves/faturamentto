
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { MLCategory } from '@/lib/ml';
import { Badge } from '@/components/ui/badge';

export default function BuscarCategoriaMercadoLivrePage() {
  const [rootCats, setRootCats] = useState<MLCategory[]>([]);
  const [childCats, setChildCats] = useState<MLCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [trends, setTrends] = useState<{ keyword: string }[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  async function fetchRootCategories() {
    setIsLoading(true);
    setLastError(null);
    try {
      const response = await fetch('/api/ml/categories');
      const text = await response.text(); // <- pra inspecionar quando não for JSON
      try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
        setRootCats(data.categories || []);
      } catch (parseErr) {
        console.error('Resposta não JSON da API:', text);
        setLastError('A rota /api/ml/categories não retornou JSON. Verifique a estrutura do projeto.');
        setRootCats([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch root categories:", error);
      setLastError(error?.message || 'Erro ao carregar categorias.');
      setRootCats([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadChildren(catId: string) {
    setIsLoading(true);
    setLastError(null);
    try {
      const response = await fetch(`/api/ml/categories?parent=${catId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setSelectedCat(catId);
      setChildCats(data.categories || []);
    } catch (error: any) {
      console.error(`Failed to load children for ${catId}:`, error);
      setLastError(error?.message || 'Erro ao carregar subcategorias.');
    } finally {
      setIsLoading(false);
    }

    // carrega tendências em paralelo (com "climb" = 1 para fallback no pai)
    setIsLoadingTrends(true);
    try {
      const r = await fetch(`/api/ml/trends?category=${catId}&climb=1`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setTrends(j.trends || []);
    } catch (e: any) {
      console.error('Erro trends:', e);
      setTrends([]);
    } finally {
      setIsLoadingTrends(false);
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Buscar Categoria no Mercado Livre</h1>
        <p className="text-muted-foreground">Navegue pelas categorias de produtos do Mercado Livre.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Iniciar Busca</CardTitle>
          {lastError && <p className="text-xs text-red-500">{lastError}</p>}
        </CardHeader>
        <CardContent>
          <Button onClick={fetchRootCategories} disabled={isLoading}>
            {isLoading && rootCats.length === 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
        <>
          {/* Subcategorias (você já tem esse card) */}
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
                  <Button key={c.id} variant="outline" size="sm" onClick={() => loadChildren(c.id)}>
                    {c.name}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma subcategoria encontrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Tendências da categoria selecionada */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Tendências desta categoria</CardTitle>
              <CardDescription>Palavras mais buscadas pelos compradores</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {isLoadingTrends ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin h-4 w-4" /> Carregando tendências…
                </div>
              ) : trends.length > 0 ? (
                trends.slice(0, 24).map((t, i) => (
                  <Button
                    key={t.keyword + i}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // aqui você decide: abrir sua tela de busca usando esse termo,
                      // ou copiar para clipboard etc. Exemplo dispara uma rota de busca:
                      window.open(`/feed-25/buscar-mercado-livre?term=${encodeURIComponent(t.keyword)}`, '_blank');
                    }}
                  >
                    {t.keyword}
                  </Button>
                  // Se preferir "chips" use:
                  // <Badge key={...} variant="secondary" className="cursor-default">{t.keyword}</Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tendência encontrada para esta categoria (ou nos ancestrais).
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

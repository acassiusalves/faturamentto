"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, Home, ShoppingCart } from 'lucide-react';
import type { MLCategory } from '@/lib/ml';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency, cn } from '@/lib/utils';


// Interface para os itens mais vendidos
interface BestSellerItem {
  id: string;
  position: number | null;
  title: string;
  price: number;
  thumbnail: string;
  permalink: string;
}


export default function BuscarCategoriaMercadoLivrePage() {
  const [rootCats, setRootCats] = useState<MLCategory[]>([]);
  const [childCats, setChildCats] = useState<MLCategory[]>([]);
  const [ancestors, setAncestors] = useState<MLCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [trends, setTrends] = useState<{ keyword: string }[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([]);
  const [isLoadingBestSellers, setIsLoadingBestSellers] = useState(false);


  async function fetchRootCategories() {
    setIsLoading(true);
    setLastError(null);
    setChildCats([]);
    setAncestors([]);
    setSelectedCat(null);
    try {
      const response = await fetch('/api/ml/categories');
      const text = await response.text(); 
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
      setAncestors(data.ancestors || []);
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

    // Carrega os mais vendidos
    setIsLoadingBestSellers(true);
    try {
        const r = await fetch(`/api/ml/bestsellers?category=${catId}&limit=24`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        setBestSellers(j.items || []);
    } catch (e: any) {
        console.error('Erro bestsellers:', e);
        setBestSellers([]);
    } finally {
        setIsLoadingBestSellers(false);
    }

  }

  const handleReset = () => {
    setRootCats([]);
    setChildCats([]);
    setAncestors([]);
    setSelectedCat(null);
    setLastError(null);
    setTrends([]);
    setBestSellers([]);
  };

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
          {rootCats.length > 0 ? (
            <Button onClick={handleReset} variant="outline">
              <Home className="mr-2 h-4 w-4" /> Voltar ao Início
            </Button>
          ) : (
            <Button onClick={fetchRootCategories} disabled={isLoading}>
              {isLoading && rootCats.length === 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Listar Todas as Categorias
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading && rootCats.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="animate-spin text-primary" size={32}/>
        </div>
      ) : rootCats.length > 0 && ancestors.length === 0 ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Categorias Principais</CardTitle>
            <CardDescription>Escolha uma categoria para refinar sua busca</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {rootCats.map(c => (
              <Button
                key={c.id}
                variant={'secondary'}
                size="sm"
                onClick={() => loadChildren(c.id)}
                disabled={isLoading}
              >
                {c.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {selectedCat && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <div className="mb-2">
                    {ancestors.map((cat, index) => (
                      <React.Fragment key={cat.id}>
                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => loadChildren(cat.id)}>
                          {cat.name}
                        </Button>
                        {index < ancestors.length - 1 && <ChevronRight className="inline-block h-4 w-4 mx-1" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <CardTitle className="text-base">Subcategorias</CardTitle>
                  <CardDescription>Refine ainda mais sua busca.</CardDescription>
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
                          window.open(`/feed-25/buscar-mercado-livre?term=${encodeURIComponent(t.keyword)}`, '_blank');
                        }}
                      >
                        {t.keyword}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tendência encontrada para esta categoria (ou nos ancestrais).
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
            
             <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart /> Mais Vendidos na Categoria
                  </CardTitle>
                  <CardDescription>Produtos populares nesta categoria para inspiração.</CardDescription>
                </CardHeader>
                <CardContent>
                   {isLoadingBestSellers ? (
                      <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="animate-spin h-4 w-4" /> Carregando mais vendidos…
                      </div>
                    ) : bestSellers.length > 0 ? (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {bestSellers.map(item => (
                          <Link href={item.permalink} key={item.id} target="_blank" className="flex items-center gap-4 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                              <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  <Image 
                                      src={item.thumbnail}
                                      alt={item.title}
                                      fill
                                      sizes="64px"
                                      className="object-contain"
                                      data-ai-hint="product image"
                                  />
                              </div>
                               <div className="flex-grow min-w-0">
                                <p className="font-semibold text-sm leading-tight line-clamp-2" title={item.title}>{item.title}</p>
                                <Badge variant="outline" className="mt-1">#{item.position}</Badge>
                            </div>
                            <div className="font-bold text-primary text-lg">
                                {formatCurrency(item.price)}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        Nenhum item encontrado na lista de mais vendidos para esta categoria.
                      </p>
                    )}
                </CardContent>
             </Card>
        </div>
      )}
    </main>
  );
}

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, Home, ShoppingCart, Bot, ChevronsDown, ChevronsUp, FileText, TrendingUp, Sparkles, Save } from 'lucide-react';
import type { MLCategory, SavedMlAnalysis, MlAnalysisResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency, cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from '@/components/ui/progress';
import { saveMlAnalysis } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';


// Interface para os itens mais vendidos
interface BestSellerItem {
  id: string;
  position: number | null;
  title: string;
  price: number;
  thumbnail: string | null;
  permalink: string | null;
}

interface AutomatedResult {
    category: MLCategory;
    trends: { keyword: string }[];
    bestsellers: BestSellerItem[];
}


export default function BuscarCategoriaMercadoLivrePage() {
  const { toast } = useToast();
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
  
  // State for automation
  const [isAutomating, setIsAutomating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [automationProgress, setAutomationProgress] = useState(0);
  const [automationResults, setAutomationResults] = useState<AutomatedResult[]>([]);
  const [currentAutomationTask, setCurrentAutomationTask] = useState("");


  async function fetchRootCategories() {
    setIsLoading(true);
    setLastError(null);
    setChildCats([]);
    setAncestors([]);
    setSelectedCat(null);
    setAutomationResults([]);
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
  
  async function fetchCategoryData(catId: string): Promise<{ trends: { keyword: string }[], bestsellers: BestSellerItem[] }> {
    const [trendsResponse, bestsellersResponse] = await Promise.all([
        fetch(`/api/ml/trends?category=${catId}&climb=1`),
        fetch(`/api/ml/bestsellers?category=${catId}&limit=24`)
    ]);

    const trendsData = await trendsResponse.json();
    const bestsellersData = await bestsellersResponse.json();

    if (!trendsResponse.ok) console.error(`Erro trends para ${catId}:`, trendsData.error);
    if (!bestsellersResponse.ok) console.error(`Erro bestsellers para ${catId}:`, bestsellersData.error);

    return {
        trends: trendsData.trends || [],
        bestsellers: bestsellersData.items || []
    };
}


  async function loadChildren(catId: string) {
    setIsLoading(true);
    setLastError(null);
    setAutomationResults([]);
    try {
      const response = await fetch(`/api/ml/categories?parent=${catId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setSelectedCat(catId);
      setChildCats(data.categories || []);
      setAncestors(data.ancestors || []);
      
      const { trends, bestsellers } = await fetchCategoryData(catId);
      setTrends(trends);
      setBestSellers(bestsellers);

    } catch (error: any) {
      console.error(`Failed to load children for ${catId}:`, error);
      setLastError(error?.message || 'Erro ao carregar subcategorias.');
    } finally {
      setIsLoading(false);
    }
  }
  
   const runAutomation = async () => {
    if (!selectedCat) return;

    setIsAutomating(true);
    setAutomationProgress(0);
    setAutomationResults([]);
    setCurrentAutomationTask("Preparando análise…");

    // Quem é a "categoria principal"?
    // Se sua API retorna ancestors como caminho até a categoria atual,
    // o último item normalmente é a própria categoria selecionada.
    const mainCategory =
      ancestors.length > 0
        ? ancestors[ancestors.length - 1]
        : childCats.find(c => c.id === selectedCat) ?? { id: selectedCat, name: "Categoria selecionada" } as MLCategory;

    // ⚠️ Busque os dados da categoria principal AGORA (não use o estado)!
    setCurrentAutomationTask(`Coletando dados: ${mainCategory.name}`);
    const { trends: mainTrends, bestsellers: mainBestsellers } = await fetchCategoryData(mainCategory.id);

    // Salve a categoria principal como 1º resultado
    setAutomationResults([{ category: mainCategory, trends: mainTrends, bestsellers: mainBestsellers }]);

    // Agora processe as subcategorias
    const categoriesToProcess = [...childCats];
    const totalSteps = categoriesToProcess.length;
    for (let i = 0; i < totalSteps; i++) {
      const subCat = categoriesToProcess[i];
      try {
        setCurrentAutomationTask(`Analisando: ${subCat.name}`);
        const { trends, bestsellers } = await fetchCategoryData(subCat.id);

        setAutomationResults(prev => [...prev, { category: subCat, trends, bestsellers }]);
      } catch (e) {
        console.error(`Falha ao buscar dados para ${subCat.name}:`, e);
        // opcional: ainda assim, acrescente a subcategoria com arrays vazios:
        setAutomationResults(prev => [...prev, { category: subCat, trends: [], bestsellers: [] }]);
      }

      setAutomationProgress(((i + 1) / Math.max(totalSteps, 1)) * 100);
      await new Promise(r => setTimeout(r, 300));
    }

    setCurrentAutomationTask("Análise concluída!");
    setIsAutomating(false);
  };
  
    const automationTotals = useMemo(() => {
        if (automationResults.length === 0) {
            return { totalTrends: 0, totalBestsellers: 0 };
        }
    
        const totalTrends = automationResults.reduce((acc, result) => acc + (result.trends?.length || 0), 0);
        const totalBestsellers = automationResults.reduce((acc, result) => acc + (result.bestsellers?.length || 0), 0);
    
        return { totalTrends, totalBestsellers };
    }, [automationResults]);

    const handleSaveAnalysis = async () => {
        if (automationResults.length === 0) {
            toast({ variant: 'destructive', title: 'Nenhum dado para salvar' });
            return;
        }

        setIsSaving(true);
        try {
            const mainCategory = automationResults[0].category;
            const dataToSave: Omit<SavedMlAnalysis, 'id'> = {
                createdAt: new Date().toISOString(),
                mainCategoryId: mainCategory.id,
                mainCategoryName: mainCategory.name,
                results: automationResults.map(r => ({
                    category: r.category,
                    trends: r.trends,
                    bestsellers: r.bestsellers,
                })),
            };
            await saveMlAnalysis(dataToSave);
            toast({
                title: 'Análise Salva!',
                description: 'Você pode consultar os dados na página de Arquivo -> Dados Mercado Livre.',
            });
        } catch (error) {
            console.error('Failed to save analysis:', error);
            toast({ variant: 'destructive', title: 'Erro ao Salvar', description: 'Não foi possível salvar a análise.' });
        } finally {
            setIsSaving(false);
        }
    };


  const handleReset = () => {
    setRootCats([]);
    setChildCats([]);
    setAncestors([]);
    setSelectedCat(null);
    setLastError(null);
    setTrends([]);
    setBestSellers([]);
    setAutomationResults([]);
    setIsAutomating(false);
    setAutomationProgress(0);
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
                   <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base">Subcategorias</CardTitle>
                        <CardDescription>Refine sua busca ou analise todas abaixo.</CardDescription>
                    </div>
                     <Button onClick={runAutomation} disabled={isAutomating || childCats.length === 0}>
                        {isAutomating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                        Analisar Subcategorias
                    </Button>
                  </div>
                   {isAutomating && (
                        <div className="pt-4 space-y-2">
                            <Progress value={automationProgress} />
                            <p className="text-xs text-center text-muted-foreground">{currentAutomationTask}</p>
                        </div>
                    )}
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
                  <CardTitle className="text-base">Tendências da Categoria Principal</CardTitle>
                  <CardDescription>Palavras mais buscadas em "{ancestors[ancestors.length - 1]?.name}"</CardDescription>
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
                    <ShoppingCart /> Mais Vendidos na Categoria Principal
                  </CardTitle>
                  <CardDescription>Produtos populares em "{ancestors[ancestors.length - 1]?.name}" para inspiração.</CardDescription>
                </CardHeader>
                <CardContent>
                   {isLoadingBestSellers ? (
                      <div className="flex items-center justify-center h-48 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="animate-spin h-4 w-4" /> Carregando mais vendidos…
                      </div>
                    ) : bestSellers.length > 0 ? (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {bestSellers.map(item => {
                          const cardInner = (
                            <>
                              <div className="relative h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                {item.thumbnail ? (
                                  <Image
                                    src={item.thumbnail}
                                    alt={item.title}
                                    fill
                                    sizes="64px"
                                    className="object-contain"
                                    data-ai-hint="product image"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">sem foto</div>
                                )}
                              </div>

                              <div className="flex-grow min-w-0">
                                <p className="font-semibold text-sm leading-tight line-clamp-2" title={item.title}>
                                  {item.title}
                                </p>
                                {item.position != null && <Badge variant="outline" className="mt-1">#{item.position}</Badge>}
                              </div>

                              <div className="font-bold text-primary text-lg">
                                {formatCurrency(item.price)}
                              </div>
                            </>
                          );

                          return item.permalink ? (
                            <Link
                              href={item.permalink}
                              key={item.id}
                              target="_blank"
                              className="flex items-center gap-4 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                              {cardInner}
                            </Link>
                          ) : (
                            <div
                              key={item.id}
                              className="flex items-center gap-4 p-2 rounded-lg border bg-card"
                              title="Sem link disponível"
                            >
                              {cardInner}
                            </div>
                          );
                        })}
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

        {automationResults.length > 0 && (
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                <Sparkles className="text-primary"/>
                                Análise Automatizada de Subcategorias
                            </CardTitle>
                            <CardDescription>
                                Resultados da busca por tendências e mais vendidos em todas as subcategorias de "{ancestors[ancestors.length - 1]?.name}".
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-medium whitespace-nowrap">
                            <Badge variant="outline">Total de Tendências: {automationTotals.totalTrends}</Badge>
                            <Badge variant="outline">Total de Anúncios: {automationTotals.totalBestsellers}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full space-y-4">
                        {automationResults.map(({ category, trends, bestsellers }) => (
                            <AccordionItem value={category.id} key={category.id} className="border-b-0">
                                <Card>
                                     <AccordionTrigger className="p-4 hover:no-underline font-semibold text-lg w-full justify-between">
                                        {category.name}
                                        <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                                            <span>{trends.length} tendências</span>
                                            <span>{bestsellers.length} mais vendidos</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-0">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><TrendingUp/> Tendências</h4>
                                                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px]">
                                                    {trends.length > 0 ? trends.map(t => <Badge key={t.keyword} variant="secondary">{t.keyword}</Badge>) : <p className="text-xs text-muted-foreground">Nenhuma tendência encontrada.</p>}
                                                </div>
                                            </div>
                                             <div>
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><ShoppingCart/> Mais Vendidos</h4>
                                                <div className="space-y-2 p-2 border rounded-md max-h-80 overflow-y-auto">
                                                    {bestsellers.length > 0 ? bestsellers.map(item => (
                                                        <div key={item.id} className="flex items-center gap-2 text-sm">
                                                            <span className="font-bold w-6 text-right">#{item.position}</span>
                                                            <p className="flex-1 truncate" title={item.title}>{item.title}</p>
                                                            <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                                                        </div>
                                                    )) : <p className="text-xs text-muted-foreground">Nenhum item encontrado.</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </Card>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleSaveAnalysis} disabled={isSaving}>
                         {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salvar Análise
                    </Button>
                </CardFooter>
            </Card>
        )}
    </main>
  );
}

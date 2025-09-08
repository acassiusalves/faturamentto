
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Loader2, TrendingUp, ShoppingCart } from 'lucide-react';
import type { SavedMlAnalysis } from '@/lib/types';
import { loadMlAnalyses } from '@/services/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export default function DadosMercadoLivrePage() {
  const [analyses, setAnalyses] = useState<SavedMlAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    const data = await loadMlAnalyses();
    setAnalyses(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const formatDate = (isoDate: string) => {
    try {
        return format(new Date(isoDate), "'Análise de' dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return "Data inválida";
    }
  };
  
  if (isLoading) {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Dados Salvos do Mercado Livre</h1>
                <p className="text-muted-foreground">Consulte e gerencie os dados salvos das suas análises.</p>
            </div>
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground rounded-lg">
                <Loader2 className="h-16 w-16 mb-4 animate-spin" />
                <p>Carregando análises salvas...</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Dados Salvos do Mercado Livre</h1>
        <p className="text-muted-foreground">
          Consulte e gerencie os dados salvos das suas análises de categoria do Mercado Livre.
        </p>
      </div>

       {analyses.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-4">
                {analyses.map(analysis => (
                    <AccordionItem value={analysis.id} key={analysis.id} className="border-b-0">
                        <Card>
                            <AccordionTrigger className="p-4 hover:no-underline font-semibold text-lg w-full justify-between">
                                <div>
                                    <span className="text-primary">{analysis.mainCategoryName}</span>
                                    <p className="text-sm font-normal text-muted-foreground">{formatDate(analysis.createdAt)}</p>
                                </div>
                                <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                                    <span>{analysis.results.length} subcategorias</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                {analysis.results.map(result => (
                                    <Card key={result.category.id} className="mb-4">
                                        <CardHeader>
                                            <CardTitle>{result.category.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><TrendingUp/> Tendências</h4>
                                                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px]">
                                                    {result.trends.length > 0 ? result.trends.map(t => <Badge key={t.keyword} variant="secondary">{t.keyword}</Badge>) : <p className="text-xs text-muted-foreground">Nenhuma tendência encontrada.</p>}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><ShoppingCart/> Mais Vendidos</h4>
                                                <div className="space-y-2 p-2 border rounded-md max-h-80 overflow-y-auto">
                                                    {result.bestsellers.length > 0 ? result.bestsellers.map(item => (
                                                        <div key={item.id} className="flex items-center gap-2 text-sm">
                                                            <span className="font-bold w-6 text-right">#{item.position}</span>
                                                            <p className="flex-1 truncate" title={item.title}>{item.title}</p>
                                                            <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                                                        </div>
                                                    )) : <p className="text-xs text-muted-foreground">Nenhum item encontrado.</p>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <Card>
                <CardHeader>
                    <CardTitle>Nenhuma Análise Salva</CardTitle>
                    <CardDescription>
                        Ainda não há dados salvos da ferramenta "Buscar Categoria no Mercado Livre".
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Database className="h-16 w-16 mb-4" />
                        <p className="font-semibold">Nenhum dado salvo ainda.</p>
                        <p>Vá para a página de busca para realizar e salvar uma análise.</p>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}

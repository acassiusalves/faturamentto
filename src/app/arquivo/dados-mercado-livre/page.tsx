
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Loader2, TrendingUp, ShoppingCart, Trash2, Search } from 'lucide-react';
import type { SavedMlAnalysis } from '@/lib/types';
import { loadMlAnalyses, deleteMlAnalysis } from '@/services/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export default function DadosMercadoLivrePage() {
  const [analyses, setAnalyses] = useState<SavedMlAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    const data = await loadMlAnalyses();
    setAnalyses(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const filteredAnalyses = useMemo(() => {
    if (!searchTerm.trim()) {
        return analyses;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return analyses.filter(analysis => 
        analysis.mainCategoryName.toLowerCase().includes(lowercasedTerm) ||
        analysis.results.some(result => 
            result.category.name.toLowerCase().includes(lowercasedTerm) ||
            result.trends.some(trend => 
                trend.keyword.toLowerCase().includes(lowercasedTerm)
            )
        )
    );
  }, [analyses, searchTerm]);
  
  const handleDelete = async (id: string) => {
      try {
          await deleteMlAnalysis(id);
          setAnalyses(prev => prev.filter(item => item.id !== id));
          toast({
              title: "Análise Apagada!",
              description: "A análise foi removida com sucesso.",
          });
      } catch (error) {
           toast({
              variant: "destructive",
              title: "Erro ao Apagar",
              description: "Não foi possível remover a análise.",
          });
      }
  }

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
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold font-headline">Dados Salvos do Mercado Livre</h1>
            <p className="text-muted-foreground">
              Consulte e gerencie os dados salvos das suas análises de categoria do Mercado Livre.
            </p>
        </div>
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
                placeholder="Buscar por tendência ou categoria..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

       {filteredAnalyses.length > 0 ? (
            <Accordion type="multiple" className="w-full space-y-4">
                {filteredAnalyses.map(analysis => (
                    <AccordionItem value={analysis.id} key={analysis.id} className="border-b-0">
                        <Card>
                             <div className="flex items-center w-full p-4">
                                <AccordionTrigger className="p-0 hover:no-underline flex-1">
                                    <div className="flex justify-between items-center w-full">
                                        <div>
                                            <span className="text-primary font-semibold text-lg">{analysis.mainCategoryName}</span>
                                            <p className="text-sm font-normal text-muted-foreground">{formatDate(analysis.createdAt)}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                                            <span>{analysis.results.length} subcategorias</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="ml-4 text-destructive hover:text-destructive flex-shrink-0" onClick={e => e.stopPropagation()}>
                                            <Trash2 />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Apagar Análise?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação removerá permanentemente os dados da análise de "{analysis.mainCategoryName}". Deseja continuar?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(analysis.id)}>Sim, Apagar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>

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
                                                        <div key={item.id} className="flex flex-col items-start gap-1 text-sm p-2 rounded-md bg-muted/50">
                                                            <div className="flex justify-between w-full">
                                                                <span className="font-bold w-6 text-left">#{item.position}</span>
                                                                <p className="flex-1 truncate font-semibold" title={item.title}>{item.title}</p>
                                                                <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                                                            </div>
                                                            {item.model && <Badge variant="outline" className="ml-7">Modelo: {item.model}</Badge>}
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
                    <CardTitle>Nenhuma Análise Encontrada</CardTitle>
                    <CardDescription>
                        Não foram encontrados resultados para o termo "{searchTerm}".
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Database className="h-16 w-16 mb-4" />
                        <p className="font-semibold">Nenhum dado encontrado.</p>
                        <p>Tente um termo de busca diferente ou realize uma nova análise na página de <Link href="/feed-25/buscar-categoria-mercado-livre" className="underline font-semibold">Busca de Categorias</Link>.</p>
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );
}

    
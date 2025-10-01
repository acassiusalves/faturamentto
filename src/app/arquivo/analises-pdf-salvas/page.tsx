
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Archive, ArchiveRestore, PackageSearch, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { SavedPdfAnalysis } from '@/lib/types';
import { loadPdfAnalyses, deletePdfAnalysis } from '@/services/firestore';
import { useRouter } from 'next/navigation';

export default function AnalisesPdfSalvasPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [analyses, setAnalyses] = useState<SavedPdfAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAnalyses = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await loadPdfAnalyses();
            setAnalyses(data);
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Erro ao Carregar Análises",
                description: "Não foi possível buscar os dados salvos."
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAnalyses();
    }, [fetchAnalyses]);

    const handleDelete = async (analysisId: string) => {
        try {
            await deletePdfAnalysis(analysisId);
            setAnalyses(prev => prev.filter(a => a.id !== analysisId));
            toast({
                title: "Análise Apagada!",
                description: "O registro da análise foi removido com sucesso."
            });
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Erro ao Apagar",
                description: "Não foi possível apagar a análise selecionada."
            });
        }
    };
    
    const handleLoadAnalysis = (analysis: SavedPdfAnalysis) => {
        try {
            localStorage.setItem('loadedPdfAnalysis', JSON.stringify(analysis));
            router.push('/feed-25/analise-produtos-pdf');
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao Carregar",
                description: "Não foi possível carregar os dados no armazenamento local. O arquivo pode ser muito grande."
            });
        }
    };

    const formatDate = (isoDate: string) => {
        try {
            return format(parseISO(isoDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return "Data inválida";
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="animate-spin" />
                <p className="ml-2">Carregando análises salvas...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Análises de PDF Salvas</h1>
                <p className="text-muted-foreground">
                    Consulte e gerencie suas análises de catálogos PDF salvas anteriormente.
                </p>
            </div>

            {analyses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {analyses.map(analysis => (
                        <Card key={analysis.id}>
                            <CardHeader>
                                <CardTitle className="truncate">{analysis.analysisName}</CardTitle>
                                <CardDescription>
                                    Salva em: {formatDate(analysis.createdAt)}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                               <div className="flex justify-between">
                                  <span className="text-muted-foreground">Marca:</span>
                                  <Badge variant="outline">{analysis.brand || 'N/A'}</Badge>
                               </div>
                               <div className="flex justify-between">
                                  <span className="text-muted-foreground">Produtos Extraídos:</span>
                                  <Badge variant="secondary">{analysis.extractedProducts.length}</Badge>
                               </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Resultados ML:</span>
                                  <Badge variant="secondary">{analysis.batchSearchResults.length}</Badge>
                               </div>
                            </CardContent>
                            <CardFooter className="flex justify-end gap-2">
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4" /> Apagar
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Apagar esta análise?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação não pode ser desfeita e removerá permanentemente os dados da análise "{analysis.analysisName}".
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(analysis.id)}>Sim, Apagar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button size="sm" onClick={() => handleLoadAnalysis(analysis)}>
                                    <ArchiveRestore className="mr-2 h-4 w-4" /> Carregar
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                 <Card>
                    <CardHeader>
                        <CardTitle>Nenhuma Análise Salva</CardTitle>
                        <CardDescription>
                            Você ainda não salvou nenhuma análise de catálogo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <PackageSearch className="h-16 w-16 mb-4" />
                            <p className="font-semibold">Nenhuma análise encontrada.</p>
                            <p>Vá para a página de <Link href="/feed-25/analise-produtos-pdf" className="underline font-semibold">Análise de PDF</Link> para começar.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    

    
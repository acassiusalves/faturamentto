
"use client";

import { useState, useActionState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookImage, Loader2, Upload, FileText, XCircle, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeCatalogAction } from '@/app/actions';
import type { AnalyzeCatalogOutput } from '@/lib/types';
import Image from 'next/image';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const initialState: {
  result: AnalyzeCatalogOutput | null;
  error: string | null;
} = {
  result: null,
  error: null,
};

export default function CatalogoPdfPage() {
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [state, formAction, isAnalyzing] = useActionState(analyzeCatalogAction, initialState);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
        } else {
            toast({
                variant: 'destructive',
                title: 'Arquivo Inválido',
                description: 'Por favor, selecione um arquivo PDF.',
            });
            setFile(null);
        }
    };
    
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file) {
            toast({ variant: 'destructive', title: 'Nenhum arquivo selecionado' });
            return;
        }

        setIsParsing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const textContents: string[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
                textContents.push(pageText);
            }
            
            const fullText = textContents.join('\n\n--- Page Break ---\n\n');
            
            const formData = new FormData();
            formData.append('pdfContent', fullText);
            formAction(formData);

        } catch (error) {
            console.error("Error parsing PDF:", error);
            toast({ variant: 'destructive', title: 'Erro ao ler PDF', description: 'Não foi possível processar o arquivo.' });
        } finally {
            setIsParsing(false);
        }
    };

    const isProcessing = isParsing || isAnalyzing;

    return (
        <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <BookImage className="h-6 w-6" />
                        Análise de Catálogo PDF
                    </CardTitle>
                    <CardDescription>
                       Faça o upload do seu catálogo em PDF e a IA irá extrair e listar os produtos para você.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pdf-upload">Arquivo do Catálogo (.pdf)</Label>
                            <div className="flex gap-4">
                                <Input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
                                <Button type="submit" disabled={!file || isProcessing}>
                                    {isProcessing ? <Loader2 className="animate-spin" /> : <Upload />}
                                    Analisar
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {isProcessing && (
                <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="ml-4 text-muted-foreground">{isParsing ? 'Lendo arquivo PDF...' : 'Analisando produtos com IA...'}</p>
                </div>
            )}
            
            {state.error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                    <XCircle />
                    <div>
                        <h4 className="font-semibold">Erro na Análise</h4>
                        <p>{state.error}</p>
                    </div>
                </div>
            )}

            {state.result && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText />
                            Produtos Extraídos ({state.result.products.length})
                        </CardTitle>
                         <CardDescription>
                            Abaixo estão os produtos que a IA conseguiu extrair do catálogo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {state.result.products.length > 0 ? (
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {state.result.products.map((product, index) => (
                                    <Card key={index} className="overflow-hidden">
                                        <div className="relative w-full h-40 bg-muted flex items-center justify-center">
                                            <ImageIcon className="text-muted-foreground" size={48} />
                                             <Image
                                                src={product.imageUrl || `https://picsum.photos/seed/${product.name}/400/400`}
                                                alt={product.name}
                                                fill
                                                className="object-cover"
                                                data-ai-hint="product image"
                                            />
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold h-10 line-clamp-2">{product.name}</h3>
                                            <p className="text-sm text-muted-foreground h-16 line-clamp-3 my-2">{product.description}</p>
                                            <div className="text-lg font-bold text-primary mt-2">
                                                {product.price ? `R$ ${product.price}` : 'Preço não encontrado'}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                <h3 className="text-lg font-semibold">Nenhum produto encontrado</h3>
                                <p>A IA não conseguiu extrair nenhum produto do PDF enviado.</p>
                            </div>
                        )}
                    </CardContent>
                 </Card>
            )}
        </main>
    );
}

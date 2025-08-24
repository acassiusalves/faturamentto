
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, FileText, BadgeCheck } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';

export default function AnunciosPage() {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Erro ao processar o arquivo',
            description: 'Verifique se o formato do CSV está correto.',
          });
          console.error("CSV Errors:", results.errors);
        }
        setHeaders(results.meta.fields || []);
        setData(results.data);
        setIsLoading(false);
        toast({
            title: 'Arquivo Processado!',
            description: `${results.data.length} anúncios foram carregados de ${file.name}.`
        })
      },
      error: (error) => {
        toast({
            variant: 'destructive',
            title: 'Falha no Upload',
            description: error.message
        });
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Gerenciador de Anúncios</h1>
        <p className="text-muted-foreground">
          Importe e visualize os anúncios dos seus canais de venda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
             <Card>
                <CardHeader>
                <CardTitle>Importar Planilha</CardTitle>
                <CardDescription>
                    Selecione o arquivo CSV de anúncios exportado do seu marketplace.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Label htmlFor="csv-upload" className={!fileName ? "cursor-pointer" : ""}>
                            <Button asChild className="w-full" variant={fileName ? "secondary" : "default"}>
                                <div>
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                    )}
                                    {isLoading ? 'Processando...' : (fileName ? 'Trocar Arquivo' : 'Escolher Arquivo CSV')}
                                </div>
                            </Button>
                        </Label>
                        <Input
                            id="csv-upload"
                            type="file"
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileUpload}
                            disabled={isLoading}
                        />
                        {fileName && !isLoading && (
                            <div className="text-sm text-center text-green-600 flex items-center justify-center gap-2 font-medium">
                                <BadgeCheck className="h-5 w-5"/>
                                <span>{fileName}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Visualização dos Anúncios</CardTitle>
                    <CardDescription>
                        Pré-visualização dos dados carregados da sua planilha.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {data.length > 0 ? (
                        <div className="rounded-md border max-h-[60vh] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card">
                                    <TableRow>
                                        {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((row, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                            {headers.map(header => <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>)}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            <FileText className="h-16 w-16 mb-4" />
                            <p>Os dados aparecerão aqui após o upload.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

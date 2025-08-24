
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, FileText, BadgeCheck } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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
    
    const reader = new FileReader();

    reader.onload = (e) => {
        const fileContent = e.target?.result;
        if (!fileContent) {
             toast({
                variant: 'destructive',
                title: 'Erro ao ler o arquivo',
                description: 'Não foi possível ler o conteúdo do arquivo.',
            });
            setIsLoading(false);
            return;
        }

        try {
            let parsedData: any[] = [];
            let parsedHeaders: string[] = [];

            if (file.name.endsWith('.csv')) {
                const result = Papa.parse(fileContent as string, {
                    header: true,
                    skipEmptyLines: true,
                });
                 if (result.errors.length > 0) {
                    throw new Error('Erro ao processar o arquivo CSV.');
                }
                parsedData = result.data;
                parsedHeaders = result.meta.fields || [];

            } else if (file.name.endsWith('.xlsx')) {
                const workbook = XLSX.read(fileContent, { type: 'binary' });
                const productSheet = workbook.Sheets['PRODUTO'];
                const stockSheet = workbook.Sheets['ESTOQUE'];
                const priceSheet = workbook.Sheets['PREÇO'];
                const policySheet = workbook.Sheets['Políticas e Relevância'];


                if (!productSheet || !stockSheet || !priceSheet || !policySheet) {
                    throw new Error("O arquivo XLSX deve conter as abas 'PRODUTO', 'ESTOQUE', 'PREÇO' e 'Políticas e Relevância'.");
                }
                
                const productData = XLSX.utils.sheet_to_json(productSheet);
                const stockData = XLSX.utils.sheet_to_json(stockSheet);
                const priceData = XLSX.utils.sheet_to_json(priceSheet);
                const policyData = XLSX.utils.sheet_to_json(policySheet);


                const stockMap = new Map(stockData.map((item: any) => [item.SKU, item]));
                const priceMap = new Map(priceData.map((item: any) => [item.SKU, item]));
                const policyMap = new Map(policyData.map((item: any) => [item.SKU, item]));


                const mergedData = productData.map((product: any) => {
                    const stockInfo = stockMap.get(product.SKU) || {};
                    const priceInfo = priceMap.get(product.SKU) || {};
                    const policyInfo = policyMap.get(product.SKU) || {};

                    return { ...product, ...stockInfo, ...priceInfo, ...policyInfo };
                });
                
                parsedData = mergedData;
                
                // Get all unique headers from the merged data
                const allHeaders = new Set<string>();
                mergedData.forEach(row => {
                    Object.keys(row).forEach(key => allHeaders.add(key));
                });
                parsedHeaders = Array.from(allHeaders);
                
            } else {
                 throw new Error('Formato de arquivo não suportado. Por favor, use .csv ou .xlsx');
            }
            
            setHeaders(parsedHeaders);
            setData(parsedData);
            toast({
                title: 'Arquivo Processado!',
                description: `${parsedData.length} anúncios foram carregados de ${file.name}.`
            });

        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Falha no Upload',
                description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.'
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
        reader.readAsBinaryString(file);
    } else {
        toast({
            variant: 'destructive',
            title: 'Formato Inválido',
            description: 'Por favor, selecione um arquivo .csv ou .xlsx.',
        });
        setIsLoading(false);
    }
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
                    Selecione o arquivo CSV ou XLSX de anúncios exportado do seu marketplace.
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
                                    {isLoading ? 'Processando...' : (fileName ? 'Trocar Arquivo' : 'Escolher Arquivo')}
                                </div>
                            </Button>
                        </Label>
                        <Input
                            id="csv-upload"
                            type="file"
                            className="hidden"
                            accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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

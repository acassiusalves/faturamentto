"use client";

import { useState } from 'react';
import type { InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConferenceResult {
  found: InventoryItem[];
  notFound: string[];
  notScanned: InventoryItem[];
}

export function IndividualConference() {
  const [scannedSns, setScannedSns] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ConferenceResult | null>(null);

  const handleSearch = async () => {
    setIsLoading(true);
    setResults(null);
    await new Promise((res) => setTimeout(res, 1500)); // Simulate API call
    
    // MOCK DATA - This will be replaced with Firestore logic
    const mockResults: ConferenceResult = {
        found: [
            { id: '1', name: 'Xiaomi Redmi 14C 256GB', sku: '#09P', serialNumber: '58583;655P12851', quantity: 1, costPrice: 715, createdAt: new Date().toISOString(), origin: 'Nacional', productId: 'p1' },
            { id: '2', name: 'Xiaomi Redmi 14C 256GB', sku: '#09P', serialNumber: '58583;655N00287', quantity: 1, costPrice: 715, createdAt: new Date().toISOString(), origin: 'Nacional', productId: 'p1' },
        ],
        notFound: ['INVALIDSN123', 'ANOTHERSN456'],
        notScanned: [
             { id: '3', name: 'Xiaomi Note 14 256GB', sku: '#11V', serialNumber: '61626;W5QC03207', quantity: 1, costPrice: 940, createdAt: new Date().toISOString(), origin: 'Nacional', productId: 'p2' },
        ]
    };
    
    setResults(mockResults);
    setIsLoading(false);
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });

  const ResultTable = ({ items }: { items: InventoryItem[] }) => (
      <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>SN</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.length > 0 ? items.map(item => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">
                            <div className="flex flex-col">
                                <span>{item.name}</span>
                                <span className="text-xs text-muted-foreground">Adicionado em: {formatDate(item.createdAt)}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell className="font-mono text-xs">{item.serialNumber}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.costPrice * item.quantity)}</TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">Nenhum item nesta categoria.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold font-headline">Conferência Individual de Estoque</h1>
      
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>SN (Código do Fabricante)</CardTitle>
            <CardDescription>Bipe ou cole os números de série para conferir com o estoque atual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="sn-input">Bipe ou digite o SN</Label>
                <Textarea 
                    id="sn-input"
                    placeholder="Cole a lista de SNs aqui, um por linha..."
                    rows={10}
                    value={scannedSns}
                    onChange={(e) => setScannedSns(e.target.value)}
                />
            </div>
            <div className="text-sm text-muted-foreground">
                Contagem: <span className="font-semibold text-primary">{scannedSns.trim() ? scannedSns.trim().split('\n').length : 0}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSearch} disabled={isLoading || !scannedSns.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                Buscar
            </Button>
          </CardFooter>
        </Card>

        <div className="md:col-span-2">
          {isLoading && (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="ml-4">Conferindo estoque...</p>
            </div>
          )}

          {results && (
             <Tabs defaultValue="found" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="found">
                    <CheckCircle className="mr-2 text-green-500" />
                    Encontrado ({results.found.length})
                </TabsTrigger>
                <TabsTrigger value="not_found">
                    <XCircle className="mr-2 text-destructive" />
                    Não Encontrado ({results.notFound.length})
                </TabsTrigger>
                <TabsTrigger value="not_scanned">
                    <AlertTriangle className="mr-2 text-amber-500" />
                    Não Bipado ({results.notScanned.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="found" className="mt-4">
                  <ResultTable items={results.found} />
              </TabsContent>
              <TabsContent value="not_found" className="mt-4">
                  <div className="rounded-md border p-4 space-y-2">
                    {results.notFound.length > 0 ? results.notFound.map(sn => (
                        <Badge key={sn} variant="destructive" className="font-mono">{sn}</Badge>
                    )) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum item nesta categoria.</p>}
                  </div>
              </TabsContent>
              <TabsContent value="not_scanned" className="mt-4">
                  <ResultTable items={results.notScanned} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState, useMemo, FC } from 'react';
import type { InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, CheckCircle, XCircle, AlertTriangle, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadInventoryItems } from '@/services/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConferenceResult {
  found: InventoryItem[];
  notFound: string[];
  notScanned: InventoryItem[];
}

interface ResultsPaginationProps {
    totalItems: number;
    pageIndex: number;
    pageSize: number;
    setPageIndex: (index: number) => void;
    setPageSize: (size: number) => void;
    pageCount: number;
}

const ResultsPagination: FC<ResultsPaginationProps> = ({ totalItems, pageIndex, pageSize, setPageIndex, setPageSize, pageCount }) => (
    <div className="flex items-center justify-between flex-wrap gap-4 pt-4">
        <div className="text-sm text-muted-foreground">
            Total de {totalItems} itens.
        </div>
        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Itens por página</p>
                <Select
                    value={`${pageSize}`}
                    onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPageIndex(0);
                    }}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={pageSize.toString()} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[10, 20, 50, 100].map((size) => (
                            <SelectItem key={size} value={`${size}`}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="text-sm font-medium">
                Página {pageIndex + 1} de {pageCount > 0 ? pageCount : 1}
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0}>
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1}>
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
);


export function IndividualConference() {
  const [scannedSns, setScannedSns] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ConferenceResult | null>(null);

  // Pagination states for each list
  const [foundPageIndex, setFoundPageIndex] = useState(0);
  const [foundPageSize, setFoundPageSize] = useState(10);
  const [notScannedPageIndex, setNotScannedPageIndex] = useState(0);
  const [notScannedPageSize, setNotScannedPageSize] = useState(10);
  

  const handleSearch = async () => {
    setIsLoading(true);
    setResults(null);
    setFoundPageIndex(0);
    setNotScannedPageIndex(0);
    
    try {
      const allInventoryItems = await loadInventoryItems();
      const inventorySnMap = new Map(allInventoryItems.map(item => [item.serialNumber, item]));
      const allInventorySns = new Set(allInventoryItems.map(item => item.serialNumber));
      
      const scannedSnList = scannedSns
        .trim()
        .split(/[\n,;]+/)
        .map(sn => sn.trim())
        .filter(Boolean);
      const scannedSnSet = new Set(scannedSnList);

      const found: InventoryItem[] = [];
      const notFound: string[] = [];
      
      for (const scannedSn of scannedSnSet) {
        if (inventorySnMap.has(scannedSn)) {
          found.push(inventorySnMap.get(scannedSn)!);
        } else {
          notFound.push(scannedSn);
        }
      }
      
      const notScanned: InventoryItem[] = [];
      for (const inventorySn of allInventorySns) {
        if (!scannedSnSet.has(inventorySn)) {
          notScanned.push(inventorySnMap.get(inventorySn)!);
        }
      }
      
      setResults({ found, notFound, notScanned });

    } catch (error) {
        console.error("Error during stock conference:", error);
        // Adicionar um toast de erro seria uma boa prática aqui
    } finally {
        setIsLoading(false);
    }
  };

  const handleReset = () => {
    setScannedSns('');
    setResults(null);
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => {
    if(!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  }

  // Memoized paginated data for "Found" items
  const foundPageCount = useMemo(() => Math.ceil((results?.found.length || 0) / foundPageSize), [results?.found, foundPageSize]);
  const paginatedFoundItems = useMemo(() => {
    if (!results?.found) return [];
    const startIndex = foundPageIndex * foundPageSize;
    return results.found.slice(startIndex, startIndex + foundPageSize);
  }, [results?.found, foundPageIndex, foundPageSize]);

  // Memoized paginated data for "Not Scanned" items
  const notScannedPageCount = useMemo(() => Math.ceil((results?.notScanned.length || 0) / notScannedPageSize), [results?.notScanned, notScannedPageSize]);
  const paginatedNotScannedItems = useMemo(() => {
    if (!results?.notScanned) return [];
    const startIndex = notScannedPageIndex * notScannedPageSize;
    return results.notScanned.slice(startIndex, startIndex + notScannedPageSize);
  }, [results?.notScanned, notScannedPageIndex, notScannedPageSize]);


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
                Contagem: <span className="font-semibold text-primary">{scannedSns.trim() ? scannedSns.trim().split(/[\n,;]+/).filter(Boolean).length : 0}</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleSearch} disabled={isLoading || !scannedSns.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                Buscar
            </Button>
            {results && (
              <Button variant="outline" className="w-full" onClick={handleReset}>
                <RotateCcw className="mr-2" />
                Zerar e Recomeçar
              </Button>
            )}
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
                  <ResultTable items={paginatedFoundItems} />
                  <ResultsPagination 
                    totalItems={results.found.length}
                    pageIndex={foundPageIndex}
                    pageSize={foundPageSize}
                    setPageIndex={setFoundPageIndex}
                    setPageSize={setFoundPageSize}
                    pageCount={foundPageCount}
                  />
              </TabsContent>
              <TabsContent value="not_found" className="mt-4">
                  <div className="rounded-md border p-4 space-y-2">
                    {results.notFound.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {results.notFound.map(sn => (
                                <Badge key={sn} variant="destructive" className="font-mono">{sn}</Badge>
                            ))}
                        </div>
                    ): <p className="text-sm text-muted-foreground text-center py-4">Nenhum item nesta categoria.</p>}
                  </div>
              </TabsContent>
              <TabsContent value="not_scanned" className="mt-4">
                  <ResultTable items={paginatedNotScannedItems} />
                   <ResultsPagination 
                    totalItems={results.notScanned.length}
                    pageIndex={notScannedPageIndex}
                    pageSize={notScannedPageSize}
                    setPageIndex={setNotScannedPageIndex}
                    setPageSize={setNotScannedPageSize}
                    pageCount={notScannedPageCount}
                  />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

    
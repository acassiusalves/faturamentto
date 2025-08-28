
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Package, ArrowRight, AlertTriangle, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ApprovalRequest, Product } from "@/lib/types";
import { loadApprovalRequests, processApprovalRequest, loadProducts } from "@/services/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ApprovalsPage() {
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<ApprovalRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // History state
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const [pending, approved, rejected, loadedProducts] = await Promise.all([
        loadApprovalRequests('pending'),
        loadApprovalRequests('approved'),
        loadApprovalRequests('rejected'),
        loadProducts()
    ]);
    setPendingRequests(pending);
    setHistoryRequests([...approved, ...rejected].sort((a, b) => new Date(b.processedAt || 0).getTime() - new Date(a.processedAt || 0).getTime()));
    setProducts(loadedProducts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleProcessRequest = async (request: ApprovalRequest, decision: 'approved' | 'rejected') => {
    if (!user?.email) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível identificar o usuário logado.' });
        return;
    }
    setProcessingId(request.id);
    try {
        await processApprovalRequest(request, decision, user.email);
        localStorage.setItem('stockDataDirty', 'true');
        toast({
            title: "Sucesso!",
            description: `A solicitação para o pedido ${request.orderData.order_code} foi ${decision === 'approved' ? 'aprovada' : 'rejeitada'}.`
        });
        // Refetch all data to update both lists
        await fetchRequests();
    } catch(error) {
        console.error("Error processing request:", error);
        toast({
            variant: "destructive",
            title: "Erro ao Processar",
            description: "Não foi possível completar a ação. Tente novamente."
        })
    } finally {
        setProcessingId(null);
    }
  }
  
  const productSkuMap = useMemo(() => {
    const map = new Map<string, string>();
    if (products) {
        products.forEach(p => {
            // Map the main SKU
            if (p.sku) map.set(p.sku, p.name);
            // Map all associated SKUs
            p.associatedSkus?.forEach(assocSku => {
                map.set(assocSku, p.name);
            });
        });
    }
    return map;
  }, [products]);


  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return "Data inválida";
    }
  };

  const renderRequestDetails = (request: ApprovalRequest) => {
    if (request.type === 'SKU_MISMATCH_PICKING') {
      const orderSku = (request.orderData as any).item_sku || 'N/A';
      const defaultOrderName = (request.orderData as any).item_title || 'Produto do Pedido';
      const standardizedOrderName = productSkuMap.get(orderSku) || defaultOrderName;

      return (
        <div className="flex flex-col md:flex-row items-center gap-4 text-sm">
            <div className="flex flex-col items-center p-2 border rounded-md bg-muted text-center flex-1">
                <Package className="h-5 w-5 mb-1 text-primary" />
                <span className="font-semibold" title={standardizedOrderName}>{standardizedOrderName.substring(0,25)}...</span>
                <span className="text-xs text-muted-foreground">{orderSku}</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block"/>
            <div className="flex flex-col items-center p-2 border rounded-md bg-destructive/10 text-center flex-1">
                 <AlertTriangle className="h-5 w-5 mb-1 text-destructive" />
                <span className="font-semibold" title={request.scannedItem.name}>{request.scannedItem.name.substring(0,25)}...</span>
                <span className="text-xs text-muted-foreground">{request.scannedItem.sku}</span>
            </div>
        </div>
      );
    }
    return <p>Tipo de solicitação desconhecida.</p>;
  };
  
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return historyRequests;
    return historyRequests.filter(r => r.status === historyFilter);
  }, [historyRequests, historyFilter]);
  
  const pageCount = Math.ceil(filteredHistory.length / pageSize);
  const paginatedHistory = useMemo(() => {
    const startIndex = pageIndex * pageSize;
    return filteredHistory.slice(startIndex, startIndex + pageSize);
  }, [filteredHistory, pageIndex, pageSize]);
  
   useEffect(() => {
    if (pageIndex >= pageCount && pageCount > 0) {
        setPageIndex(pageCount - 1);
    } else if (pageCount === 0) {
        setPageIndex(0);
    }
  }, [filteredHistory, pageIndex, pageCount]);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Central de Aprovações</h1>
        <p className="text-muted-foreground">
          Gerencie e aprove solicitações pendentes no sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Solicitações Pendentes</CardTitle>
            <CardDescription>
                Ações que requerem sua aprovação para serem concluídas.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Detalhes da Solicitação</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : pendingRequests.length > 0 ? (
                            pendingRequests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{formatDateTime(req.createdAt)}</TableCell>
                                    <TableCell className="font-semibold">{(req.orderData as any).order_code}</TableCell>
                                    <TableCell>{req.requestedBy}</TableCell>
                                    <TableCell>
                                        {renderRequestDetails(req)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                         {processingId === req.id ? (
                                            <Loader2 className="animate-spin mx-auto" />
                                        ) : (
                                            <div className="flex justify-center gap-2">
                                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleProcessRequest(req, 'rejected')}>
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Recusar
                                                </Button>
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleProcessRequest(req, 'approved')}>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Aprovar
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nenhuma solicitação pendente no momento.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
             </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                     <CardTitle className="flex items-center gap-2"><History /> Histórico de Aprovações</CardTitle>
                    <CardDescription>
                        Consulte todas as solicitações que já foram processadas.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as any)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="approved">Aprovados</SelectItem>
                            <SelectItem value="rejected">Recusados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent>
             <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data da Solicitação</TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Detalhes da Solicitação</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : paginatedHistory.length > 0 ? (
                            paginatedHistory.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{formatDateTime(req.createdAt)}</TableCell>
                                    <TableCell className="font-semibold">{(req.orderData as any).order_code}</TableCell>
                                    <TableCell>{req.requestedBy}</TableCell>
                                    <TableCell>
                                        {renderRequestDetails(req)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-left">
                                            <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className={req.status === 'approved' ? 'bg-green-600' : ''}>
                                                {req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground mt-1">
                                                Por: {req.processedBy} <br/> em {formatDateTime(req.processedAt)}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nenhum item no histórico.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
             </div>
        </CardContent>
         <CardFooter className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground">
                Total de {filteredHistory.length} registros.
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
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(0)} disabled={pageIndex === 0} > <ChevronsLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex - 1)} disabled={pageIndex === 0} > <ChevronLeft className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageIndex + 1)} disabled={pageIndex >= pageCount - 1} > <ChevronRight className="h-4 w-4" /> </Button>
                    <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPageIndex(pageCount - 1)} disabled={pageIndex >= pageCount - 1} > <ChevronsRight className="h-4 w-4" /> </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

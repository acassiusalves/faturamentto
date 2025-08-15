
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Package, ArrowRight, AlertTriangle } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ApprovalRequest } from "@/lib/types";
import { loadApprovalRequests } from "@/services/firestore";

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const pendingRequests = await loadApprovalRequests('pending');
    setRequests(pendingRequests);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = (requestId: string) => {
    console.log("Aprovar:", requestId);
    // Lógica de aprovação a ser implementada
  };

  const handleReject = (requestId: string) => {
    console.log("Rejeitar:", requestId);
    // Lógica de rejeição a ser implementada
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const renderRequestDetails = (request: ApprovalRequest) => {
    if (request.type === 'SKU_MISMATCH_PICKING') {
      const orderSku = (request.orderData as any).item_sku || 'N/A';
      return (
        <div className="flex flex-col md:flex-row items-center gap-4 text-sm">
            <div className="flex flex-col items-center p-2 border rounded-md bg-muted text-center flex-1">
                <Package className="h-5 w-5 mb-1 text-primary" />
                <span className="font-semibold">Pedido</span>
                <span className="text-xs text-muted-foreground">{orderSku}</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block"/>
            <div className="flex flex-col items-center p-2 border rounded-md bg-destructive/10 text-center flex-1">
                 <AlertTriangle className="h-5 w-5 mb-1 text-destructive" />
                <span className="font-semibold">Bipado</span>
                <span className="text-xs text-muted-foreground">{request.scannedItem.sku}</span>
            </div>
        </div>
      );
    }
    return <p>Tipo de solicitação desconhecida.</p>;
  };

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
             <div className="rounded-md border">
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
                        ) : requests.length > 0 ? (
                            requests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell>{formatDateTime(req.createdAt)}</TableCell>
                                    <TableCell className="font-semibold">{(req.orderData as any).order_code}</TableCell>
                                    <TableCell>{req.requestedBy}</TableCell>
                                    <TableCell>
                                        {renderRequestDetails(req)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center gap-2">
                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleReject(req.id)}>
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Recusar
                                            </Button>
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Aprovar
                                            </Button>
                                        </div>
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Sale, Cost } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Store } from "lucide-react";
import { AddCostDialog } from "@/components/add-cost-dialog";
import { AmazonLogo, MercadoLivreLogo } from "./icons";

interface SalesTableProps {
  data: Sale[];
  onUpdateSaleCosts: (saleId: string, costs: Cost[]) => void;
  calculateTotalCost: (sale: Sale) => number;
  calculateNetRevenue: (sale: Sale) => number;
  formatCurrency: (value: number) => string;
  isLoading: boolean;
}

const MarketplaceIcon = ({ marketplace }: { marketplace?: string }) => {
  if (!marketplace) return <Store className="h-5 w-5 text-muted-foreground" />;
  switch (marketplace.toLowerCase()) {
    case "mercado livre":
      return <MercadoLivreLogo className="h-5 w-auto" />;
    case "amazon":
      return <AmazonLogo className="h-5 w-5" />;
    default:
      return <Store className="h-5 w-5 text-muted-foreground" />;
  }
};

export function SalesTable({ 
    data, 
    onUpdateSaleCosts, 
    calculateTotalCost, 
    calculateNetRevenue, 
    formatCurrency, 
    isLoading 
}: SalesTableProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const handleAddCostClick = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDialogOpen(true);
  };

  const handleAddCost = (saleId: string, cost: Sale["costs"][0]) => {
    const sale = data.find(s => s.id === saleId);
    if(sale) {
      const newCosts = [...sale.costs, cost];
      onUpdateSaleCosts(saleId, newCosts);
    }
  };

  const totalGross = data.reduce((acc, sale) => acc + (sale.grossValue || (sale as any).value_with_shipping || 0), 0);
  const totalCosts = data.reduce((acc, sale) => acc + calculateTotalCost(sale), 0);
  const totalNet = data.reduce((acc, sale) => acc + calculateNetRevenue(sale), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Custos Adicionais</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Total Custos</TableHead>
                  <TableHead className="text-right font-semibold">Valor Líquido</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                ) : data.length > 0 ? (
                  data.map((sale) => {
                    const grossValue = sale.grossValue || (sale as any).value_with_shipping || 0;
                    const saleDate = (sale as any).payment_approved_date || sale.date;
                    const marketplaceName = (sale as any).marketplace_name || sale.marketplace;
                    const productTitle = (sale as any).item_title || sale.productDescription;
                    const totalCost = calculateTotalCost(sale);
                    const netValue = calculateNetRevenue(sale);
                    
                    return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {saleDate ? format(parseISO(saleDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MarketplaceIcon marketplace={marketplaceName} />
                          <span className="font-medium">{marketplaceName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{productTitle}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {sale.costs.map((cost) => (
                            <Badge key={cost.id} variant="secondary" className="font-normal">
                              {cost.description}: {formatCurrency(cost.amount)}
                              {cost.isPercentage && '%'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(grossValue)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        - {formatCurrency(totalCost)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(netValue)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddCostClick(sale)}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Custo
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Nenhuma venda encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="font-bold text-lg">Totais</TableCell>
                    <TableCell className="text-right font-bold text-lg">{formatCurrency(totalGross)}</TableCell>
                    <TableCell className="text-right font-bold text-lg text-destructive">- {formatCurrency(totalCosts)}</TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalNet)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AddCostDialog
        sale={selectedSale}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAddCost={handleAddCost}
      />
    </>
  );
}

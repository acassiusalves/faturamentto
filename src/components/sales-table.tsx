"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Sale } from "@/lib/types";
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
  salesData: Sale[];
  onSalesUpdate: (sales: Sale[]) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const MarketplaceIcon = ({ marketplace }: { marketplace: string }) => {
  switch (marketplace) {
    case "Mercado Livre":
      return <MercadoLivreLogo className="h-5 w-auto" />;
    case "Amazon":
      return <AmazonLogo className="h-5 w-5" />;
    default:
      return <Store className="h-5 w-5 text-muted-foreground" />;
  }
};

export function SalesTable({ salesData, onSalesUpdate }: SalesTableProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const handleAddCostClick = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDialogOpen(true);
  };

  const handleAddCost = (saleId: string, cost: Sale["costs"][0]) => {
    const updatedSales = salesData.map((sale) => {
      if (sale.id === saleId) {
        const newCosts = [...sale.costs, cost];
        const totalCosts = newCosts.reduce((acc, c) => acc + c.amount, 0);
        return {
          ...sale,
          costs: newCosts,
          netValue: sale.grossValue - totalCosts,
        };
      }
      return sale;
    });
    onSalesUpdate(updatedSales);
  };

  const totalGross = salesData.reduce((acc, sale) => acc + sale.grossValue, 0);
  const totalCosts = salesData.reduce((acc, sale) => acc + sale.costs.reduce((costAcc, c) => costAcc + c.amount, 0), 0);
  const totalNet = salesData.reduce((acc, sale) => acc + sale.netValue, 0);

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
                  <TableHead>Custos</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Total Custos</TableHead>
                  <TableHead className="text-right font-semibold">Valor Líquido</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {format(parseISO(sale.date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MarketplaceIcon marketplace={sale.marketplace} />
                        <span className="font-medium">{sale.marketplace}</span>
                      </div>
                    </TableCell>
                    <TableCell>{sale.productDescription}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {sale.costs.map((cost) => (
                           <Badge key={cost.id} variant="secondary" className="font-normal">
                             {cost.description}: {formatCurrency(cost.amount)}
                           </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(sale.grossValue)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      - {formatCurrency(sale.costs.reduce((acc, c) => acc + c.amount, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(sale.netValue)}
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
                ))}
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

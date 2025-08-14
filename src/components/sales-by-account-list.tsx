
"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SalesByAccountListProps {
  salesData: Sale[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function SalesByAccountList({ salesData }: SalesByAccountListProps) {
  const accountData = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return [];
    }

    const salesByAccount: { [key: string]: number } = {};

    salesData.forEach((sale) => {
      const accountName = (sale as any).auth_name || "Desconhecida";
      const saleValue = (sale as any).value_with_shipping || 0;
      salesByAccount[accountName] = (salesByAccount[accountName] || 0) + saleValue;
    });

    return Object.entries(salesByAccount)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

  }, [salesData]);

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Faturamento por Conta</CardTitle>
      </CardHeader>
      <CardContent>
        {accountData.length > 0 ? (
            <ScrollArea className="h-[250px]">
                <div className="space-y-4 pr-4">
                    {accountData.map((item, index) => (
                        <div key={index} className="flex justify-between items-center">
                            <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                            <p className="text-sm font-bold text-primary">{formatCurrency(item.total)}</p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        ) : (
           <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Nenhum dado de venda para exibir.
          </div>
        )}
      </CardContent>
    </Card>
  );
}


"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface SalesByAccountChartProps {
  salesData: Sale[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function SalesByAccountChart({ salesData }: SalesByAccountChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return { chartData: [], chartConfig: {} };
    }

    const salesByAccount: { [key: string]: number } = {};

    salesData.forEach((sale) => {
      const accountName = (sale as any).auth_name || "Desconhecida";
      const saleValue = (sale as any).value_with_shipping || 0;
      salesByAccount[accountName] = (salesByAccount[accountName] || 0) + saleValue;
    });

    const chartData = Object.entries(salesByAccount)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5 Accounts

    const chartConfig: ChartConfig = {};
    chartData.forEach((item, index) => {
        chartConfig[item.name] = {
            label: item.name,
            color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
    });

    return { chartData, chartConfig };
  }, [salesData]);

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Top 5 Vendas por Conta</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 10 }}
            >
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 20) + (value.length > 20 ? '...' : '')}
                className="text-xs"
                width={120}
              />
              <XAxis dataKey="total" type="number" hide />
              <Tooltip
                cursor={{ fill: 'hsl(var(--background))' }}
                content={<ChartTooltipContent
                    formatter={(value, name) => (
                        <div>
                           <p className="font-semibold">{name as string}</p>
                           <p className="text-sm font-bold">{formatCurrency(value as number)}</p>
                        </div>
                    )}
                    hideLabel
                />}
              />
              <Bar dataKey="total" layout="vertical" radius={5}>
                 {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
           <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Nenhum dado de venda para exibir.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

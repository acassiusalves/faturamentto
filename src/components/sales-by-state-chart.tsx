"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface SalesByStateChartProps {
  salesData: Sale[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};


export function SalesByStateChart({ salesData }: SalesByStateChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return { chartData: [], chartConfig: {} };
    }

    const salesByState: { [key: string]: number } = {};

    salesData.forEach((sale) => {
      const stateName = (sale as any).state_name || "N/A";
      const saleValue = (sale as any).value_with_shipping || 0;
      salesByState[stateName] = (salesByState[stateName] || 0) + saleValue;
    });

    const chartData = Object.entries(salesByState)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 states

    const chartConfig: ChartConfig = {
      total: {
        label: "Total de Vendas",
        color: `hsl(var(--chart-1))`,
      }
    };

    return { chartData, chartConfig };
  }, [salesData]);

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Vendas por Estado (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 0, right: 10, top: 10 }}
            >
              <YAxis
                dataKey="total"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value as number).replace(',00', '')}
                className="text-xs"
              />
              <XAxis dataKey="name" type="category" hide />
               <Tooltip
                cursor={{ fill: 'hsl(var(--background))' }}
                content={<ChartTooltipContent 
                    formatter={(value, name, props) => (
                       <div>
                           <p className="font-semibold">{props.payload.name}</p>
                           <p className="text-sm font-bold">{formatCurrency(value as number)}</p>
                        </div>
                    )}
                    hideLabel
                />}
              />
              <Bar dataKey="total" radius={5} fill="var(--color-total)" />
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

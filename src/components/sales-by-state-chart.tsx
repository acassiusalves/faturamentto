"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

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
      .sort((a, b) => b.total - a.total);

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
    <Card className="lg:col-span-1 flex flex-col">
      <CardHeader>
        <CardTitle>Vendas por Estado</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {chartData.length > 0 ? (
          <ChartContainer 
            config={chartConfig} 
            className="h-[250px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
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
                    <Pie
                        data={chartData}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={60}
                        strokeWidth={5}
                    >
                         {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                        ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
            </ResponsiveContainer>
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

"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

interface MarketplaceSalesChartProps {
  salesData: Sale[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
            {`${(percent * 100).toFixed(1)}%`}
        </text>
    );
};

export function MarketplaceSalesChart({ salesData }: MarketplaceSalesChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return { chartData: [], chartConfig: {} };
    }

    const salesByMarketplace: { [key: string]: number } = {};

    salesData.forEach((sale) => {
      const marketplaceName = (sale as any).marketplace_name || "Desconhecido";
      const saleValue = (sale as any).value_with_shipping || 0;
      salesByMarketplace[marketplaceName] = (salesByMarketplace[marketplaceName] || 0) + saleValue;
    });

    const sortedMarketplaces = Object.entries(salesByMarketplace)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const chartConfig: ChartConfig = {};
    sortedMarketplaces.forEach((item, index) => {
        chartConfig[item.name] = {
            label: item.name,
            color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
    });

    return { chartData: sortedMarketplaces, chartConfig };
  }, [salesData]);

  return (
    <Card className="lg:col-span-1 flex flex-col">
      <CardHeader>
        <CardTitle>Vendas por Marketplace</CardTitle>
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
                            formatter={(value, name) => (
                               <div>
                                   <p className="font-semibold">{name as string}</p>
                                   <p className="text-sm font-bold">{formatCurrency(value as number)}</p>
                                </div>
                            )}
                            nameKey="name"
                            hideLabel 
                        />}
                    />
                    <Pie
                        data={chartData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        labelLine={false}
                        label={<CustomLabel />}
                    >
                         {chartData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name]?.color} />
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

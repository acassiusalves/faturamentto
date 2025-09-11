
"use client";

import { useMemo } from "react";
import type { Sale, Product } from "@/lib/types";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface TopProductsChartProps {
  salesData: Sale[];
  products: Product[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function TopProductsChart({ salesData, products }: TopProductsChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    if (!salesData || salesData.length === 0 || !products || products.length === 0) {
      return { chartData: [], chartConfig: {} };
    }

    const productMap = new Map<string, Product>();
    products.forEach(p => {
        if(p.sku) productMap.set(p.sku, p);
        p.associatedSkus?.forEach(assocSku => {
            productMap.set(assocSku, p);
        });
    });

    const salesByProduct: { [key: string]: { total: number, sku: string } } = {};

    salesData.forEach((sale) => {
      const saleSku = (sale as any).item_sku || "N/A";
      const parentProduct = productMap.get(saleSku);
      
      const productName = parentProduct?.name || (sale as any).item_title || "Produto Desconhecido";
      const productSku = parentProduct?.sku || saleSku;

      const saleValue = (sale as any).value_with_shipping || 0;

      if (!salesByProduct[productName]) {
        salesByProduct[productName] = { total: 0, sku: productSku };
      }
      salesByProduct[productName].total += saleValue;
    });

    const chartData = Object.entries(salesByProduct)
      .map(([name, data]) => ({ name, total: data.total, sku: data.sku }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5

    const chartConfig: ChartConfig = {};
    chartData.forEach((item, index) => {
        chartConfig[item.name] = {
            label: `${item.name} (SKU: ${item.sku})`,
            color: `hsl(var(--chart-${(index % 5) + 1}))`,
        };
    });

    return { chartData, chartConfig };
  }, [salesData, products]);

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Top 5 Produtos Mais Vendidos</CardTitle>
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
                    formatter={(value, name, props) => (
                        <div>
                           <p className="font-semibold">{props.payload.name}</p>
                           <p className="text-xs text-muted-foreground">SKU: {props.payload.sku}</p>
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

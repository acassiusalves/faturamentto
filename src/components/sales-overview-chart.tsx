"use client";

import { useMemo } from "react";
import type { Sale } from "@/lib/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';

interface SalesOverviewChartProps {
  salesData: Sale[];
}

const chartConfig = {
  grossValue: {
    label: "Valor Bruto",
    color: "hsl(var(--chart-1))",
  },
  netValue: {
    label: "Valor Líquido",
    color: "hsl(var(--chart-2))",
  },
  costs: {
    label: "Custos",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

export function SalesOverviewChart({ salesData }: SalesOverviewChartProps) {
  const chartData = useMemo(() => {
    return salesData.map((sale) => ({
      date: format(new Date(sale.date), "dd MMM", { locale: ptBR }),
      grossValue: sale.grossValue,
      costs: sale.costs.reduce((acc, cost) => acc + cost.amount, 0),
      netValue: sale.netValue,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [salesData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão Geral de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickFormatter={(value) => `R$${value}`}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={80}
              />
              <Tooltip
                cursor={false}
                content={<ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center">
                      <div className={`h-2.5 w-2.5 rounded-full mr-2 bg-[${chartConfig[name as keyof typeof chartConfig].color}]`} />
                      <div>
                        <p className="font-semibold">{chartConfig[name as keyof typeof chartConfig].label}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value as number)}
                        </p>
                      </div>
                    </div>
                  )}
                />}
              />
              <Bar dataKey="grossValue" fill="var(--color-grossValue)" radius={4} />
              <Bar dataKey="netValue" fill="var(--color-netValue)" radius={4} />
              <Bar dataKey="costs" fill="var(--color-costs)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

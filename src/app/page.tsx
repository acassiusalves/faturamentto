"use client";

import { useState } from "react";
import type { Sale } from "@/lib/types";
import { DashboardHeader } from "@/components/dashboard-header";
import { SalesOverviewChart } from "@/components/sales-overview-chart";
import { SalesTable } from "@/components/sales-table";

const initialSalesData: Sale[] = [
  {
    id: "SALE001",
    date: "2024-05-01",
    marketplace: "Mercado Livre",
    productDescription: "Camiseta estampada de algodão",
    grossValue: 79.9,
    costs: [
      { id: "C01", description: "Taxa de venda", amount: 12.78, category: "Taxas do Marketplace" },
      { id: "C02", description: "Custo de envio", amount: 15.0, category: "Frete" },
    ],
    netValue: 52.12,
  },
  {
    id: "SALE002",
    date: "2024-05-02",
    marketplace: "Amazon",
    productDescription: "Fone de ouvido Bluetooth 5.0",
    grossValue: 199.9,
    costs: [{ id: "C03", description: "Taxa Amazon", amount: 29.99, category: "Taxas do Marketplace" }],
    netValue: 169.91,
  },
  {
    id: "SALE003",
    date: "2024-05-03",
    marketplace: "Mercado Livre",
    productDescription: "Smartwatch com GPS integrado",
    grossValue: 450.0,
    costs: [
      { id: "C04", description: "Taxa de venda", amount: 72.0, category: "Taxas do Marketplace" },
      { id: "C05", description: "Envio Full", amount: 22.5, category: "Frete" },
    ],
    netValue: 355.5,
  },
  {
    id: "SALE004",
    date: "2024-05-04",
    marketplace: "Shopee",
    productDescription: "Kit de ferramentas 12-em-1",
    grossValue: 59.99,
    costs: [{ id: "C06", description: "Taxa Shopee", amount: 8.4, category: "Taxas do Marketplace" }],
    netValue: 51.59,
  },
  {
    id: "SALE005",
    date: "2024-05-05",
    marketplace: "Amazon",
    productDescription: "Livro de ficção científica",
    grossValue: 45.5,
    costs: [
        { id: "C07", description: "Taxa Amazon Livros", amount: 6.83, category: "Taxas do Marketplace" },
        { id: "C08", description: "Embalagem", amount: 2.0, category: "Outros" }
    ],
    netValue: 36.67,
  },
];

export default function Home() {
  const [sales, setSales] = useState<Sale[]>(
    initialSalesData.map((sale) => {
      const totalCosts = sale.costs.reduce((acc, cost) => acc + cost.amount, 0);
      return { ...sale, netValue: sale.grossValue - totalCosts };
    })
  );

  const handleSalesUpdate = (updatedSales: Sale[]) => {
    setSales(updatedSales);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <DashboardHeader />
      <div className="flex-1 container mx-auto p-4 md:p-8 space-y-8">
        <SalesOverviewChart salesData={sales} />
        <SalesTable salesData={sales} onSalesUpdate={handleSalesUpdate} />
      </div>
    </div>
  );
}


"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck } from 'lucide-react';

const shippingData = [
  { weight: "Até 300 g", cost_79_99: "R$ 15,96", cost_100_119: "R$ 17,96" },
  { weight: "De 300 g a 500 g", cost_79_99: "R$ 17,16", cost_100_119: "R$ 19,31" },
  { weight: "De 500 g a 1 kg", cost_79_99: "R$ 17,96", cost_100_119: "R$ 20,21" },
  { weight: "De 1 kg a 2 kg", cost_79_99: "R$ 18,76", cost_100_119: "R$ 21,11" },
  { weight: "De 2 kg a 3 kg", cost_79_99: "R$ 19,96", cost_100_119: "R$ 22,46" },
  { weight: "De 3 kg a 4 kg", cost_79_99: "R$ 21,56", cost_100_119: "R$ 24,26" },
  { weight: "De 4 kg a 5 kg", cost_79_99: "R$ 22,76", cost_100_119: "R$ 25,61" },
  { weight: "De 5 kg a 9 kg", cost_79_99: "R$ 35,56", cost_100_119: "R$ 40,01" },
  { weight: "De 9 kg a 13 kg", cost_79_99: "R$ 52,76", cost_100_119: "R$ 59,36" },
  { weight: "De 13 kg a 17 kg", cost_79_99: "R$ 58,76", cost_100_119: "R$ 66,11" },
  { weight: "De 17 kg a 23 kg", cost_79_99: "R$ 68,76", cost_100_119: "R$ 77,36" },
  { weight: "De 23 kg a 30 kg", cost_79_99: "R$ 79,16", cost_100_119: "R$ 89,06" },
  { weight: "De 30 kg a 40 kg", cost_79_99: "R$ 81,56", cost_100_119: "R$ 91,76" },
  { weight: "De 40 kg a 50 kg", cost_79_99: "R$ 84,36", cost_100_119: "R$ 94,91" },
  { weight: "De 50 kg a 60 kg", cost_79_99: "R$ 89,96", cost_100_119: "R$ 101,21" },
  { weight: "De 60 kg a 70 kg", cost_79_99: "R$ 96,36", cost_100_119: "R$ 108,41" },
  { weight: "De 70 kg a 80 kg", cost_79_99: "R$ 100,76", cost_100_119: "R$ 113,36" },
  { weight: "De 80 kg a 90 kg", cost_79_99: "R$ 111,96", cost_100_119: "R$ 125,96" },
  { weight: "De 90 kg a 100 kg", cost_79_99: "R$ 127,96", cost_100_119: "R$ 143,96" },
  { weight: "De 100 kg a 125 kg", cost_79_99: "R$ 143,16", cost_100_119: "R$ 161,06" },
  { weight: "De 125 kg a 150 kg", cost_79_99: "R$ 151,96", cost_100_119: "R$ 170,96" },
  { weight: "Maior que 150 kg", cost_79_99: "R$ 199,56", cost_100_119: "R$ 224,51" },
];

export default function DadosFreteMercadoLivrePage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Dados de Frete do Mercado Livre</h1>
        <p className="text-muted-foreground">
          Tabela de custos de frete baseada no peso e na faixa de preço do produto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck /> Tabela de Custos de Envio</CardTitle>
          <CardDescription>
            Valores de referência para o custo de frete de acordo com o peso do pacote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Peso*</TableHead>
                  <TableHead className="text-right font-bold">Produtos novos de R$ 79 a R$ 99,99</TableHead>
                  <TableHead className="text-right font-bold">Produtos novos de R$ 100 a R$ 119,99</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingData.map((row) => (
                  <TableRow key={row.weight}>
                    <TableCell className="font-medium">{row.weight}</TableCell>
                    <TableCell className="text-right font-mono">{row.cost_79_99}</TableCell>
                    <TableCell className="text-right font-mono">{row.cost_100_119}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

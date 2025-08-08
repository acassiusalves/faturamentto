export type Marketplace = "Mercado Livre" | "Amazon" | "Shopee" | "Outro";

export const COST_CATEGORIES = [
  "Frete",
  "Taxas do Marketplace",
  "Impostos",
  "Marketing",
  "Outros",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export interface Cost {
  id: string;
  description: string;
  amount: number;
  category: CostCategory;
}

export interface Sale {
  id: string;
  date: string;
  marketplace: Marketplace;
  productDescription: string;
  grossValue: number;
  costs: Cost[];
  netValue: number;
}

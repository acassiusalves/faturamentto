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
  isPercentage?: boolean;
}

export interface Sale {
  id: string;
  date: string;
  marketplace: Marketplace;
  productDescription: string;
  grossValue: number;
  costs: Cost[];
  netValue: number;
  // Picking Page related fields
  orderNumber?: string;
  item_sku?: string;
  item_title?: string;
  item_quantity?: number;
  auth_name?: string;
  // Custom mapped fields
  [key: string]: any;
}

export interface ProductAttribute {
  key: string;
  label: string;
  values: string[];
}

export interface ProductCategorySettings {
    id: string;
    name: string;
    attributes: ProductAttribute[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: 'Celular' | 'Notebook';
  attributes: Record<string, string>;
  createdAt: string;
  associatedSkus?: string[];
}

export interface InventoryItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  costPrice: number;
  quantity: number;
  serialNumber: string;
  gtin: string;
  origin: string;
  createdAt: string;
}

export interface PickedItemLog extends InventoryItem {
  orderNumber: string;
  pickedAt: string;
  logId: string;
}

export type ApiKeyStatus = "unchecked" | "valid" | "invalid";

export type ColumnMapping = {
  [systemField: string]: string; // systemField -> sourceField
};

export type AllMappingsState = {
  [marketplaceId: string]: ColumnMapping;
};

export interface CompanyCost {
  id: string;
  description: string;
  value: number;
}

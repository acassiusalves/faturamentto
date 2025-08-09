export type SalesChannel = "Mercado Livre" | "Amazon" | "Shopee" | "Outro" | "Ideris";

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
  value: number;
  category: CostCategory;
  isPercentage?: boolean;
}

export interface Sale {
  id: string;
  orderNumber: string;
  date: string; // ISO string
  salesChannel: SalesChannel;
  account?: string;
  
  // Product
  productName: string;
  sku: string;
  quantity: number;
  productImage?: string;
  
  // Financials
  grossRevenue: number; // Receita bruta
  totalWithShipping?: number;
  paidAmount?: number;
  
  costs: Cost[];
  netValue: number;
  
  // Status & Customer
  status?: string;
  statusDescription?: string;
  state?: string;
  cpf?: string;

  // Detailed financial fields from system-fields.ts for mapping
  commission?: number;
  commissionPercentage?: number;
  fee?: number;
  shippingCost?: number;
  tax?: number;
  packaging?: number;
  unitCost?: number;
  totalCost?: number;
  profit?: number;
  profitPercentage?: number;
  refundedValue?: number;
  discount?: number;
  discountMarketplace?: number;
  
  // Ideris specific fields - can be merged or kept separate
  order_code?: string;
  marketplace_name?: string;
  auth_name?: string;
  document_value?: string;
  state_name?: string;
  value_with_shipping?: number;
  fee_shipment?: number;
  fee_order?: number;
  net_amount?: number;
  left_over?: number;
  item_title?: string;
  item_sku?: string;
  item_quantity?: number;
  item_image?: string;
  payment_approved_date?: string;

  // Other fields from system-fields
  friendlyName?: string;
  verified?: boolean;
  realStatus?: string;
  returnStatus?: string;
  verified2?: boolean;
  ticket?: string;
  resolved?: boolean;
  notes?: string;
  returnTracking?: string;
  transferForecast?: string;
  transferDate?: string;
  editedLabel?: boolean;

  [key: string]: any; // For any other properties from APIs
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

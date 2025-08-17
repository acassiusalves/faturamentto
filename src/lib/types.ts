




export interface Cost {
  id: string;
  type: string;
  value: number;
  isPercentage: boolean;
}

export interface CompanyCost {
  id:string;
  description: string;
  value: number;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  createdAt: string;
  associatedSkus?: string[];
}

export interface InventoryItem {
  id: string;
  productId: string; // Links to the Product template
  name: string;      // The generated name from the Product, stored for convenience
  costPrice: number;
  serialNumber: string;
  sku: string;
  origin: string;
  quantity: number;
  createdAt: string; // ISO 8601 string date
  condition?: 'Novo' | 'Vitrine' | 'Usado' | 'Defeito'; // Condition for returns
}

export type PickedItem = InventoryItem & { orderNumber: string; pickedAt: string };
export type PickedItemLog = PickedItem & { logId: string; };

export interface ReturnLog {
    id: string;
    productName: string;
    serialNumber: string;
    sku: string;
    orderNumber?: string;
    condition: string;
    notes?: string;
    returnedAt: string;
    originalSaleData?: PickedItemLog | null;
}


export interface ProductAttribute {
    key: string;
    label: string;
    values: string[];
}

export interface ProductCategorySettings {
    id: string; // e.g., 'celular'
    name: string; // e.g., 'Celulares'
    attributes: ProductAttribute[];
}


export type AllMappingsState = { [key: string]: Partial<ColumnMapping> };

// Interface Sale com todos os campos possíveis para mapeamento
export interface Sale {
  // Core fields from user request
  id: string;
  productDescription: string;
  sku: string;
  orderNumber: string;
  cpf: string;
  salesChannel: string;
  account: string;
  status: string;
  saleDate: string;
  state: string;
  quantity: number;
  priceWithoutShipping: number;
  total: number; // Mapped to totalWithShipping or another field as needed
  totalWithShipping: number;
  commission: number;
  commissionPercentage: number;
  fee: number;
  shippingCost: number;
  tax: number;
  packaging: number;
  unitCost: number;
  totalCost: number;
  product_cost: number;
  profit: number;
  profitPercentage: number;
  netValue: number;
  refundedValue: number;
  productImage: string;
  paidAmount: number;
  discount: number;
  discountMarketplace: number;
  
  // Other potential fields from sheets/API
  friendlyName: string;
  statusDescription: string;
  verified: string;
  realStatus: string;
  returnStatus: string;
  verified2: string;
  ticket: string;
  resolved: string;
  notes: string;
  returnTracking: string;
  transferForecast: string;
  transferDate: string;
  editedLabel: string;

  // App-specific fields
  costs: Cost[];
  grossRevenue: number;
  sheetData?: Record<string, any>;
  customData?: Record<string, number>;
}

// This mapping now covers all possible fields user might want to map
export interface ColumnMapping {
    id?: string;
    productName?: string;
    sku?: string;
    orderNumber?: string;
    cpf?: string;
    salesChannel?: string;
    account?: string;
    status?: string;
    saleDate?: string;
    state?: string;
    quantity?: string;
    priceWithoutShipping?: string;
    total?: string;
    totalWithShipping?: string;
    commission?: string;
    commissionPercentage?: string;
    fee?: string;
    shippingCost?: string;
    tax?: string;
    packaging?: string;
    unitCost?: string;
    totalCost?: string;
    product_cost?: string;
    profit?: string;
    profitPercentage?: string;
    netValue?: string;
    refundedValue?: string;
    productImage?: string;
    paidAmount?: string;
    discount?: string;
    discountMarketplace?: string;
    friendlyName?: string;
    statusDescription?: string;
    verified?: string;
    realStatus?: string;
    returnStatus?: string;
    verified2?: string;
    ticket?: string;
    resolved?: string;
    notes?: string;
    returnTracking?: string;
    transferForecast?: string;
    transferDate?: string;
    editedLabel?: string;
}

// Type for the AI's direct output
export interface SuggestMappingOutput {
  reasoning: string;
}

export interface SuggestionRequest {
  headersForAI: string[]; // Labels for Ideris, headers for CSV
  allSourceHeaders: string[]; // Keys for Ideris, headers for CSV
  isIderis: boolean;
}

export interface AppUser {
  id: string; // UID from Firebase Auth
  email: string;
  role: string;
}

export type ApiKeyStatus = "unchecked" | "valid" | "invalid";

// -- Support Data Types --
export interface SupportFile {
    id: string; // Unique ID for each file upload instance
    channelId: string; // e.g., 'magalu'
    fileName: string;
    fileContent: string; // The raw file content (CSV or stringified JSON)
    headers: string[];
    friendlyNames: Record<string, string>;
    associationKey: string;
    uploadedAt: string; // ISO 8601 string for the upload date
}

export interface SupportData {
    // Files are now an array per channel
    files: Record<string, SupportFile[]>; // Keyed by channelId
}

// -- Custom Calculation Types --
export type FormulaItem = { type: 'column' | 'operator'; value: string; label: string };

export interface CustomCalculation {
    id: string; // e.g. 'custom_162987...
    name: string; // e.g. "Lucro Real"
    formula: FormulaItem[];
    isPercentage?: boolean;
}

// -- Approval Request Types --
export interface ApprovalRequest {
    id: string;
    type: 'SKU_MISMATCH_PICKING';
    status: 'pending' | 'approved' | 'rejected';
    requestedBy: string; // User's email
    createdAt: string; // ISO Date
    orderData: Sale;
    scannedItem: InventoryItem;
}


// -- App Settings --
export interface AppSettings {
    iderisPrivateKey?: string;
    googleSheetsApiKey?: string;
    allMappings?: AllMappingsState;
    friendlyFieldNames?: Record<string, string>;
    fileNames?: { [key: string]: string };
    fileData?: { [key: string]: string };
    iderisApiStatus?: ApiKeyStatus;
    googleSheetsApiStatus?: ApiKeyStatus;
    permissions?: Record<string, string[]>;
    inactivePages?: string[];
    customCalculations?: any[];
    ignoredIderisColumns?: string[];
    conciliacaoColumnOrder?: string[];
    conciliacaoVisibleColumns?: Record<string, boolean>;
    stores?: string[];
}

// -- Purchase History Types --
export interface PurchaseListItem {
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    storeName?: string;
    isPaid?: boolean;
}

export interface PurchaseList {
    id: string;
    createdAt: string; // ISO Date
    totalCost: number;
    items: PurchaseListItem[];
}

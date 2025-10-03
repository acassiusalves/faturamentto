

import { z } from 'genkit';

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
  averagePrice?: number;
  averagePriceUpdatedAt?: string;
  // Adicionado para busca de custos no ML
  fees?: {
    listing_fee_amount: MoneyLike;
    sale_fee_amount:   MoneyLike;
    sale_fee_percent:  MoneyLike;
    fee_total?:        MoneyLike;
    details?: {
      sale?: {
        gross_amount?:   MoneyLike;
        fixed_fee?:      MoneyLike;
        percentage_fee?: MoneyLike;
      };
      listing?: {
        fixed_fee?:      MoneyLike;
        gross_amount?:   MoneyLike;
      };
    };
  };
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
  condition?: 'Novo' | 'Vitrine' | 'Usado' | 'Defeito' | 'Lacrado' | 'Seminovo';
  originalInventoryId?: string;
  orderNumber?: string;
  category?: 'Celular' | 'Geral';
}

export interface EntryLog extends InventoryItem {
  originalInventoryId: string; // ID do item original na coleção inventory
  entryDate: string | Date; // Data de entrada no estoque
  logType: 'INVENTORY_ENTRY' | 'RETURN_ENTRY'; // Tipo de entrada
}

export type PickedItem = InventoryItem & { orderNumber: string; pickedAt: string };
export type PickedItemLog = PickedItem & { logId: string; };

export interface FullRemittanceLog {
    id: string;
    remittanceId: string; // ID for the entire batch
    productId: string;
    name: string;
    sku: string;
    eanOrCode: string;
    quantity: number;
    costPrice: number;
    remittedAt: string; // ISO Date
}


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
  deliveryType: string;
  
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
  deliveryTrackingCode: string; // added
  sent_date: string; // added
  customer_name: string; // added
  address_line: string; // added
  address_zip_code: string; // added
  address_district: string; // added
  address_city: string; // added

  // New fields from user request
  customerLastName?: string;
  customerNickname?: string;
  customerEmail?: string;
  documentType?: string;
  phoneAreaCode?: string;
  phoneNumber?: string;
  addressStreet?: string;
  addressNumber?: string;
  stateAbbreviation?: string;
  countryName?: string;
  addressComment?: string;
  addressReceiverName?: string;
  addressReceiverPhone?: string;

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
    deliveryType?: string;
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

    // New fields from user request
    customerLastName?: string;
    customerNickname?: string;
    customerEmail?: string;
    documentType?: string;
    phoneAreaCode?: string;
    phoneNumber?: string;
    addressStreet?: string;
    addressNumber?: string;
    stateAbbreviation?: string;
    countryName?: string;
    addressComment?: string;
    addressReceiverName?: string;
    addressReceiverPhone?: string;
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
export type FormulaItem = { type: 'column' | 'operator' | 'number'; value: string; label: string };

export interface CustomCalculation {
    id: string;
    name: string;
    formula: FormulaItem[];
    isPercentage?: boolean;
    targetMarketplace?: string;
    interaction?: {
        targetColumn: string;
        operator: '+' | '-';
    };
    ignoreIfCancelled?: boolean;
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
    processedItem?: InventoryItem;
    processedBy?: string; // User's email
    processedAt?: string; // ISO Date
}

// -- Notice Types --
export interface Notice {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'destructive';
  startDate: string; // ISO Date string
  endDate: string;   // ISO Date string
  targetRoles: ('financeiro' | 'expedicao' | 'sac' | 'admin' | 'socio')[];
  targetPages?: string[]; // Array of page paths like '/estoque'
  isActive: boolean;
  createdAt: string; // ISO Date
  createdBy: string; // User's email
}

export interface PickingNotice {
  id: string;
  targetStates: string[];
  message: string;
  type: 'info' | 'warning' | 'destructive';
  showOnce: boolean;
  timesShown: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}


export interface MercadoLivreCredentials {
  appId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  accessToken?: string;
  apiStatus?: ApiKeyStatus;
  nickname?: string;
  id_conta_autenticada?: string; 
  userId?: number;
  accountName?: string;
}

export interface MagaluCredentials {
    accountName: string;
    uuid: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accessToken?: string;
    apiStatus?: ApiKeyStatus;
}


export interface MlAccount {
    id: string; // Document ID from Firestore
    nickname?: string;
    accountName?: string;
    appId: string;
    clientSecret: string;
    refreshToken: string;
    redirectUri: string;
    apiStatus?: ApiKeyStatus;
    id_conta_autenticada?: string; 
    userId?: number;
}


// -- App Settings --
export interface AppSettings {
    iderisPrivateKey?: string;
    googleSheetsApiKey?: string;
    geminiApiKey?: string;
    openaiApiKey?: string; // New field for OpenAI
    mercadoLivre?: MercadoLivreCredentials;
    mercadoLivre2?: MercadoLivreCredentials;
    magalu?: MagaluCredentials;
    allMappings?: AllMappingsState;
    friendlyFieldNames?: Record<string, string>;
    fileNames?: { [key: string]: string };
    fileData?: { [key: string]: string };
    iderisApiStatus?: ApiKeyStatus;
    googleSheetsApiStatus?: ApiKeyStatus;
    geminiApiStatus?: ApiKeyStatus;
    openaiApiStatus?: ApiKeyStatus; // New field for OpenAI status
    permissions?: Record<string, string[]>;
    inactivePages?: string[];
    customCalculations?: any[];
    ignoredIderisColumns?: string[];
    conciliacaoColumnOrder?: string[];
    conciliacaoVisibleColumns?: Record<string, boolean>;
    stores?: string[];
    organizePrompt?: string;
    standardizePrompt?: string;
    lookupPrompt?: string;
    favoriteCategories?: MLCategory[];
    gordura_variable?: number;
}

// -- Purchase History Types --
export interface PurchaseListItem {
    productName: string;
    sku: string;
    quantity: number;
    unitCost: number;
    storeName: string;
    isPaid?: boolean;
    surplus?: number;
    isManual?: boolean;
}

export interface PurchaseList {
    id: string;
    createdAt: string; // ISO Date
    totalCost: number;
    items: PurchaseListItem[];
    totalEntradas?: number; // Adicionando o campo para o total de entradas
}

// Feed 25 Types
export interface ProductDetail {
  name: string;
  sku: string;
  quantity?: string; // Tornar opcional
  unitPrice?: string; // Tornar opcional
  totalPrice?: string; // Tornar opcional
  costPrice?: string; // Adicionar novo campo
}

export interface FeedEntry {
    storeName: string;
    date: string;
    products: ProductDetail[];
    id: string;
}

export interface UnprocessedItem {
  line: string;
  reason: string;
}

export interface OrganizeResult {
  organizedList: string[];
}

export interface StandardizeListOutput {
  standardizedList: string[];
  unprocessedItems: UnprocessedItem[];
}

const ProductDetailSchema = z.object({
  name: z.string(),
  sku: z.string(),
  costPrice: z.string(),
});

export const LookupResultSchema = z.object({
  details: z.array(ProductDetailSchema),
});
export type LookupResult = z.infer<typeof LookupResultSchema>;

export const LookupProductsInputSchema = z.object({
  productList: z.string().describe('The standardized, line-by-line list of products.'),
  databaseList: z.string().describe('The product database as a string, with "Name\\tSKU" per line.'),
  apiKey: z.string().optional(),
  prompt_override: z.string().optional(),
});
export type LookupProductsInput = z.infer<typeof LookupProductsInputSchema>;


export interface PipelineResult {
  organizedList: string;
  standardizedList: string;
  details: ProductDetail[];
  finalFormattedList: string;
  unprocessedItems: UnprocessedItem[];
}

// Conference History
export interface ConferenceResult {
  found: InventoryItem[];
  notFound: string[];
  notScanned: InventoryItem[];
}

export interface ConferenceHistoryEntry {
    id: string;
    date: string;
    results: ConferenceResult;
}

export type AnalyzeLabelOutput = {
  recipientName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  orderNumber: string;
  invoiceNumber: string;
  trackingNumber: string;
  senderName: string;
  senderAddress: string;
  estimatedDeliveryDate?: string;
  senderNeighborhood?: string;
  senderCityState?: string;
};

export type RemixableField = keyof Pick<AnalyzeLabelOutput, 'orderNumber' | 'invoiceNumber' | 'trackingNumber' | 'senderName' | 'senderAddress'>;

export type RemixLabelDataInput = {
    fieldToRemix: RemixableField;
    originalValue: string;
    apiKey?: string;
};

export type RemixLabelDataOutput = {
    newValue: string;
};

// Catalog Analysis Types
export const AnalyzeCatalogInputSchema = z.object({
  pdfContent: z.string().describe('The full text content extracted from a single PDF page.'),
  pageNumber: z.number().describe('The current page number being analyzed.'),
  totalPages: z.number().describe('The total number of pages in the PDF.'),
  brand: z.string().optional().describe('The brand of the products in the catalog.'),
  apiKey: z.string().optional().describe('The Gemini API key.'),
});
export type AnalyzeCatalogInput = z.infer<typeof AnalyzeCatalogInputSchema>;

export const CatalogProductSchema = z.object({
  name: z.string().describe('The full name of the product.'),
  model: z.string().describe('The specific model of the product (e.g., "Note 13 Pro", "Galaxy S24 Ultra").'),
  brand: z.string().describe('The brand of the product.'),
  description: z.string().describe('A brief description of the product, including details like color, memory, etc.'),
  price: z.string().describe('The price of the product, formatted as a string with a dot as decimal separator (e.g., "22.35").'),
  imageUrl: z.string().optional().describe('A placeholder image URL for the product.'),
  quantityPerBox: z.number().optional().describe('The number of units per box, if mentioned.'),
});

export const AnalyzeCatalogOutputSchema = z.object({
  products: z.array(CatalogProductSchema.extend({
    isTrending: z.boolean().optional(),
    matchedKeywords: z.array(z.string()).optional(),
  })).describe('A list of products extracted from the page.'),
});
export type AnalyzeCatalogOutput = z.infer<typeof AnalyzeCatalogOutputSchema>;

export interface CatalogProduct extends z.infer<typeof CatalogProductSchema> {}
export interface SearchableProduct extends CatalogProduct {
    refinedQuery?: string;
    isSearching?: boolean;
    searchError?: string;
    foundProducts?: any[];
    isTrending?: boolean;
    matchedKeywords?: string[];
}


// Refine Search Term Types
export const RefineSearchTermInputSchema = z.object({
  productName: z.string().describe('The full, original name of the product.'),
  productModel: z.string().optional().describe('The specific model of the product.'),
  productBrand: z.string().optional().describe('The brand of the product.'),
});
export type RefineSearchTermInput = z.infer<typeof RefineSearchTermInputSchema>;

export const RefineSearchTermOutputSchema = z.object({
  refinedQuery: z.string().describe('The optimized search term for Mercado Livre, containing only essential keywords.'),
});
export type RefineSearchTermOutput = z.infer<typeof RefineSearchTermOutputSchema>;


export interface MLCategory {
  id: string;
  name: string;
}

export interface Trend {
    keyword: string;
    embedding?: number[];
}

export interface BestSellerItem {
  id: string;
  position: number | null;
  title: string;
  price: number;
  thumbnail: string | null;
  permalink: string | null;
  model?: string;
}

export interface MlAnalysisResult {
    category: MLCategory;
    trends: Trend[];
    bestsellers: BestSellerItem[];
}

export interface SavedMlAnalysis {
  id: string;
  createdAt: string; // ISO date
  mainCategoryName: string;
  mainCategoryId: string;
  results: MlAnalysisResult[];
}

// Mercado Livre My Items Type
export interface MyItem {
    id: string;
    title: string;
    price: number;
    status: string;
    permalink: string;
    thumbnail: string;
    catalog_product_id?: string | null;
    currency_id: string;
    sale_terms: any[];
    warranty: string;
    accepts_mercadopago: boolean;
    available_quantity: number;
    sold_quantity: number;
    shipping: any;
    category_id: string;
    pictures: { url: string; secure_url: string }[];
    seller_custom_field: string | null;
    attributes: { id: string; value_name: string | null; name: string }[];
    variations: {
        id: number;
        price: number;
        available_quantity: number;
        sold_quantity: number;
        seller_custom_field: string | null;
        attribute_combinations: { id: string; name: string; value_id: string | null; value_name: string }[];
        attributes: { id: string; value_name: string | null; name: string }[];
        picture_ids: string[];
    }[];
    accountId: string;
    savedAt?: string; 
    marketplace?: string;
    // Adicionando os novos campos da coleção 'anuncios'
    data_sync?: string;
    id_conta_autenticada?: string;
    initial_quantity?: number;
    last_updated?: string;
    listing_type_id?: string;
    precificacao_automatica?: boolean;
    seller_id?: number;
    deliveryType?: string;
}


// Mercado Livre Cost Calculation Types
export interface SaleCost {
    listing_type_id: string;
    listing_type_name: string;
    price: number;
    sale_fee_rate: number;
    sale_fee: number;
    fixed_fee: number;
    shipping_cost: number;
    net_amount: number;
}

export interface SaleCosts {
    id: string;
    title: string;
    category_id: string;
    costs: SaleCost[];
}

export type MoneyLike = string | number | null | undefined;

export interface PostedOnAccount {
    accountId: string;
    accountName: string;
    listingTypeId: string;
}

export interface ProductResult {
    thumbnail: string;
    name: string;
    catalog_product_id: string;
    id: string;
    item_id?: string | null;
    brand: string;
    model: string;
    price: number;
    shipping_type: string;
    shipping_logistic_type: string;
    free_shipping: boolean;
    category_id: string;
    listing_type_id: string;
    seller_nickname: string;
    official_store_id: number | null;
    is_official_store: boolean;
    offerCount: number;
    attributes: { id: string, name: string, value_name: string | null }[];
    reputation?: {
        level_id: string | null;
        power_seller_status: string | null;
        metrics: {
            claims_rate: number;
            cancellations_rate: number;
            delayed_rate: number;
        }
    }
    seller_state?: string | null;
    seller_state_id?: string | null;
    seller_city?: string | null;
    seller_city_id?: string | null;
    date_created?: string | null;
    rating_average?: number;
    reviews_count?: number;
    postedOnAccounts?: PostedOnAccount[];
    raw_data?: {
      catalog_product?: any;
      winner_item?: any;
      fees_data?: any;
      reviews_data?: any;
    };
    fees?: {
      listing_fee_amount: number;
      sale_fee_amount: number;
      sale_fee_percent: number;
      fee_total?: number;
    };
}

export type FullFlowResult = {
    organizar: string;
    padronizar: string;
    lookup: string;
};


export interface CreateListingPayload {
  site_id: 'MLB';
  title?: string;
  category_id: string;
  price: number;
  currency_id: 'BRL';
  available_quantity: number;
  buying_mode: 'buy_it_now';
  listing_type_id: string;
  condition: 'new' | 'used' | 'not_specified';
  sale_terms: { id: string; value_name: string; }[];
  pictures: any[];
  attributes: {
    id: string;
    name?: string;
    value_id?: string;
    value_name: string;
    value_struct?: any;
    attribute_group_id?: string;
    attribute_group_name?: string;
  }[];
  catalog_product_id: string;
  catalog_listing: boolean;
  shipping?: any;
}


export interface CreateListingResult {
    success: boolean;
    error: string | null;
    result: any | null; // A resposta da API, seja de sucesso ou erro.
    payload?: CreateListingPayload;
}

export interface SuccessfulListing {
    productResultId: string;
    accountId: string;
    listingTypeId: string;
}


export interface SavedPdfAnalysis {
    id: string;
    createdAt: string; // ISO date
    analysisName: string;
    brand: string;
    extractedProducts: SearchableProduct[];
    batchSearchResults: ProductResult[];
}
    

    

    

    

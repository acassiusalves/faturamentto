export interface CatalogProduct {
  name: string;
  model: string;
  brand: string;
  description: string;
  price: string;
  imageUrl?: string;
  quantityPerBox?: number;
}

export interface SearchableProduct extends CatalogProduct {
  refinedQuery?: string;
  isSearching?: boolean;
  searchError?: string;
  foundProducts?: any[];
  isTrending?: boolean;
  matchedKeywords?: string[];
}

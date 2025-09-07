
'use server';

// lib/ml.ts (server)
const ML_API = 'https://api.mercadolibre.com';

export interface MLCategory {
  id: string;
  name: string;
}

export interface MLCategoryInfo {
  id: string;
  name: string;
  path_from_root?: Array<{ id: string; name: string }>;
  children_categories?: Array<{ id: string; name: string; total_items_in_this_category?: number }>;
}

/** Lista as categorias de topo do site (não precisa token). */
export async function getRootCategories(siteId = 'MLB'): Promise<MLCategory[]> {
  const res = await fetch(`${ML_API}/sites/${siteId}/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ML categories root error: ${res.status}`);
  return await res.json();
}

/** Detalhes de uma categoria: ancestrais, filhas etc. */
export async function getCategoryInfo(categoryId: string): Promise<MLCategoryInfo> {
  const res = await fetch(`${ML_API}/categories/${categoryId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ML category info error (${categoryId}): ${res.status}`);
  return await res.json();
}

/** Filhas diretas da categoria. */
export async function getCategoryChildren(categoryId: string) {
  const info = await getCategoryInfo(categoryId);
  return info.children_categories ?? [];
}

/** Cadeia de ancestrais (breadcrumb). */
export async function getCategoryAncestors(categoryId: string) {
  const info = await getCategoryInfo(categoryId);
  return info.path_from_root ?? [];
}


/**
 * Fetches the total number of active offers for a given catalog product ID.
 * @param productId The Mercado Livre catalog product ID (e.g., "MLB123456").
 * @param accessToken A valid Mercado Livre access token.
 * @returns The total number of offers, or 0 if the request fails.
 */
export async function getCatalogOfferCount(productId: string, accessToken: string): Promise<number> {
  if (!productId || !accessToken) return 0;

  const url = `${ML_API}/products/${productId}/items?limit=1`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Important: always server-side to prevent caching sensitive fetches
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`Failed to fetch offer count for ${productId}: ${res.status}`);
      return 0; // Return 0 on failure to avoid breaking the UI
    }

    const data = await res.json();
    // Use paging.total if available, otherwise fallback to results length
    const total = data?.paging?.total ?? (Array.isArray(data?.results) ? data.results.length : 0);
    return Number.isFinite(total) ? total : 0;
  } catch (error) {
    console.error(`Exception fetching offer count for ${productId}:`, error);
    return 0;
  }
}

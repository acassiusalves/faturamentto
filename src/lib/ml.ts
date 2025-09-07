'use server';

// lib/ml.ts (server)
const ML_API = 'https://api.mercadolibre.com';

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

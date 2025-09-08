
// @ts-nocheck
import { generateNewAccessToken as getMlToken } from '@/services/mercadolivre';

const ML_API = 'https://api.mercadolibre.com';

export interface MLCategory { id: string; name: string; }
export interface MLCategoryInfo {
  id: string;
  name: string;
  path_from_root?: Array<{ id: string; name: string }>;
  children_categories?: Array<{ id: string; name: string; total_items_in_this_category?: number }>;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    // importante: sempre server-side, sem cache
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'YourApp/1.0 (+contato@exemplo.com)',
      ...(init?.headers || {}),
    },
    ...init,
  });
  return res;
}

export async function getRootCategories(siteId = 'MLB'): Promise<MLCategory[]> {
  const url = `${ML_API}/sites/${siteId}/categories`;

  // 1ª tentativa: sem token
  let res = await fetchJson(url);
  if (res.status === 403) {
    // 2ª tentativa: com token (alguns ambientes precisam)
    try {
      const token = await getMlToken();
      res = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch { /* se falhar o token, segue com o 403 original */ }
  }

  if (!res.ok) throw new Error(`ML categories root error: ${res.status}`);
  return await res.json();
}

export async function getCategoryInfo(categoryId: string): Promise<MLCategoryInfo> {
  const url = `${ML_API}/categories/${categoryId}`;
  // idem: tenta sem token, cai pra com token se 403
  let res = await fetchJson(url);
  if (res.status === 403) {
    try {
      const token = await getMlToken();
      res = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch {}
  }
  if (!res.ok) throw new Error(`ML category info error (${categoryId}): ${res.status}`);
  return await res.json();
}

export async function getCategoryChildren(categoryId: string) {
  const info = await getCategoryInfo(categoryId);
  return info.children_categories ?? [];
}

export async function getCategoryAncestors(categoryId: string) {
  const info = await getCategoryInfo(categoryId);
  return info.path_from_root ?? [];
}

export async function getCatalogOfferCount(productId: string, accessToken: string): Promise<number> {
    if (!productId) return 0;
    try {
        const url = `https://api.mercadolibre.com/products/${productId}/items?limit=0`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
        if (!res.ok) return 0;
        const data = await res.json();
        return data?.paging?.total || 0;
    } catch {
        return 0;
    }
}

/** Busca tendências de uma categoria. Tenta sem token; se 403, re-tenta com Bearer.
 *  Retorna sempre no shape { keyword: string }[]  */
export async function getCategoryTrends(
  categoryId: string,
  limit = 50
): Promise<{ keyword: string }[]> {
  const url = `${ML_API}/trends/MLB/${categoryId}?limit=${limit}`;

  // 1ª tentativa: sem token, com User-Agent (via fetchJson)
  let res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'YourApp/1.0 (+contato@exemplo.com)',
    },
  });

  // 2ª tentativa: se 403, re-tenta com token do ML
  if (res.status === 403) {
    try {
      const token = await getMlToken();
      res = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'YourApp/1.0 (+contato@exemplo.com)',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // se não conseguir token, deixa cair pro erro abaixo
    }
  }

  // Alguns IDs não têm trends -> pode vir 404; trate como lista vazia
  if (res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`ML trends error (${categoryId}): ${res.status}`);
  }

  const raw = await res.json();
  return (raw || [])
    .map((t: any) => ({ keyword: t?.keyword ?? t?.q ?? String(t ?? '') }))
    .filter((t) => t.keyword);
}

// src/services/magalu.ts
'use server';

const API_BASE = "https://api.magalu.com";

export interface MagaluSku {
  sku: string;
  title?: string;
  brand?: string;
  ean?: string;
  price?: any;
  stock?: any;
}

export async function listSellerSkus(accessToken: string, page?: number, perPage?: number)
: Promise<{ results: MagaluSku[] }> {
  let url = `${API_BASE}/seller/v1/portfolios/skus`;
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (perPage) params.set("per_page", String(perPage));
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const r = await fetch(url, {
    headers: { 
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}` 
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error("Magalu listSellerSkus error:", r.status, r.statusText, body);
    throw new Error(`Falha ao listar SKUs da Magalu: ${r.status} ${r.statusText}`);
  }

  const data = await r.json();
  return { results: data.results ?? [] };
}

export async function getSkuDetails(accessToken: string, sku: string) {
  const url = `${API_BASE}/seller/v1/portfolios/skus/${encodeURIComponent(sku)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!r.ok) {
    console.warn(`Get details for ${sku} failed: ${r.status} ${r.statusText} ${await r.text().catch(()=> "")}`);
    return null;
  }
  try { return await r.json(); } catch { return null; }
}

export async function getSkuPrice(accessToken: string, sku: string) {
  const url = `${API_BASE}/seller/v1/portfolios/skus/${encodeURIComponent(sku)}/prices`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    console.warn(`Get price ${sku} failed: ${r.status} ${r.statusText} ${await r.text().catch(()=> "")}`);
    return null;
  }
  try { return await r.json(); } catch { return null; }
}

export async function getSkuStock(accessToken: string, sku: string) {
  const url = `${API_BASE}/seller/v1/portfolios/skus/${encodeURIComponent(sku)}/stocks`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    console.warn(`Get stock ${sku} failed: ${r.status} ${r.statusText} ${await r.text().catch(()=> "")}`);
    return null;
  }
  try { return await r.json(); } catch { return null; }
}

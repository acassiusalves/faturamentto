// src/services/magalu.ts
'use server';

const API_BASE = "https://openapi.magalu.com";

export interface MagaluSku {
  sku: string;
  title?: string;
  brand?: string;
  ean?: string;
  price?: any; // To hold price info
  stock?: any; // To hold stock info
}

export async function listSellerSkus(accessToken: string, page?: number, perPage?: number): Promise<{ items: MagaluSku[] }> {
  const url = new URL(`${API_BASE}/seller/v1/portfolios/skus`);
  if (page) url.searchParams.set("page", String(page));
  if (perPage) url.searchParams.set("per_page", String(perPage));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    const errorText = await r.text();
    console.error("Magalu listSellerSkus error:", errorText);
    throw new Error(`Falha ao listar SKUs da Magalu: ${r.statusText}`);
  }
  return r.json() as Promise<{ items: MagaluSku[] }>;
}

export async function getSkuPrice(accessToken: string, sku: string): Promise<any> {
  const r = await fetch(`${API_BASE}/seller/v1/portfolios/prices/${encodeURIComponent(sku)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
      console.warn(`Get price for SKU ${sku} failed with status ${r.status}`);
      return null;
  }
  try {
    return await r.json();
  } catch (e) {
    console.error(`Failed to parse price JSON for SKU ${sku}`, e);
    return null;
  }
}

export async function getSkuStock(accessToken: string, sku: string): Promise<any> {
  const r = await fetch(`${API_BASE}/seller/v1/portfolios/stocks/${encodeURIComponent(sku)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    console.warn(`Get stock for SKU ${sku} failed with status ${r.status}`);
    return null;
  }
  try {
    return await r.json();
  } catch (e) {
    console.error(`Failed to parse stock JSON for SKU ${sku}`, e);
    return null;
  }
}

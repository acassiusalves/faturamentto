// src/services/magalu.ts
'use server';

const API_BASE = "https://openapi.magalu.com";

export interface MagaluSku {
  sku: string;
  title?: string;
  brand?: string;
  ean?: string;
  price?: any;
  stock?: any;
}

// ❌ NÃO precisa de sellerId no path
export async function listSellerSkus(accessToken: string, page?: number, perPage?: number)
: Promise<{ items: MagaluSku[] }> {
  const url = new URL(`${API_BASE}/seller/v1/portfolios/skus`);
  if (page) url.searchParams.set("page", String(page));
  if (perPage) url.searchParams.set("per_page", String(perPage));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.error("Magalu listSellerSkus error:", r.status, r.statusText, body);
    throw new Error(`Falha ao listar SKUs da Magalu: ${r.status} ${r.statusText}`);
  }

  const data = await r.json();
  return Array.isArray(data) ? { items: data } : { items: data.items ?? [] };
}

// ❌ remover sellerId do path
export async function getSkuPrice(accessToken: string, sku: string) {
  const r = await fetch(`${API_BASE}/seller/v1/portfolios/prices/${encodeURIComponent(sku)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.warn(`Get price ${sku} failed: ${r.status} ${r.statusText} ${body}`);
    return null;
  }
  try { return await r.json(); } catch { return null; }
}

export async function getSkuStock(accessToken: string, sku: string) {
  const r = await fetch(`${API_BASE}/seller/v1/portfolios/stocks/${encodeURIComponent(sku)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    console.warn(`Get stock ${sku} failed: ${r.status} ${r.statusText} ${body}`);
    return null;
  }
  try { return await r.json(); } catch { return null; }
}

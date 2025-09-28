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

// ✅ Endpoint para listar SKUs (já estava correto)
export async function listSellerSkus(accessToken: string, page?: number, perPage?: number)
: Promise<{ items: MagaluSku[] }> {
  const url = new URL(`${API_BASE}/seller/v1/portfolios/skus`);
  if (page) url.searchParams.set("page", String(page));
  if (perPage) url.searchParams.set("per_page", String(perPage));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
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

// ⬆️ CORREÇÃO: Preço de um SKU (sub-recurso do SKU)
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

// ⬆️ CORREÇÃO: Estoque de um SKU (sub-recurso do SKU)
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

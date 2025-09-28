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

export async function listSellerSkus(accessToken: string, sellerId: string, page?: number, perPage?: number): Promise<{ items: MagaluSku[] }> {
  if (!sellerId) throw new Error("O ID do vendedor (UUID) é obrigatório para listar SKUs.");
  
  const url = new URL(`${API_BASE}/seller/v1/sellers/${sellerId}/skus`);
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
  const data = await r.json();
  // A API pode retornar um objeto com a chave "items" ou diretamente um array
  return data.items ? data : { items: data };
}

export async function getSkuPrice(accessToken: string, sellerId: string, sku: string): Promise<any> {
   if (!sellerId) throw new Error("O ID do vendedor (UUID) é obrigatório para consultar preços.");
  const r = await fetch(`${API_BASE}/seller/v1/sellers/${sellerId}/skus/${encodeURIComponent(sku)}/prices`, {
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

export async function getSkuStock(accessToken: string, sellerId: string, sku: string): Promise<any> {
  if (!sellerId) throw new Error("O ID do vendedor (UUID) é obrigatório para consultar estoque.");
  const r = await fetch(`${API_BASE}/seller/v1/sellers/${sellerId}/skus/${encodeURIComponent(sku)}/stocks`, {
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

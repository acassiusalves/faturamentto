
// @ts-nocheck

import { loadAppSettings } from "./firestore";
import type { MercadoLivreCredentials } from "@/lib/types";

// Cache em memória para o token de acesso
let inMemoryAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000; // O token do ML dura 6 horas, usamos um pouco menos por segurança

/**
 * Obtém um novo access_token usando o refresh_token.
 */
async function getValidAccessToken(): Promise<string> {
  if (inMemoryAccessToken && inMemoryAccessToken.expiresAt > Date.now()) {
    return inMemoryAccessToken.token;
  }
  const settings = await loadAppSettings();
  const creds = settings?.mercadoLivre;
  if (!creds?.refreshToken || !creds?.appId || !creds?.clientSecret || !creds?.redirectUri) {
    throw new Error("Credenciais do Mercado Livre não configuradas.");
  }

  const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.appId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      redirect_uri: creds.redirectUri,
    }).toString(),
    cache: "no-store" as RequestCache,
  });

  const data = await resp.json();
  if (!resp.ok || !data?.access_token) {
    throw new Error(`Falha ao atualizar token: ${data?.message || resp.status}`);
  }
  inMemoryAccessToken = { token: data.access_token, expiresAt: Date.now() + TOKEN_LIFETIME_MS };
  return data.access_token;
}

// util: extrai valor de atributo por ids
function getAttr(attrs: any[] | undefined, ids: string[]): string {
  const a = (attrs || []).find((x: any) => ids.includes(x?.id));
  return a?.value_name || a?.values?.[0]?.name || "";
}
const toHttps = (u?: string) => (u ? u.replace(/^http:\/\//, "https://") : "");

// === FUNÇÃO PRINCIPAL ===
export async function searchMercadoLivreProducts(query: string, quantity: number): Promise<any[]> {
  // Mapeamentos para nomes amigáveis
  const freightMap: Record<string, string> = {
    "drop_off": "Correios",
    "xd_drop_off": "Correios",
    "xd_pick_up": "Correios",
    "fulfillment": "Full ML",
    "cross_docking": "Agência ML",
    "pick_up": "Retirada",
    "prepaid": "Frete pré-pago",
    "self_service": "Sem Mercado Envios",
    "custom": "A combinar"
  };

  const listingTypeMap: Record<string, string> = {
    "gold_special": "Clássico",
    "gold_pro": "Premium"
  };

  // 1) catálogos
  const accessToken = await getValidAccessToken();
  const searchUrl = `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(
    query
  )}&limit=${quantity}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  
  const searchRes = await fetch(searchUrl, { method: "GET", headers, cache: "no-store" as RequestCache });
  const searchData = await searchRes.json();
  if (!searchRes.ok) {
    throw new Error(`Erro na busca de produtos: ${searchData?.message || searchRes.status}`);
  }
  const catalogProducts: any[] = Array.isArray(searchData?.results) ? searchData.results : [];
  if (catalogProducts.length === 0) return [];

  // 2) vencedor por catálogo
  const CONCURRENCY = 8;
  const winnerByCat = new Map<string, any>();
  for (let i = 0; i < catalogProducts.length; i += CONCURRENCY) {
    const batch = catalogProducts.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (p) => {
        const url = `https://api.mercadolibre.com/products/${p.id}/items?limit=1`;
        const r = await fetch(url, { method: "GET", headers, cache: "no-store" as RequestCache });
        if (!r.ok) return;
        const j = await r.json();
        const winner = j?.results?.[0];
        if (winner) winnerByCat.set(p.id, winner);
      })
    );
  }

  // 3) apelidos de vendedores (opcional)
  const sellerIds = Array.from(
    new Set(Array.from(winnerByCat.values()).map((w: any) => w?.seller_id).filter(Boolean))
  );
  const sellerNickById = new Map<number, string>();
  for (let i = 0; i < sellerIds.length; i += CONCURRENCY) {
    const part = sellerIds.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      part.map(async (sid: number) => {
        const u = `https://api.mercadolibre.com/users/${sid}`;
        const r = await fetch(u, { method: "GET", headers, cache: "no-store" as RequestCache });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.id) sellerNickById.set(j.id, j.nickname || "");
      })
    );
  }

  // 4) montar saída final
  return catalogProducts.map((p) => {
    const attrs = Array.isArray(p?.attributes) ? p.attributes : [];
    const brand =
      p?.brand ||
      getAttr(attrs, ["BRAND", "MARCA"]) ||
      "N/A";
    const model =
      p?.model ||
      getAttr(attrs, ["MODEL", "MODELO", "ALPHANUMERIC_MODEL", "MODEL_NUMBER"]) ||
      "N/A";

    const thumb =
      p?.secure_thumbnail ||
      p?.thumbnail ||
      (Array.isArray(p?.pictures) && (p.pictures[0]?.secure_url || p.pictures[0]?.url)) ||
      "";

    const winner = winnerByCat.get(p.id);
    const price =
      winner?.price ??
      winner?.prices?.prices?.[0]?.amount ??
      0;
      
    const rawListingType = winner?.listing_type_id || "";
    const rawFreightType = winner?.shipping?.logistic_type || "";

    return {
      // catálogo
      id: p.id, // id do catálogo
      catalog_product_id: p.id,
      name: (p.name || "").trim(),
      status: p.status || "active",
      brand,
      model,
      thumbnail: toHttps(thumb),

      // anúncio vencedor (se houver)
      price: Number(price) || 0,
      shipping: freightMap[rawFreightType] || rawFreightType || (winner?.shipping?.free_shipping ? "Grátis" : "N/A"),
      listing_type_id: listingTypeMap[rawListingType] || rawListingType || "N/A",
      category_id: winner?.category_id ?? "",
      official_store_id: winner?.official_store_id ?? null,
      seller_id: winner?.seller_id ?? "",
      seller_nickname: winner?.seller_id ? (sellerNickById.get(winner.seller_id) || "") : "",
    };
  });
}


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
export async function generateNewAccessToken(creds: MercadoLivreCredentials): Promise<string> {
  if (!creds.refreshToken || !creds.appId || !creds.clientSecret || !creds.redirectUri) {
    throw new Error("Credenciais do Mercado Livre (App ID, Secret Key, Refresh Token, Redirect URI) não estão configuradas.");
  }
  
  const url = "https://api.mercadolibre.com/oauth/token";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: creds.appId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    redirect_uri: creds.redirectUri,
  });

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: body.toString(),
    cache: 'no-store' as RequestCache,
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok || !result.access_token) {
      console.error("Erro ao obter novo token do Mercado Livre:", result);
      throw new Error(`Falha ao atualizar token: ${result.message || 'Verifique as credenciais.'}`);
    }

    console.log("✅ Novo token de acesso do Mercado Livre obtido com sucesso.");
    return result.access_token;

  } catch (e) {
    console.error("❌ Exceção ao atualizar token: " + e);
    throw e;
  }
}

/**
 * Obtém um token de acesso válido, seja do cache ou gerando um novo.
 */
async function getValidAccessToken(): Promise<string> {
  if (inMemoryAccessToken && inMemoryAccessToken.expiresAt > Date.now()) {
    return inMemoryAccessToken.token;
  }

  const settings = await loadAppSettings();
  if (!settings?.mercadoLivre) {
      throw new Error("Credenciais do Mercado Livre não configuradas no sistema.");
  }

  const newToken = await generateNewAccessToken(settings.mercadoLivre);
  
  inMemoryAccessToken = {
    token: newToken,
    expiresAt: Date.now() + TOKEN_LIFETIME_MS,
  };

  return newToken;
}

/**
 * Busca produtos de catálogo e enriquece com dados da oferta vencedora.
 */
export async function searchMercadoLivreProducts(query: string, quantity: number): Promise<any[]> {
    const accessToken = await getValidAccessToken();
    const site = "MLB"; // Site Brasil
    
    // 1. Buscar produtos de catálogo
    const searchUrl = `https://api.mercadolibre.com/products/search?status=active&site_id=${site}&q=${encodeURIComponent(query)}&limit=${quantity}`;
    const searchOptions = {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` },
    };
    
    const searchResponse = await fetch(searchUrl, searchOptions);
    const searchData = await searchResponse.json();
    if (!searchResponse.ok) {
        throw new Error(`Erro na busca de produtos: ${searchData.message || 'Falha na busca'}`);
    }
    const catalogProducts = searchData.results || [];
    if (catalogProducts.length === 0) return [];

    // 2. Montar IDs para busca de itens vencedores
    const catalogProductIds = catalogProducts.map(p => p.id).join(',');

    // 3. Buscar itens vencedores em uma única chamada multi-get
    const itemsUrl = `https://api.mercadolibre.com/items?ids=${catalogProductIds.split(',').map(id => `MLB${id.replace('MLB','')}`).join(',')}`;
    const itemsOptions = {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` },
    };

    const itemsResponse = await fetch(itemsUrl, itemsOptions);
    const itemsData = await itemsResponse.json();
    
    const itemsMap = new Map();
    if (Array.isArray(itemsData)) {
      itemsData.forEach(itemResult => {
        if (itemResult.code === 200 && itemResult.body) {
          const catId = itemResult.body.catalog_product_id;
          if (catId) {
            itemsMap.set(catId, itemResult.body);
          }
        }
      });
    }

    // 4. Mesclar os dados
    const enrichedProducts = catalogProducts.map(product => {
        const winningItem = itemsMap.get(product.id);
        const sellerInfo = winningItem?.seller_id ? { seller_id: winningItem.seller_id, seller_nickname: '' } : {}; // Placeholder, seller name needs another call

        return {
            ...product, // Dados do catálogo (id, name, catalog_product_id, attributes)
            price: winningItem?.price ?? 0,
            shipping: winningItem?.shipping?.free_shipping ?? false,
            listing_type_id: winningItem?.listing_type_id ?? '',
            category_id: winningItem?.category_id ?? '',
            ...sellerInfo,
        };
    });

    return enrichedProducts;
}



'use server';

import { loadAppSettings, getMlCredentialsById } from '@/services/firestore';
import type { MercadoLivreCredentials, CreateListingPayload } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';


type MlTokenResponse = {
  access_token: string;
  expires_in: number; // em segundos (geralmente ~21600 = 6h)
};

// Agora o cache guarda tokens por conta
const _tokenCache: Record<string, { token: string; expiresAt: number }> = {};
const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6 horas em ms

export async function generateNewAccessToken(creds: {
    appId: string;
    clientSecret: string;
    refreshToken: string;
}): Promise<string> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: creds.appId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
    });

    const r = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
    });

    if (!r.ok) {
        const msg = await r.text();
        console.error("ML Token Generation Error:", msg);
        throw new Error(`Falha ao renovar token do Mercado Livre: ${msg}`);
    }

    const j = await r.json() as MlTokenResponse;
    return j.access_token;
}

export async function getMlToken(accountIdentifier?: string): Promise<string> {
  // Use 'primary' as a default key if no identifier is provided
  const cacheKey = accountIdentifier || 'primary';
  const cached = _tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt - 60_000) { // 60s buffer
    return cached.token;
  }

  // Se o identificador for um ID do Firestore, busca por ID.
  const creds = await getMlCredentialsById(accountIdentifier);

  if (!creds || !creds.appId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error(`Credenciais para a conta '${cacheKey}' do Mercado Livre não estão configuradas ou estão incompletas.`);
  }

  const token = await generateNewAccessToken(creds);
  
  _tokenCache[cacheKey] = {
    token: token,
    expiresAt: Date.now() + TOKEN_LIFETIME_MS,
  };

  return token;
}


export async function searchMercadoLivreProducts(query: string, limit: number = 20): Promise<any[]> {
    const token = await getMlToken(); // Usa a conta primária para buscas
    const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro na API do Mercado Livre: ${errorData.message}`);
    }
    
    const data = await response.json();
    return data.results || [];
}

/** Se já existir no arquivo, mantenha. Só certifique-se de exportar. */
export async function getSellersReputation(
  sellerIds: number[],
  token: string
): Promise<Record<number, any>> {
  if (!sellerIds?.length) return {};
  const uniq = Array.from(new Set(sellerIds)).filter(Boolean);

  // consulta em lotes simples
  const out: Record<number, any> = {};
  const CONCURRENCY = 8;
  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    const batch = uniq.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (sid) => {
        const r = await fetch(`https://api.mercadolibre.com/users/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!r.ok) return;
        const j = await r.json();
        out[sid] = {
          nickname: j?.nickname ?? null,
          level_id: j?.seller_reputation?.level_id ?? null,
          power_seller_status: j?.seller_reputation?.power_seller_status ?? null,
          metrics: {
            claims_rate: j?.seller_reputation?.metrics?.claims_rate ?? 0,
            cancellations_rate: j?.seller_reputation?.metrics?.cancellations_rate ?? 0,
            delayed_rate: j?.seller_reputation?.metrics?.delayed_rate ?? 0,
          },
        };
      })
    );
  }
  return out;
}


const ML_API_BASE = "https://api.mercadolibre.com";


export async function createListingFromCatalog(payload: CreateListingPayload, accessToken: string) {
    try {
        const { 
            catalog_product_id, 
            price, 
            available_quantity, 
            listing_type_id, 
            buying_mode,
            condition,
            category_id,
        } = payload;
        

        if (!category_id) {
            throw new Error('Não foi possível determinar a categoria do produto a partir do catálogo.');
        }

        const itemPayload: Record<string, any> = {
            site_id: "MLB",
            category_id: category_id,
            price: price,
            currency_id: 'BRL',
            available_quantity: available_quantity,
            buying_mode: buying_mode,
            listing_type_id: listing_type_id,
            sale_terms: [
                { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
                { id: "WARRANTY_TIME", value_name: "3 meses" }
            ],
            pictures: [],
            attributes: [
                 { id: "ITEM_CONDITION", value_name: condition === 'new' ? 'Novo' : 'Usado' },
                 { id: "SELLER_SKU", value_name: "XIA-N13P-256-BLK" }
            ],
            catalog_product_id: catalog_product_id,
            catalog_listing: true,
        };
        
        const createItemUrl = `${ML_API_BASE}/items`;

        const response = await fetch(createItemUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(itemPayload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('ML API Error Response:', JSON.stringify(responseData, null, 2));
            const errorMessage = responseData.message || 'Erro desconhecido da API do ML.';
            const finalError = responseData.cause?.[0]?.message || errorMessage;
            return { data: responseData, error: finalError };
        }

        return { data: responseData, error: null };
    } catch (e: any) {
        console.error("Error in createListingFromCatalog:", e);
        return { data: null, error: e.message || 'Erro inesperado ao criar o anúncio.' };
    }
}



'use server';

import { loadAppSettings } from '@/services/firestore';
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
        throw new Error(`Falha ao renovar token do Mercado Livre: ${msg}`);
    }

    const j = await r.json() as MlTokenResponse;
    return j.access_token;
}

export async function getMlToken(accountIdentifier?: string): Promise<string> {
  const cacheKey = accountIdentifier || 'primary';
  const cached = _tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  
  let creds: Partial<MercadoLivreCredentials> | null = null;

  if (accountIdentifier) {
      // Prioritize direct lookup by ID if it's a valid Firestore ID format
      if (/^[a-zA-Z0-9]{20}$/.test(accountIdentifier)) {
          const accountDocRef = doc(db, 'mercadoLivreAccounts', accountIdentifier);
          const docSnap = await getDoc(accountDocRef);
          if (docSnap.exists()) {
              creds = docSnap.data() as MercadoLivreCredentials;
          }
      }
      
      // If not found by ID, try by name
      if (!creds) {
          const accountsCol = collection(db, 'mercadoLivreAccounts');
          const q = query(accountsCol, where("accountName", "==", accountIdentifier), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
              creds = snapshot.docs[0].data() as MercadoLivreCredentials;
          }
      }
  } 
  
  // Fallback to primary account from settings if no specific account was found
  if (!creds) {
     const settings = await loadAppSettings().catch(() => null);
     creds = settings?.mercadoLivre || null;
  }
  
  if (!creds || !creds.appId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error(`Credenciais para a conta '${cacheKey}' do Mercado Livre não estão configuradas ou estão incompletas.`);
  }

  const token = await generateNewAccessToken({
      appId: creds.appId,
      clientSecret: creds.clientSecret,
      refreshToken: creds.refreshToken
  });
  
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

async function fetchProductDetails(catalogProductId: string, token: string) {
    const url = `${ML_API_BASE}/products/${catalogProductId}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Falha ao buscar detalhes do produto de catálogo: ${errorData.message}`);
    }
    return response.json();
}

export async function createListingFromCatalog(payload: CreateListingPayload) {
    try {
        const { 
            catalog_product_id, 
            price, 
            available_quantity, 
            listing_type_id, 
            accountId, // This is now the Firestore document ID
            buying_mode,
            condition,
        } = payload;
        
        // Use the accountId (document ID) to get the token
        const token = await getMlToken(accountId);

        // 1. Fetch product details from catalog to get correct category, variations, etc.
        const productDetails = await fetchProductDetails(catalog_product_id, token);

        const category_id = productDetails.category_id;
        if (!category_id) {
            throw new Error('Não foi possível determinar a categoria do produto a partir do catálogo.');
        }

        const itemPayload: Record<string, any> = {
            title: productDetails.name || `Anúncio para ${catalog_product_id}`,
            category_id: category_id,
            site_id: "MLB",
            catalog_product_id,
            price,
            currency_id: 'BRL',
            available_quantity,
            buying_mode,
            condition,
            listing_type_id,
            pictures: [], // Empty for catalog listings
            catalog_listing: true, // Ensure it's a catalog listing
            sale_terms: [
                { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
                { id: "WARRANTY_TIME", value_name: "3 meses" }
            ],
            attributes: [
                 { id: "ITEM_CONDITION", value_name: condition === 'new' ? 'Novo' : 'Usado' },
            ]
        };

        // 2. Check for variations and add if they exist
        if (productDetails.variations && productDetails.variations.length > 0) {
            const firstVariation = productDetails.variations[0];
            if (firstVariation.id) {
                itemPayload.catalog_product_variation_id = String(firstVariation.id);
            }
        }
        
        const createItemUrl = `${ML_API_BASE}/items`;

        const response = await fetch(createItemUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(itemPayload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('ML API Error Response:', JSON.stringify(responseData, null, 2));
            const errorMessage = responseData.message || 'Erro desconhecido da API do ML.';
            return { data: responseData, error: errorMessage };
        }

        return { data: responseData, error: null };
    } catch (e: any) {
        console.error("Error in createListingFromCatalog:", e);
        return { data: null, error: e.message || 'Erro inesperado ao criar o anúncio.' };
    }
}

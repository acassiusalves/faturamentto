
'use server';

import { loadAppSettings } from '@/services/firestore';
import type { MercadoLivreCredentials } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';


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

export async function getMlToken(accountId?: string): Promise<string> {
  const cacheKey = accountId || 'primary';
  const cached = _tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt - 60_000) { // 1 min de margem
    return cached.token;
  }
  
  let creds: Partial<MercadoLivreCredentials> & { appId?: string } | undefined;

  if (accountId) {
      const accountDocRef = doc(db, 'mercadoLivreAccounts', accountId);
      const docSnap = await getDoc(accountDocRef);
      if (docSnap.exists()) {
          creds = docSnap.data() as Partial<MercadoLivreCredentials> & { appId?: string };
      } else {
          throw new Error(`A conta do Mercado Livre com ID '${accountId}' não foi encontrada.`);
      }
  } else {
     const settings = await loadAppSettings().catch(() => null);
     creds = settings?.mercadoLivre;
  }
  
  const appId = creds?.appId;

  if (!appId || !creds?.clientSecret || !creds?.refreshToken) {
    throw new Error(`Credenciais para a conta '${cacheKey}' do Mercado Livre não estão configuradas ou estão incompletas.`);
  }

  const token = await generateNewAccessToken({
      appId,
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

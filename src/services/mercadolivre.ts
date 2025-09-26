
'use server';

import { loadAppSettings } from '@/services/firestore';
import type { MercadoLivreCredentials } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';


type MlTokenResponse = {
  access_token: string;
  expires_in: number; // em segundos (geralmente ~21600 = 6h)
};

// Agora o cache guarda tokens por conta
const _tokenCache: Record<string, { token: string; expiresAt: number }> = {};
const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000; // 6 horas em ms

export async function getMlToken(account?: string): Promise<string> {
  const cacheKey = account || 'primary';
  const cached = _tokenCache[cacheKey];

  if (cached && Date.now() < cached.expiresAt - 60_000) { // 1 min de margem
    return cached.token;
  }
  
  let creds: Partial<MercadoLivreCredentials> & { clientId?: string } | undefined;

  // Se o 'account' for fornecido, assume que é um ID de documento
  // da coleção `mercadoLivreAccounts`
  if (account) {
      const accountDocRef = doc(db, 'mercadoLivreAccounts', account);
      const docSnap = await getDoc(accountDocRef);
      if (docSnap.exists()) {
          creds = docSnap.data() as Partial<MercadoLivreCredentials> & { clientId?: string };
      } else {
          throw new Error(`A conta do Mercado Livre com ID '${account}' não foi encontrada.`);
      }
  } else {
     // Lógica original para conta primária (fallback)
     const settings = await loadAppSettings().catch(() => null);
     creds = settings?.mercadoLivre;
  }

  const appId = creds?.appId || creds?.clientId;

  if (!appId || !creds?.clientSecret || !creds?.refreshToken) {
    throw new Error(`Credenciais para a conta '${cacheKey}' do Mercado Livre não estão configuradas ou estão incompletas.`);
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appId,
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
    console.error(`Falha ao renovar token do ML para conta '${cacheKey}':`, msg);
    throw new Error(`Falha ao renovar token do Mercado Livre (${cacheKey}): ${msg}`);
  }

  const j = (await r.json()) as MlTokenResponse;
  
  _tokenCache[cacheKey] = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in * 1000 || TOKEN_LIFETIME_MS),
  };

  return j.access_token;
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

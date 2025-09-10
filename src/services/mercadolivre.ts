
'use server';

import { loadAppSettings } from '@/services/firestore';

type MlTokenResponse = {
  access_token: string;
  expires_in: number; // em segundos (geralmente ~21600 = 6h)
};

let _cachedToken: string | null = null;
let _expiresAt = 0;

export async function getMlToken(): Promise<string> {
  // cache simples em memória do servidor
  if (_cachedToken && Date.now() < _expiresAt - 60_000) {
    return _cachedToken;
  }

  const settings = await loadAppSettings().catch(() => null);

  // 1) token “fixo” salvo nas settings (sem refresh)
  if (settings?.mlAccessToken && !settings?.mlRefreshToken) {
    _cachedToken = settings.mlAccessToken;
    // vence em ~55min só pra não deixar infinito
    _expiresAt = Date.now() + 55 * 60 * 1000;
    return _cachedToken;
  }

  // 2) fluxo oficial com refresh_token (recomendado)
  const clientId = settings?.mlClientId || process.env.ML_CLIENT_ID;
  const clientSecret = settings?.mlClientSecret || process.env.ML_CLIENT_SECRET;
  const refreshToken = settings?.mlRefreshToken || process.env.ML_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: String(clientId),
      client_secret: String(clientSecret),
      refresh_token: String(refreshToken),
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

    const j = (await r.json()) as MlTokenResponse;
    _cachedToken = j.access_token;
    _expiresAt = Date.now() + (j.expires_in ?? 21600) * 1000;
    return _cachedToken;
  }

  // 3) fallback env var com access token direto
  const envToken = process.env.ML_ACCESS_TOKEN || process.env.NEXT_PUBLIC_ML_ACCESS_TOKEN;
  if (envToken) {
    _cachedToken = envToken;
    _expiresAt = Date.now() + 55 * 60 * 1000;
    return _cachedToken;
  }

  throw new Error(
    'Token do Mercado Livre não configurado. Informe mlAccessToken OU (mlClientId, mlClientSecret, mlRefreshToken) nas App Settings, ou use ML_ACCESS_TOKEN nas env vars.'
  );
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

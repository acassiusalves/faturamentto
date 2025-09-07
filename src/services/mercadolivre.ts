

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
export async function generateNewAccessToken(): Promise<string> {
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

async function getValidAccessToken(): Promise<string> {
  if (inMemoryAccessToken && inMemoryAccessToken.expiresAt > Date.now()) {
    return inMemoryAccessToken.token;
  }
  return await generateNewAccessToken();
}


async function getUser(sellerId: string, token: string) {
  const r = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`users HTTP ${r.status}`);
  return r.json();
}

export async function getSellersReputation(sellerIds: string[], token: string) {
  // dedup
  const ids = [...new Set(sellerIds)].filter(Boolean);

  const CONCURRENCY = 8;
  let i = 0;
  const out: Record<string, any> = {};

  async function worker() {
    while (i < ids.length) {
      const idx = i++;
      const id = ids[idx];
      try {
        const u = await getUser(id, token);
        const rep = u?.seller_reputation || {};

        out[id] = {
          nickname: u?.nickname,
          registration_date: u?.registration_date,
          level_id: rep?.level_id,
          power_seller_status: rep?.power_seller_status,
          ratings: rep?.transactions?.ratings,
          completed_total: rep?.transactions?.completed,
          canceled_total: rep?.transactions?.canceled,
          metrics: {
            claims_rate: rep?.metrics?.claims?.rate ?? 0,
            cancellations_rate: rep?.metrics?.cancellations?.rate ?? 0,
            delayed_rate: rep?.metrics?.delayed_handling_time?.rate ?? 0,
            sales_completed_period: rep?.metrics?.sales?.completed ?? 0,
          },
        };
      } catch (e) {
        out[id] = { error: String(e) };
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

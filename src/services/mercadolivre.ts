
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
 * Esta é a versão para servidor da sua função de planilha.
 */
export async function generateNewAccessToken(creds: MercadoLivreCredentials): Promise<string> {
  if (!creds.refreshToken || !creds.appId || !creds.clientSecret || !creds.redirectUri) {
    throw new Error("Credenciais do Mercado Livre (App ID, Secret Key, Refresh Token, Redirect URI) não estão configuradas.");
  }
  
  const url = "https://api.mercadolibre.com/oauth/token";

  // O corpo da requisição precisa ser URL-encoded, não JSON
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
    return result.access_token; // ✅ retorno correto

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
 * Busca produtos no Mercado Livre usando a API oficial.
 * @param query O termo de busca para os produtos.
 * @returns Uma lista de produtos encontrados.
 */
export async function searchMercadoLivreProducts(query: string): Promise<any> {
    const accessToken = await getValidAccessToken();
    const site = "MLB"; // Site Brasil
    const searchUrl = `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(query)}`;

    const options = {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
    };

    try {
        const response = await fetch(searchUrl, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Erro na API do Mercado Livre: ${data.message || 'Falha na busca'}`);
        }
        
        // Retornando apenas os resultados da busca por enquanto
        return data.results || [];

    } catch (error) {
        console.error("Erro ao buscar produtos no Mercado Livre:", error);
        throw error;
    }
}

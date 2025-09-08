
'use server';

import {processListPipeline} from '@/ai/flows/process-list-flow';
import type {PipelineResult} from '@/lib/types';
import {organizeList, type OrganizeListInput} from '@/ai/flows/organize-list';
import {standardizeList, type StandardizeListInput} from '@/ai/flows/standardize-list';
import {lookupProducts} from '@/ai/flows/lookup-products';
import { saveAppSettings, loadAppSettings } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import { analyzeFeed } from '@/ai/flows/analyze-feed-flow';
import { fetchOrderLabel } from '@/services/ideris';
import { analyzeLabel } from '@/ai/flows/analyze-label-flow';
import { analyzeZpl } from '@/ai/flows/analyze-zpl-flow';
import { remixLabelData } from '@/ai/flows/remix-label-data-flow';
import { remixZplData } from '@/ai/flows/remix-zpl-data-flow';
import type { RemixZplDataInput, RemixZplDataOutput, AnalyzeLabelOutput, RemixableField, RemixLabelDataInput, OrganizeResult, StandardizeListOutput, LookupResult, LookupProductsInput, AnalyzeCatalogInput, AnalyzeCatalogOutput, RefineSearchTermInput, RefineSearchTermOutput } from '@/lib/types';
import { regenerateZpl, type RegenerateZplInput, type RegenerateZplOutput } from '@/ai/flows/regenerate-zpl-flow';
import { analyzeCatalog } from '@/ai/flows/analyze-catalog-flow';
import { generateNewAccessToken as getMlToken, getSellersReputation } from '@/services/mercadolivre';
import { getCatalogOfferCount } from '@/lib/ml';
import { debugMapping, correctExtractedData } from '@/services/zpl-corrector';
import { refineSearchTerm } from '@/ai/flows/refine-search-term-flow';



// === SISTEMA DE MAPEAMENTO PRECISO ZPL ===
// Substitui todo o sistema anterior por uma abordagem mais determinística

interface ZplTextElement {
  content: string;           // texto decodificado
  rawContent: string;        // texto original no ZPL  
  x: number;                 // coordenada X
  y: number;                 // coordenada Y
  startLine: number;         // linha onde começa o bloco
  endLine: number;           // linha onde termina o bloco
  fdLineIndex: number;       // linha específica do ^FD
  hasEncoding: boolean;      // se tem ^FH
  isBarcode: boolean;        // se é código de barra
  isQrCode: boolean;         // se é QR code
}

interface ZplMapping {
  allTextElements: ZplTextElement[];
  mappedFields: {
    [K in keyof AnalyzeLabelOutput]?: {
        content: string;
        line: number;
        confidence: number;
    }
  }
}

async function fetchItemOfficialStoreId(itemId: string, token: string): Promise<number | null> {
  if (!itemId) return null;
  const url = `https://api.mercadolibre.com/items/${itemId}?fields=official_store_id`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return (typeof j?.official_store_id === "number") ? j.official_store_id : null;
}

// Pega visitas de uma lista de item IDs (MLB123, MLB456, ...)
// O endpoint aceita query string com vários ids (lotes). 
// Aceita também filtros por data; abaixo uso últimos 30 dias.
async function fetchItemsVisits(
  itemIds: string[],
  accessToken?: string,         // usamos se precisar
  days: number = 30
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};

  // limite de lote conservador (a API costuma aceitar ~50 por chamada)
  const CHUNK = 50;
  const out: Record<string, number> = {};
  const dateTo   = new Date();
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // formata yyyy-mm-dd (a API aceita ISO sem hora)
  const toDateStr   = dateTo.toISOString().slice(0,10);
  const fromDateStr = dateFrom.toISOString().slice(0,10);

  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const batch = itemIds.slice(i, i + CHUNK);
    const url = new URL("https://api.mercadolibre.com/items/visits");
    url.searchParams.set("ids", batch.join(","));
    // Use filtro de período (opcional). Se quiser “lifetime”, remova:
    url.searchParams.set("date_from", fromDateStr);
    url.searchParams.set("date_to", toDateStr);

    // 1ª tentativa sem token (geralmente funciona). Se 401/403, tenta com token.
    let r = await fetch(url.toString(), { cache: "no-store" });
    if (r.status === 401 || r.status === 403) {
      r = await fetch(url.toString(), {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        cache: "no-store",
      });
    }
    if (!r.ok) {
      // não quebra a página — só segue sem visitas para esse lote
      continue;
    }
    const data = await r.json();
    // Normalização: respostas comuns são array de objetos { id, total_visits } ou { item_id, visits }
    for (const row of (Array.isArray(data) ? data : [])) {
      const id = row.id ?? row.item_id ?? row.itemId ?? row.code ?? null;
      const visits =
        row.total_visits ?? row.visits ?? row.total ?? 0;
      if (id) out[id] = Number.isFinite(visits) ? Number(visits) : 0;
    }
  }
  return out;
}

// Busca seller_address em LOTE para vários items (mais estável/rápido que 1-a-1)
async function fetchItemsSellerAddresses(
  itemIds: string[],
  token: string
): Promise<Record<string, { state_id: string|null; state_name: string|null; city_id: string|null; city_name: string|null }>> {
  const out: Record<string, { state_id: string|null; state_name: string|null; city_id: string|null; city_name: string|null }> = {};
  if (!itemIds.length) return out;

  const CHUNK = 20; // seguro para /items?ids=
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const batch = itemIds.slice(i, i + CHUNK);
    const url = `https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,seller_address`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) continue;
    const rows = await r.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const body = row?.body;
      if (!body?.id) continue;
      const s = body?.seller_address || {};
      out[body.id] = {
        state_id: s?.state?.id ?? null,
        state_name: s?.state?.name ?? null,
        city_id: s?.city?.id ?? null,
        city_name: s?.city?.name ?? null,
      };
    }
  }
  return out;
}



// Server Actions
export async function searchMercadoLivreAction(
  _prevState: any,
  formData: FormData
) {
  try {
    const productName = String(formData.get("productName") || "").trim();
    const quantity = Number(formData.get("quantity") || 50);
    const accessToken = await getMlToken();
    
    // 1. Search for catalog products
    const searchUrl = new URL("https://api.mercadolibre.com/products/search");
    searchUrl.searchParams.set("q", productName);
    searchUrl.searchParams.set("status", "active");
    searchUrl.searchParams.set("site_id", "MLB");
    searchUrl.searchParams.set("limit", String(quantity));

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const msg = await res.text();
      return { result: null, error: `Erro na busca de catálogo: ${msg}` };
    }
    const data = await res.json();
    const catalogProducts = data?.results || [];

    if (catalogProducts.length === 0) {
      return { result: [], error: null };
    }

    // 2. Fetch winner item for each catalog product
    const CONCURRENCY = 8;
    const winnerByCat = new Map<string, any>();
    for (let i = 0; i < catalogProducts.length; i += CONCURRENCY) {
      const batch = catalogProducts.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (p: any) => {
          const url = `https://api.mercadolibre.com/products/${p.id}/items?limit=1`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
          if (r.ok) {
            const j = await r.json();
            const winner = j?.results?.[0];
            if (winner) winnerByCat.set(p.id, winner);
          }
        })
      );
    }
    
    const winnerItemIds = Array.from(winnerByCat.values())
      .map(w => w?.id)
      .filter(Boolean) as string[];

    // ENDEREÇOS em lote (estado/cidade) para cada winner item
    const sellerAddrByItemId = await fetchItemsSellerAddresses(winnerItemIds, accessToken);

    const visitsByItem = await fetchItemsVisits(winnerItemIds, accessToken, 30);

    // 3. Fetch seller reputations
    const sellerIds = Array.from(new Set(Array.from(winnerByCat.values()).map(w => w?.seller_id).filter(Boolean)));
    const reputations = await getSellersReputation(sellerIds, accessToken);

    // 4. Enrich results with offer count, winner info, and reputation
    const enrichedResults = await Promise.all(
        catalogProducts.map(async (p: any) => {
            const winner = winnerByCat.get(p.id);
            const visits_30d = winner?.id ? (visitsByItem[winner.id] ?? 0) : 0;

            // official store (como já estava)
            let officialStoreId: number | null =
              (typeof winner?.official_store_id === "number") ? winner.official_store_id : null;
            if (!officialStoreId && winner?.id) {
              officialStoreId = await fetchItemOfficialStoreId(winner.id, accessToken);
            }

            // 🔹 ENDEREÇO via batch map
            const sellerAddress =
              (winner?.id && sellerAddrByItemId[winner.id]) ||
              { state_id: null, state_name: null, city_id: null, city_name: null };

            const reputationData = winner?.seller_id ? reputations[winner.seller_id] : null;
            const counted = await getCatalogOfferCount(p.id, accessToken);
            const offerCount = counted > 0 ? counted : (winner ? 1 : 0);

            return {
                id: p.id,
                catalog_product_id: p.id,
                name: (p.name || "").trim(),
                thumbnail: p.pictures?.[0]?.secure_url || p.pictures?.[0]?.url || "",
                brand: p.attributes?.find((a: any) => a.id === "BRAND")?.value_name || "",
                model: p.attributes?.find((a: any) => a.id === "MODEL")?.value_name || "",
                price: winner?.price ?? 0,
                shipping_type: winner?.shipping?.logistic_type || "",
                shipping_logistic_type: winner?.shipping?.logistic_type || "",
                free_shipping: !!winner?.shipping?.free_shipping,
                listing_type_id: winner?.listing_type_id || "",
                category_id: winner?.category_id || p.category_id || "",
                seller_nickname: reputationData?.nickname || "N/A",

                official_store_id: officialStoreId,
                is_official_store: Boolean(officialStoreId),

                // 🔹 NOVOS CAMPOS
                seller_state: sellerAddress.state_name,
                seller_state_id: sellerAddress.state_id,
                seller_city: sellerAddress.city_name,
                seller_city_id: sellerAddress.city_id,

                offerCount,
                visits_30d,

                reputation: reputationData && {
                  level_id: reputationData.level_id ?? null,
                  power_seller_status: reputationData.power_seller_status ?? null,
                  metrics: {
                    claims_rate: reputationData.metrics?.claims_rate ?? 0,
                    cancellations_rate: reputationData.metrics?.cancellations_rate ?? 0,
                    delayed_rate: reputationData.metrics?.delayed_rate ?? 0,
                  }
                }
            };
        })
    );
    
    return { result: enrichedResults, error: null };

  } catch (e: any) {
    return { result: null, error: e?.message || "Falha inesperada" };
  }
}

export async function organizeListAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: OrganizeResult | null; error: string | null }> {
  try {
    const productList = formData.get('productList') as string;
    const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!productList) throw new Error("A lista de produtos não pode estar vazia.");
    const result = await organizeList({ productList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao organizar a lista." };
  }
}

export async function standardizeListAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: StandardizeListOutput | null; error: string | null }> {
  try {
    const organizedList = formData.get('organizedList') as string;
     const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!organizedList) throw new Error("A lista organizada não pode estar vazia.");
    const result = await standardizeList({ organizedList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao padronizar a lista." };
  }
}

export async function lookupProductsAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: LookupResult | null; error: string | null }> {
  try {
    const productList = formData.get('productList') as string;
    const databaseList = formData.get('databaseList') as string;
     const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!productList) throw new Error("A lista de produtos não pode estar vazia.");
    if (!databaseList) throw new Error("A base de dados de produtos não pode estar vazia.");
    const result = await lookupProducts({ productList, databaseList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao buscar produtos no banco de dados." };
  }
}

export async function fetchLabelAction(_prevState: any, formData: FormData): Promise<{ labelUrl: string | null, zplContent: string | null, error: string | null, rawError: string | null }> {
    const orderId = formData.get('orderId') as string;
    const format = formData.get('format') as 'PDF' | 'ZPL';
    
    try {
        const settings = await loadAppSettings();
        if (!settings?.iderisPrivateKey) {
          throw new Error("A chave da API da Ideris não está configurada.");
        }
        
        const response = await fetchOrderLabel(settings.iderisPrivateKey, orderId, format);
        
        if (response.error) {
            return { labelUrl: null, zplContent: null, error: response.error, rawError: response.rawError || null };
        }
        
        if (format === 'PDF') {
            const url = response.data?.obj?.[0]?.url;
            return { labelUrl: url || null, zplContent: null, error: url ? null : 'URL do PDF não encontrada na resposta.', rawError: null };
        } else { // ZPL
            const zplText = response.data?.obj?.[0]?.text;
            return { labelUrl: null, zplContent: zplText || null, error: zplText ? null : 'Conteúdo ZPL não encontrado na resposta.', rawError: null };
        }

    } catch (e: any) {
        return { labelUrl: null, zplContent: null, error: e.message || "Ocorreu um erro desconhecido.", rawError: null };
    }
}


export async function analyzeLabelAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const photoDataUri = formData.get('photoDataUri') as string;
    if (!photoDataUri) {
        return { analysis: null, error: "Nenhuma imagem foi enviada para análise." };
    }
    
    try {
        const result = await analyzeLabel({ photoDataUri });
        return { analysis: result, error: null };
    } catch (e: any) {
         return { analysis: null, error: e.message || "Ocorreu um erro desconhecido durante a análise." };
    }
}

export async function analyzeZplAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const zplContent = formData.get('zplContent') as string;
    if (!zplContent) {
        return { analysis: null, error: "Nenhum conteúdo ZPL foi enviado para análise." };
    }
    
    try {
        const result = await analyzeZpl({ zplContent });
        return { analysis: result, error: null };
    } catch (e: any) {
         return { analysis: null, error: e.message || "Ocorreu um erro desconhecido durante a análise ZPL." };
    }
}

export async function remixLabelDataAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
  const originalDataStr = formData.get('originalData') as string;
  const fieldToRemix = formData.get('fieldToRemix') as RemixableField;

  if (!originalDataStr || !fieldToRemix) {
    return { analysis: null, error: "Dados inválidos para remix." };
  }

  try {
    const originalData: AnalyzeLabelOutput = JSON.parse(originalDataStr);
    const originalValue = originalData[fieldToRemix];
    
    const settings = await loadAppSettings();

    const result = await remixLabelData({
      fieldToRemix,
      originalValue,
      apiKey: settings?.geminiApiKey,
    });

    const updatedData = { ...originalData, [fieldToRemix]: result.newValue };

    return { analysis: updatedData, error: null };
  } catch (e: any) {
    return { analysis: null, error: e.message || "Falha ao gerar novos dados." };
  }
}

export async function remixZplDataAction(_prevState: any, formData: FormData): Promise<{ result: RemixZplDataOutput | null; error: string | null; }> {
    try {
        const input: RemixZplDataInput = JSON.parse(formData.get('zplRemixInput') as string);
        if (!input) {
            throw new Error('Input ZPL para remix inválido.');
        }
        const result = await remixZplData(input);
        return { result, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || "Falha ao modificar ZPL." };
    }
}

export async function regenerateZplAction(_prevState: any, formData: FormData): Promise<{ result: RegenerateZplOutput | null; error: string | null }> {
    const originalZpl = formData.get('originalZpl') as string;
    const editedDataStr = formData.get('editedData') as string;
    
    try {
        if (!originalZpl || !editedDataStr) {
            throw new Error('Dados insuficientes para regenerar a etiqueta.');
        }
        const editedData = JSON.parse(editedDataStr);
        const input: RegenerateZplInput = { originalZpl, editedData };
        const result = await regenerateZpl(input);
        return { result, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || 'Falha na regeneração da etiqueta ZPL.' };
    }
}


export async function correctExtractedDataAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
  try {
    const originalZpl = formData.get('originalZpl') as string;
    const extractedDataStr = formData.get('extractedData') as string;
    if (!originalZpl || !extractedDataStr) {
      throw new Error('Dados de entrada ausentes para correção.');
    }
    const extractedData: AnalyzeLabelOutput = JSON.parse(extractedDataStr);
    const correctedData = await correctExtractedData(originalZpl, extractedData);
    return { analysis: correctedData, error: null };
  } catch (e: any) {
    return { analysis: null, error: e.message };
  }
}


export async function debugMappingAction(_prevState: any, formData: FormData) {
    const originalZpl = formData.get('originalZpl') as string;
    const extractedDataStr = formData.get('extractedData') as string;
     try {
        if (!originalZpl || !extractedDataStr) {
            throw new Error('Dados de entrada ausentes para debug.');
        }
        const extractedData = JSON.parse(extractedDataStr);
        const debugInfo = await debugMapping(originalZpl, extractedData);
        return { result: debugInfo, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || "Falha no processo de debug." };
    }
}

export async function analyzeCatalogAction(_prevState: any, formData: FormData): Promise<{ result: AnalyzeCatalogOutput | null; error: string | null }> {
  try {
    const pdfContent = formData.get('pdfContent') as string;
    const pageNumber = Number(formData.get('pageNumber'));
    const totalPages = Number(formData.get('totalPages'));
    const brand = formData.get('brand') as string | undefined;

    if (!pdfContent) throw new Error("O conteúdo do PDF não pode estar vazio.");
    if (isNaN(pageNumber) || isNaN(totalPages)) throw new Error("Número de página inválido.");

    const result = await analyzeCatalog({ pdfContent, pageNumber, totalPages, brand });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao analisar o catálogo." };
  }
}

export async function savePromptAction(_prevState: any, formData: FormData) {
  try {
    const promptKey = formData.get('promptKey') as string;
    const promptValue = formData.get('promptValue') as string;
    if (!promptKey || !promptValue) {
      throw new Error("Chave ou valor do prompt inválido.");
    }
    await saveAppSettings({ [promptKey]: promptValue });
    revalidatePath('/feed-25');
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function refineSearchTermAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: RefineSearchTermOutput | null; error: string | null }> {
  try {
    const productName = formData.get('productName') as string;
    const productModel = formData.get('productModel') as string | undefined;
    const productBrand = formData.get('productBrand') as string | undefined;

    if (!productName) {
      throw new Error('O nome do produto é obrigatório para refinar a busca.');
    }

    const input: RefineSearchTermInput = { productName, productModel, productBrand };
    const result = await refineSearchTerm(input);
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || 'Falha ao refinar o termo de busca.' };
  }
}

async function analyzeFeedAction(prevState: { result: any; error: string | null; }, formData: FormData): Promise<{ result: any; error: string | null; }> {
    try {
        const feedData = JSON.parse(formData.get('feedData') as string);
        const apiKey = formData.get('apiKey') as string | undefined;
        const modelName = formData.get('modelName') as string | undefined;

        if (!feedData || feedData.length === 0) {
            return { result: null, error: 'Nenhum dado de feed para analisar.' };
        }
        
        const result = await analyzeFeed({ products: feedData, apiKey, modelName });
        return { result, error: null };

    } catch (e: any) {
        return { result: null, error: e.message || "Falha ao analisar o feed com a IA." };
    }
}
    

    


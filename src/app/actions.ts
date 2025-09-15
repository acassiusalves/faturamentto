


'use server';

import type { PipelineResult } from '@/lib/types';
import { saveAppSettings, loadAppSettings, updateProductAveragePrices } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import type { RemixZplDataInput, RemixZplDataOutput, AnalyzeLabelOutput, RemixableField, RemixLabelDataInput, OrganizeResult, StandardizeListOutput, LookupResult, LookupProductsInput, AnalyzeCatalogInput, AnalyzeCatalogOutput, RefineSearchTermInput, RefineSearchTermOutput } from '@/lib/types';
import { getSellersReputation, getMlToken } from '@/services/mercadolivre';
import { getCatalogOfferCount } from '@/lib/ml';
import { debugMapping, correctExtractedData } from '@/services/zpl-corrector';
import { deterministicLookup } from "@/lib/matching";



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
  return (typeof j?.official_store_id === "number") ? j?.official_store_id : null;
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

// Fallback: pega endereço do vendedor via /users/{seller_id}
// Aceita tanto "name" quanto o código bruto (ex.: "BR-SP")
async function fetchUsersAddress(
  sellerIds: number[],
  token: string
): Promise<Record<number, {
  state_id: string | null;
  state_name: string | null;
  city_id: string | null;
  city_name: string | null;
}>> {
  const out: Record<number, {
    state_id: string | null;
    state_name: string | null;
    city_id: string | null;
    city_name: string | null;
  }> = {};

  const uniq = Array.from(new Set(sellerIds)).filter(Boolean);
  if (!uniq.length) return out;

  const CONCURRENCY = 8;
  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    const batch = uniq.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (sid) => {
        const r = await fetch(`https://api.mercadolibre.com/users/${sid}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        const a = j?.address ?? {};

        // pode vir { state: "BR-SP", city: "São Paulo" } ou objects com { id, name }
        const stateRaw = a?.state;
        const cityRaw  = a?.city;

        const stateName =
          (typeof stateRaw === "object" ? stateRaw?.name : stateRaw) ?? null;
        const stateId =
          (typeof stateRaw === "object" ? stateRaw?.id   : null) ?? null;

        const cityName  =
          (typeof cityRaw  === "object" ? cityRaw?.name  : cityRaw) ?? null;
        const cityId    =
          (typeof cityRaw  === "object" ? cityRaw?.id    : null) ?? null;

        out[sid] = {
          state_id: stateId,
          state_name: stateName, // pode ser "BR-SP" se não houver name
          city_id: cityId,
          city_name: cityName,
        };
      })
    );
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

    const sellerAddrByItemId = await fetchItemsSellerAddresses(winnerItemIds, accessToken);

    const sellerIdsNeedingFallback = Array.from(winnerByCat.values())
      .filter(w => w?.id && !sellerAddrByItemId[w.id])
      .map(w => w.seller_id)
      .filter(Boolean) as number[];

    const userAddrBySellerId = await fetchUsersAddress(sellerIdsNeedingFallback, accessToken);

    // 3. Fetch seller reputations
    const sellerIds = Array.from(new Set(Array.from(winnerByCat.values()).map(w => w?.seller_id).filter(Boolean)));
    const reputations = await getSellersReputation(sellerIds, accessToken);

    // 4. Enrich results with offer count, winner info, and reputation
    const enrichedResults = await Promise.all(
        catalogProducts.map(async (p: any) => {
            const winner = winnerByCat.get(p.id);

            // official store (como já estava)
            let officialStoreId: number | null =
              (typeof winner?.official_store_id === "number") ? winner.official_store_id : null;
            if (!officialStoreId && winner?.id) {
              officialStoreId = await fetchItemOfficialStoreId(winner.id, accessToken);
            }

            const sellerAddress =
              (winner?.id && sellerAddrByItemId[winner.id]) ||
              (winner?.seller_id && userAddrBySellerId[winner.seller_id]) ||
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
    const modelName = formData.get('modelName') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!productList) throw new Error("A lista de produtos não pode estar vazia.");
    const { organizeList } = await import('@/ai/flows/organize-list');
    const result = await organizeList({ productList, apiKey, modelName, prompt_override });
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
    const modelName = formData.get('modelName') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!organizedList) throw new Error("A lista organizada não pode estar vazia.");
    const { standardizeList } = await import('@/ai/flows/standardize-list');
    const result = await standardizeList({ organizedList, apiKey, modelName, prompt_override });
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
    const productList = String(formData.get("productList") || "");
    const databaseList = String(formData.get("databaseList") || "");
    const lines = productList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    const { details, withCode, noCode } = deterministicLookup(lines, databaseList);

    return { result: { details, withCode, noCode } as any, error: null };
  } catch (e:any) {
    return { result: null, error: e?.message || "Falha no lookup" };
  }
}

export async function fetchLabelAction(
    _prevState: any,
    formData: FormData
): Promise<{ zplContent: string | null; error: string | null; rawError?: string | null }> {
    const orderId = formData.get('orderId') as string;
    
    if (!orderId) {
        return { zplContent: null, error: 'ID do pedido não fornecido.' };
    }

    try {
        const { fetchOrderLabel } = await import('@/services/ideris');
        const settings = await loadAppSettings();
        if (!settings?.iderisPrivateKey) {
            throw new Error("A chave da API da Ideris não está configurada.");
        }
        
        // Força o formato ZPL
        const response = await fetchOrderLabel(settings.iderisPrivateKey, orderId, 'ZPL');
        
        if (response.error) {
            return { zplContent: null, error: response.error, rawError: response.rawError };
        }
        
        const zplText = response.data?.obj?.[0]?.text;
        return { zplContent: zplText || null, error: zplText ? null : 'Conteúdo ZPL não encontrado na resposta.' };

    } catch (e: any) {
        return { zplContent: null, error: e.message || "Ocorreu um erro desconhecido ao buscar a etiqueta." };
    }
}


export async function analyzeLabelAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const photoDataUri = formData.get('photoDataUri') as string;
    if (!photoDataUri) {
        return { analysis: null, error: "Nenhuma imagem foi enviada para análise." };
    }
    
    try {
        const { analyzeLabel } = await import('@/ai/flows/analyze-label-flow');
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
        const { analyzeZpl } = await import('@/ai/flows/analyze-zpl-flow');
        const result = await analyzeZpl({ zplContent });
        return { analysis: result, error: null };
    } catch (e: any) {
         return { analysis: null, error: e.message || "Ocorreu um erro desconhecido durante a análise ZPL." };
    }
}

export async function remixLabelDataAction(_prevState: any, formData: FormData): Promise<{ analysis: Partial<AnalyzeLabelOutput> | null; error: string | null; }> {
  try {
      const input: RemixLabelDataInput = JSON.parse(formData.get('remixInput') as string);
      if (!input) {
          throw new Error('Input para remix inválido.');
      }
      const { remixLabelData } = await import('@/ai/flows/remix-label-data-flow');
      const { newValue } = await remixLabelData(input);
      return { analysis: { [input.fieldToRemix]: newValue }, error: null };

  } catch (e: any) {
      return { analysis: null, error: e.message || "Falha ao remixar dados." };
  }
}


export async function remixZplDataAction(_prevState: any, formData: FormData): Promise<{ result: RemixZplDataOutput | null; error: string | null; }> {
    try {
        const input: RemixZplDataInput = JSON.parse(formData.get('zplRemixInput') as string);
        if (!input) {
            throw new Error('Input ZPL para remix inválido.');
        }
        const { remixZplData } = await import('@/ai/flows/remix-zpl-data-flow');
        const result = await remixZplData(input);
        return { result, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || "Falha ao modificar ZPL." };
    }
}

export async function regenerateZplAction(_prevState: any, formData: FormData): Promise<{ result: any | null; error: string | null }> {
    const originalZpl = formData.get('originalZpl') as string;
    const editedDataStr = formData.get('editedData') as string;
    
    try {
        if (!originalZpl || !editedDataStr) {
            throw new Error('Dados insuficientes para regenerar a etiqueta.');
        }
        const editedData = JSON.parse(editedDataStr);
        const { regenerateZpl } = await import('@/ai/flows/regenerate-zpl-flow');
        const result = await regenerateZpl({ originalZpl, editedData });
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
    
    const { analyzeCatalog } = await import('@/ai/flows/analyze-catalog-flow');
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
    
    const { refineSearchTerm } = await import('@/ai/flows/refine-search-term-flow');
    const input: RefineSearchTermInput = { productName, productModel, productBrand };
    const result = await refineSearchTerm(input);
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || 'Falha ao refinar o termo de busca.' };
  }
}

export async function analyzeFeedAction(prevState: { result: any; error: string | null; }, formData: FormData): Promise<{ result: any; error: string | null; }> {
    try {
        const feedData = JSON.parse(formData.get('feedData') as string);
        const apiKey = formData.get('apiKey') as string | undefined;
        const modelName = formData.get('modelName') as string | undefined;

        if (!feedData || feedData.length === 0) {
            return { result: null, error: 'Nenhum dado de feed para analisar.' };
        }
        
        const { analyzeFeed } = await import('@/ai/flows/analyze-feed-flow');
        const result = await analyzeFeed({ products: feedData, apiKey, modelName });
        return { result, error: null };

    } catch (e: any) {
        return { result: null, error: e.message || "Falha ao analisar o feed com a IA." };
    }
}

export async function findTrendingProductsAction(
  _prevState: any,
  formData: FormData
): Promise<{ trendingProducts: any[] | null; error: string | null }> {
  try {
    const productNames = JSON.parse(formData.get('productNames') as string);
    if (!Array.isArray(productNames) || productNames.length === 0) {
      return { trendingProducts: [], error: 'Nenhum nome de produto fornecido.' };
    }
    const { findTrendingProducts } = await import('@/ai/flows/find-trending-products-flow');
    const result = await findTrendingProducts(productNames);
    return { trendingProducts: result.trendingProducts, error: null };
  } catch (e: any) {
    console.error("Error in findTrendingProductsAction:", e);
    return { trendingProducts: null, error: e.message || "Falha ao verificar tendências." };
  }
}

export async function saveAveragePricesAction(
  _prevState: any,
  formData: FormData
): Promise<{ success: boolean; error: string | null; count: number }> {
    try {
        const dataToSaveStr = formData.get('averagePrices') as string;
        if (!dataToSaveStr) {
            throw new Error("Nenhum dado de preço médio para salvar.");
        }
        
        const dataToSave: { sku: string; averagePrice: number }[] = JSON.parse(dataToSaveStr);
        if (!Array.isArray(dataToSave) || dataToSave.length === 0) {
            return { success: true, error: null, count: 0 };
        }
        
        await updateProductAveragePrices(dataToSave);
        
        return { success: true, error: null, count: dataToSave.length };
    } catch (e: any) {
        return { success: false, error: e.message || "Falha ao salvar preços médios.", count: 0 };
    }
}

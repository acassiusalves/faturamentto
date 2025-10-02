

'use server';

import type { PipelineResult } from '@/lib/types';
import { saveAppSettings, loadAppSettings, updateProductAveragePrices, savePrintedLabel, getSaleByOrderId, updateSalesDeliveryType, loadAllTrendKeywords, loadMlAccounts, updateMlAccount, loadMyItems, saveProduct, saveProducts, saveMagaluCredentials, getMlCredentialsById, loadAllFeedEntries, loadCompanyCosts, loadAllFeedEntriesWithGordura, fetchAllProductsFromFeed as fetchAllProductsFromFeedService } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import type { RemixLabelDataInput, RemixLabelDataOutput, AnalyzeLabelOutput, RemixableField, OrganizeResult, StandardizeListOutput, LookupResult, LookupProductsInput, AnalyzeCatalogInput, AnalyzeCatalogOutput, RefineSearchTermInput, RefineSearchTermOutput, Product, FullFlowResult, CreateListingPayload, MlAccount, MagaluCredentials, CreateListingResult, PostedOnAccount, FeedEntry, SavedPdfAnalysis, ProductResult } from '@/lib/types';
import { getSellersReputation, getMlToken, createListingFromCatalog, generateNewAccessToken, fetchAllMyItems } from '@/services/mercadolivre';
import { getCatalogOfferCount } from '@/lib/ml';
import { deterministicLookup } from "@/lib/matching";
import { parseZplFields, updateFieldAt } from '@/lib/zpl';
import { runStep, type StepId } from "@/server/ai";
import { extractJson } from '@/lib/json';


async function fetchItemOfficialStoreId(itemId: string, token: string): Promise<number | null> {
  if (!itemId) return null;
  const url = `https://api.mercadolibre.com/items/${itemId}?fields=official_store_id`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return (typeof j?.official_store_id === "number") ? j.official_store_id : null;
}

// Busca seller_address em LOTE para vários items (mais estável/rápido que 1-a-1)
async function fetchItemsSellerAddresses(
  itemIds: string[],
  token: string
): Promise<Record<string, {
  state_id: string|null; state_name: string|null;
  city_id: string|null;  city_name: string|null;
  last_updated: string|null;
}>> {
  const out: Record<string, {
    state_id: string|null; state_name: string|null;
    city_id: string|null;  city_name: string|null;
    last_updated: string|null;
  }> = {};
  if (!itemIds.length) return out;

  const CHUNK = 20; // seguro para /items?ids=
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const batch = itemIds.slice(i, i + CHUNK);
    const url = `https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,seller_address,last_updated`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) continue;
    const rows = await r.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const body = row?.body || {};
      const s = body?.seller_address || {};
      const sid = String(body?.id || "").trim();
      if (!sid) continue;

      out[sid] = {
        state_id: s?.state?.id ?? null,
        state_name: s?.state?.name ?? null,
        city_id: s?.city?.id ?? null,
        city_name: s?.city?.name ?? null,
        last_updated: body?.last_updated ?? null,
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

type MoneyLike = string | number | null | undefined;

async function fetchListingFees(opts: {
  site?: string;
  price: number;
  categoryId?: string;
  listingTypeId?: string;
}): Promise<{
  calculated: {
    listing_fee_amount: number;
    sale_fee_amount: number;
    sale_fee_percent: number;
    fee_total?: number;
  };
  raw: any;
} | null> {
  const site = opts.site ?? "MLB";
  const url = new URL(`https://api.mercadolibre.com/sites/${site}/listing_prices`);
  url.searchParams.set("price", String(opts.price));
  if (opts.categoryId)    url.searchParams.set("category_id", opts.categoryId);
  if (opts.listingTypeId) url.searchParams.set("listing_type_id", opts.listingTypeId);

  let r = await fetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
  if (r.status === 401 || r.status === 403) {
    const token = await getMlToken();
    r = await fetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  }
  if (!r.ok) return null;

  const data = await r.json();
  // escolha correta do registro quando vier array
  const row = Array.isArray(data)
    ? (opts.listingTypeId ? data.find((d:any) => d?.listing_type_id === opts.listingTypeId) ?? data[0] : data[0])
    : data;
  if (!row) return null;

  const sale = Number(row?.sale_fee_amount ?? 0);
  const list = Number(row?.listing_fee_amount ?? 0);
  const price = Number(opts.price || 0);

  return {
    calculated: {
      listing_fee_amount: isFinite(list) ? list : 0,
      sale_fee_amount: isFinite(sale) ? sale : 0,
      sale_fee_percent: price > 0 && row.percentage_fee ? row.percentage_fee / 100 : (price > 0 ? sale / price : 0),
      fee_total: (isFinite(list) ? list : 0) + (isFinite(sale) ? sale : 0),
    },
    raw: data,
  };
}

async function fetchProductReviews(
  itemId: string,
  catalogProductId: string,
  token: string
): Promise<{ data: any | null; rating_average: number; reviews_count: number }> {
    if (!itemId || !catalogProductId) return { data: null, rating_average: 0, reviews_count: 0 };
    const url = `https://api.mercadolibre.com/reviews/item/${itemId}?catalog_product_id=${catalogProductId}`;
    try {
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!r.ok) return { data: null, rating_average: 0, reviews_count: 0 };
        const j = await r.json();
        const count = Object.values(j?.rating_levels || {}).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
        return {
            data: j, // Retorna a resposta completa
            rating_average: j?.rating_average ?? 0,
            reviews_count: count,
        };
    } catch (e) {
        console.warn(`Could not fetch reviews for ${itemId}:`, e);
        return { data: null, rating_average: 0, reviews_count: 0 };
    }
}


async function mapWithConcurrency<T, R>(arr: T[], limit: number, fn: (x: T, i: number) => Promise<R>) {
  const out: R[] = new Array(arr.length) as any;
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  }
  const workers = Array(Math.min(limit, arr.length)).fill(0).map(worker);
  await Promise.all(workers);
  return out;
}

// Fetches active catalog IDs for a given ML account from the local DB
async function fetchAllActiveCatalogProductsFromDB(): Promise<Map<string, PostedOnAccount[]>> {
    const allActiveCatalogs = new Map<string, PostedOnAccount[]>();
    
    // 1. Carrega os anúncios salvos e as contas do ML.
    const myItems = await loadMyItems();
    const mlAccounts = await loadMlAccounts();
    const accountIdToNameMap = new Map(mlAccounts.map(acc => [acc.id, acc.accountName || acc.id]));

    // 2. Filtra APENAS os anúncios com status 'active'
    const activeItems = myItems.filter(item => item.status === 'active');

    // 3. Processa apenas os anúncios ativos
    for (const item of activeItems) {
        if (item.catalog_product_id && item.id_conta_autenticada) {
            const catalogId = item.catalog_product_id;
            const accountId = String(item.id_conta_autenticada);
            const accountName = accountIdToNameMap.get(accountId) || accountId;
            const listingTypeId = item.listing_type_id || '';

            if (!allActiveCatalogs.has(catalogId)) {
                allActiveCatalogs.set(catalogId, []);
            }
            
            const accounts = allActiveCatalogs.get(catalogId)!;
            
            // Corrige a lógica para evitar duplicatas: verifica a combinação de ID da conta e tipo de anúncio
            if (accountId && !accounts.some(a => a.accountId === accountId && a.listingTypeId === listingTypeId)) {
                accounts.push({ accountId, accountName, listingTypeId });
            }
        }
    }
    
    return allActiveCatalogs;
}

// Nova action para ser chamada pelo client
export async function fetchActiveCatalogProductsAction(): Promise<{
  data: Record<string, PostedOnAccount[]>;
  error: string | null;
}> {
  try {
    // 1. Sincronizar todos os anúncios de todas as contas do ML
    const mlAccounts = await loadMlAccounts();
    await fetchAllMyItems(mlAccounts.map(acc => acc.id));

    // 2. Após sincronizar, ler os anúncios ativos do banco de dados
    const map = await fetchAllActiveCatalogProductsFromDB();
    const data = Object.fromEntries(map);

    revalidatePath('/feed-25/analise-produtos-pdf');
    return { data, error: null };
  } catch (e: any) {
    return { data: {}, error: e.message || 'Falha ao buscar anúncios ativos.' };
  }
}


// Server Actions
export async function searchMercadoLivreAction(
  _prevState: any,
  formData: FormData
) {
  try {
    const productName = String(formData.get("productName") || "").trim();
    const quantity = Number(formData.get("quantity") || 50);
    
    // Fetch all active catalogs from our local database
    const allMyActiveCatalogs = await fetchAllActiveCatalogProductsFromDB();
    const accessToken = await getMlToken(); // Use a primary token for general searches
    
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

            // official store
            let officialStoreId: number | null =
              (typeof winner?.official_store_id === "number") ? winner.official_store_id : null;
            if (!officialStoreId && winner?.id) {
              officialStoreId = await fetchItemOfficialStoreId(winner.id, accessToken);
            }
            
            // metas do item e do usuário
            const itemMeta = (winner?.id && sellerAddrByItemId[winner.id]) || null;
            const userMeta = (winner?.seller_id && userAddrBySellerId[winner.seller_id]) || null;
            
            // fallback inline do próprio winner (ex.: "São Paulo")
            const inlineAddr = winner?.seller_address ? {
              state_id:   winner.seller_address?.state?.id ?? null,
              state_name: winner.seller_address?.state?.name ?? null,
              city_id:    winner.seller_address?.city?.id ?? null,
              city_name:  winner.seller_address?.city?.name ?? null,
              last_updated: winner?.last_updated ?? null,
            } : null;

            // ordem: batch /items -> inline winner -> /users -> nulos
            const sellerAddress = itemMeta || inlineAddr || userMeta || {
              state_id: null, state_name: null, city_id: null, city_name: null, last_updated: null
            };
            
            // created_at: prefira do catalogo; depois do winner
            const dateCreated = p.date_created || winner?.date_created || null;
            
            // preço ativo?
            const price = Number(winner?.price ?? 0);
            
            // contagem de ofertas
            const counted = await getCatalogOfferCount(p.id, accessToken);
            const offerCount = counted > 0 ? counted : (winner ? 1 : 0);
            
            // reputação
            const reputationData = winner?.seller_id ? reputations[winner.seller_id] : null;

            // reviews
            const reviewsResult = await fetchProductReviews(winner?.id, p.id, accessToken);

            // Check which account(s) this catalog product is posted on from our local data
            const postedOnAccounts = allMyActiveCatalogs.get(p.id) || [];

            return {
                id: p.id,
                catalog_product_id: p.id,
                item_id: winner?.id ?? null,
                name: (p.name || "").trim(),
                thumbnail: p.pictures?.[0]?.secure_url || p.pictures?.[0]?.url || "",
                brand: p.attributes?.find((a: any) => a.id === "BRAND")?.value_name || "",
                model: p.attributes?.find((a: any) => a.id === "MODEL")?.value_name || "",
                attributes: p.attributes || [],
                price: price,
                shipping_type: winner?.shipping?.logistic_type || "",
                shipping_logistic_type: winner?.shipping?.logistic_type || "",
                free_shipping: !!winner?.shipping?.free_shipping,
                listing_type_id: winner?.listing_type_id || "",
                category_id: winner?.category_id || p.category_id || "",
                seller_nickname: reputationData?.nickname || "N/A",

                official_store_id: officialStoreId,
                is_official_store: Boolean(officialStoreId),

                seller_state: sellerAddress.state_name ?? null,
                seller_state_id: sellerAddress.state_id ?? null,
                seller_city: sellerAddress.city_name ?? null,
                seller_city_id: sellerAddress.city_id ?? null,

                date_created: dateCreated,
                
                offerCount,

                reputation: reputationData && {
                  level_id: reputationData.level_id ?? null,
                  power_seller_status: reputationData.power_seller_status ?? null,
                  metrics: {
                    claims_rate: reputationData.metrics?.claims_rate ?? 0,
                    cancellations_rate: reputationData.metrics?.cancellations_rate ?? 0,
                    delayed_rate: reputationData.metrics?.delayed_rate ?? 0,
                  }
                },
                rating_average: reviewsResult.rating_average ?? 0,
                reviews_count: reviewsResult.reviews_count ?? 0,
                postedOnAccounts: postedOnAccounts, // Add the new field (now an array of objects)
                raw_data: { 
                  catalog_product: p, 
                  winner_item: winner,
                  reviews_data: reviewsResult.data,
                },
            };
        })
    );
    
    const resultsWithFees = await mapWithConcurrency(enrichedResults, 8, async (p) => {
        if (!p?.price || p.price <= 0 || !p?.category_id) return p;
        try {
          const feesResult = await fetchListingFees({
            site: "MLB",
            price: p.price,
            categoryId: p.category_id,
            listingTypeId: p.listing_type_id,
          });

          return { 
            ...p, 
            fees: feesResult?.calculated,
            raw_data: {
              ...p.raw_data,
              fees_data: feesResult?.raw,
            }
          };
        } catch {
          return p;
        }
    });

    return { result: resultsWithFees, error: null };

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
    const { organizeList } = await import('@/ai/flows/organize-list');
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
    const { standardizeList } = await import('@/ai/flows/standardize-list');
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
    
    if (!productList || !databaseList) {
      throw new Error("Lista de produtos ou banco de dados não pode estar vazio.");
    }
    
    const { lookupProducts } = await import('@/ai/flows/lookup-products');
    const result = await lookupProducts({ 
      productList, 
      databaseList, 
      apiKey, 
      prompt_override 
    });
    
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao buscar produtos." };
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
        return { analysis: { [input.fieldToRemix as RemixableField]: newValue }, error: null };

    } catch (e: any) {
        return { analysis: null, error: e.message || 'Falha ao remixar os dados da etiqueta.' };
    }
}

export async function regenerateZplAction(_prevState: any, formData: FormData): Promise<{ zpl: string | null; error: string | null; }> {
    try {
        const input = JSON.parse(formData.get('zplData') as string);
        const { regenerateZpl } = await import('@/ai/flows/regenerate-zpl-flow');
        const result = await regenerateZpl(input);
        return { zpl: result.newZpl, error: null };
    } catch(e: any) {
        return { zpl: null, error: e.message || 'Falha ao gerar o novo ZPL.' };
    }
}


export async function analyzeCatalogAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: AnalyzeCatalogOutput | null; error: string | null; }> {
    try {
      const pdfContent = formData.get('pdfContent') as string;
      const pageNumber = Number(formData.get('pageNumber'));
      const totalPages = Number(formData.get('totalPages'));
      const brand = formData.get('brand') as string;
      const apiKey = formData.get('apiKey') as string | undefined;
      
      if (!pdfContent) throw new Error("Conteúdo do PDF está vazio.");
      
      const { analyzeCatalog } = await import('@/ai/flows/analyze-catalog-flow');
      const result = await analyzeCatalog({ pdfContent, pageNumber, totalPages, brand, apiKey });
      
      // Re-integrando a verificação de tendências
      if (result && result.products.length > 0) {
          const { findTrendingProducts } = await import('@/ai/flows/find-trending-products-flow');
          const productNames = result.products.map(p => p.name);
          const trendingResult = await findTrendingProducts(productNames);
          
          const trendMap = new Map(trendingResult.trendingProducts.map(tp => [tp.productName, tp.matchedKeywords]));
          
          result.products = result.products.map(p => ({
              ...p,
              isTrending: trendMap.has(p.name),
              matchedKeywords: trendMap.get(p.name) || [],
          }));
      }
  
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
    const productNamesPayload = 
        formData.get('productNames') || 
        formData.get('queries') || 
        formData.get('keywords') || 
        formData.get('terms');
        
    if (!productNamesPayload) {
      return { trendingProducts: [], error: 'Nenhum nome de produto fornecido.' };
    }

    const productNames = JSON.parse(productNamesPayload as string);

    if (!Array.isArray(productNames) || productNames.length === 0) {
      return { trendingProducts: [], error: 'Nomes de produtos em formato inválido.' };
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

export async function debugMappingAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: any | null; error: string | null }> {
    const zplContent = formData.get('zplContent') as string;
    if (!zplContent) {
        return { result: null, error: "Nenhum conteúdo ZPL foi enviado para análise." };
    }
    try {
        const { debugMapping } = await import('@/services/zpl-corrector');
        const result = await debugMapping(zplContent);
        return { result: result, error: null };
    } catch (e: any) {
         return { result: null, error: e.message || "Ocorreu um erro desconhecido durante o debug." };
    }
}

export async function markLabelPrintedAction(
  _prevState: any,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> {
  const orderId = String(formData.get("orderId") || "").trim();
  const orderCode = (formData.get('orderCode') as string | null)?.trim() || null;
  const zplContent = formData.get('zplContent') as string | undefined;

  if (!orderId) return { success: false, error: 'orderId ausente.' };

  try {
    // Se vier no form, não faz lookup; caso contrário, tenta obter do Firestore.
    let orderCodeToUse = orderCode;
    if (!orderCodeToUse) {
      const sale = await getSaleByOrderId(orderId);
      orderCodeToUse = (sale as any)?.order_code ?? null;
    }

    await savePrintedLabel(orderId, orderCodeToUse, zplContent); // já grava por ID e por código
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao marcar etiqueta como impressa.' };
  }
}

export async function updateSalesDeliveryTypeAction(
  saleIds: string[]
): Promise<{ updatedCount: number; error: string | null }> {
  if (!saleIds || saleIds.length === 0) {
    return { updatedCount: 0, error: 'Nenhum ID de venda fornecido.' };
  }

  try {
    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey) {
      throw new Error('A chave da API da Ideris não está configurada.');
    }
    
    // Ideris não tem um endpoint para buscar múltiplos pedidos por ID, então pegamos o order_id.
    const { fetchSalesByIds } = await import('@/services/firestore');
    const salesToUpdate = await fetchSalesByIds(saleIds);
    const orderIds = salesToUpdate.map(s => (s as any).order_id);

    if (orderIds.length === 0) {
        return { updatedCount: 0, error: null };
    }

    const { fetchOrdersByIds } = await import('@/services/ideris');
    const iderisOrders = await fetchOrdersByIds(settings.iderisPrivateKey, orderIds);

    const deliveryTypeMap = new Map<string, string>();
    iderisOrders.forEach(order => {
        if(order.id && order.deliveryType) {
            deliveryTypeMap.set(`ideris-${order.id}`, order.deliveryType);
        }
    });

    const updates = saleIds.map(saleId => {
      const deliveryType = deliveryTypeMap.get(saleId);
      return { saleId, deliveryType };
    }).filter(u => u.deliveryType);
    
    if (updates.length > 0) {
        await updateSalesDeliveryType(updates);
    }
    
    return { updatedCount: updates.length, error: null };
  } catch (e) {
    return { updatedCount: 0, error: e instanceof Error ? e.message : 'Erro desconhecido' };
  }
}

const organizePromptText = `Você é um assistente de organização de dados especialista em listas de produtos de fornecedores. Sua tarefa é pegar uma lista de produtos em texto bruto, não estruturado e com múltiplas variações, e organizá-la de forma limpa e individualizada.
Sua única saída deve ser um objeto JSON com a chave "organizedList", contendo um array de strings.
Para cada produto na lista de entrada, identifique todas as suas variações (ex: cores diferentes) e crie uma linha separada para cada uma.
Limpe informações desnecessárias como saudações ou emojis.
Padronize a quantidade para o formato "1x " no início de cada linha se nenhuma for especificada.`;

const standardizePromptText = `Você é um especialista em padronização de dados de produtos. Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado, focando apenas em marcas específicas (Xiaomi, Realme, Motorola ou Samsung).
Sua saída deve ser um objeto JSON com as chaves "standardizedList" (um array de strings padronizadas) e "unprocessedItems" (um array de objetos com "line" e "reason").
Para cada linha de uma marca prioritária, reorganize os componentes para seguir a ordem: Marca Modelo Armazenamento RAM Cor Rede Preço.
Itens de outras marcas ou com formato inválido devem ir para "unprocessedItems".`;

const lookupPromptText = `Você é um sistema de correspondência de SKU. Sua tarefa é encontrar o SKU correto para cada produto da lista de entrada, usando o banco de dados fornecido.
Sua saída deve ser um objeto JSON com a chave "details", contendo um array de objetos com "sku", "name", e "costPrice".
Para cada produto da entrada, encontre o produto correspondente no banco de dados, fazendo uma correspondência flexível de nome, e extraia o SKU.
Se nenhuma correspondência confiável for encontrada, o SKU deve ser "SEM CÓDIGO".`;


const PROMPTS: Record<StepId, (input: string) => string> = {
  organizar: (txt) => `${organizePromptText}\n\nLISTA BRUTA DO FORNECEDOR:\n'''\n${txt}\n'''`,
  padronizar: (txt) => `${standardizePromptText}\n\nLISTA ORGANIZADA PARA ANÁLISE:\n'''\n${txt}\n'''`,
  lookup: (txt) => `${lookupPromptText}\n\nLISTA PADRONIZADA (Entrada para processar):\n'''\n${txt}\n'''`,
  mapear: (txt) => txt, 
  precificar: (txt) => txt,
  teste_gpt: (txt) => txt,
};

export async function processListFullFlowAction(
  formData: FormData
): Promise<{ result: FullFlowResult | null; error: string | null }> {
    
    const rawList = formData.get('rawList') as string;
    const databaseList = formData.get('databaseList') as string;

    try {
        if (!rawList?.trim()) {
            return { result: null, error: "Informe a lista para processar." };
        }
        if (!databaseList?.trim()) {
            return { result: null, error: "O banco de dados de produtos está vazio." };
        }
    
        const outOrganizar = await runStep("organizar", PROMPTS.organizar(rawList));
        
        let organizedData: OrganizeResult;
        try {
            organizedData = extractJson<OrganizeResult>(outOrganizar);
        } catch {
            throw new Error("A etapa de organização retornou um JSON inválido.");
        }

        const outPadronizar = await runStep("padronizar", PROMPTS.padronizar(organizedData.organizedList.join('\n')));
        
        let standardizedData: StandardizeListOutput;
        try {
            standardizedData = extractJson<StandardizeListOutput>(outPadronizar);
        } catch {
            throw new Error("A etapa de padronização retornou um JSON inválido.");
        }

        const lookupInput = `${standardizedData.standardizedList.join('\n')}\n\nBANCO DE DADOS:\n${databaseList}`;
        const outLookup = await runStep("lookup", PROMPTS.lookup(lookupInput));

        revalidatePath("/feed-25");
        return {
            result: {
                organizar: JSON.stringify(organizedData, null, 2),
                padronizar: JSON.stringify(standardizedData, null, 2),
                lookup: outLookup,
            },
            error: null
        };
    } catch (e) {
        return { result: null, error: e instanceof Error ? e.message : "Ocorreu um erro desconhecido no fluxo." };
    }
}
    
export async function runOpenAiAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: string | null; error: string | null }> {
  const prompt = formData.get('prompt') as string;
  if (!prompt) {
    return { result: null, error: 'O prompt não pode estar vazio.' };
  }

  try {
    const wrapped = [
      "Responda em **json** válido, no formato de um objeto.",
      'Não inclua texto fora do JSON. Exemplo de formato: {"data": ...}.',
      "PROMPT DO USUÁRIO:",
      prompt
    ].join("\n\n");

    const result = await runStep('teste_gpt', wrapped);
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || 'Falha ao executar o teste com GPT.' };
  }
}
    
export async function updateMlAccountNicknameAction(_prevState: any, formData: FormData): Promise<{ success: boolean; error: string | null }> {
    const accountId = formData.get('accountId') as string;
    const accountName = formData.get('accountName') as string;
    if (!accountId || !accountName) {
        return { success: false, error: 'ID da conta e nome da conta são obrigatórios.' };
    }
    try {
        await updateMlAccount(accountId, accountName);
        revalidatePath('/anuncios');
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e.message || 'Falha ao atualizar o nome da conta.' };
    }
}

export async function createCatalogListingAction(
  _prevState: any,
  formData: FormData
): Promise<CreateListingResult> {
  let payload: CreateListingPayload | null = null;
  try {
    const accountId = formData.get('accountId') as string;
    const listingTypeId = formData.get('listing_type_id') as string;
    const catalogProductId = formData.get('catalog_product_id') as string;
    const sellerSku = formData.get('sellerSku') as string || ''; // Aceita SKU vazio
    
    const creds = await getMlCredentialsById(accountId);
    if (!creds?.accessToken) {
      return { success: false, error: `Credenciais ou accessToken para a conta ID ${accountId} não encontrados.`, result: null };
    }
    
    // START: Lógica de verificação de duplicidade
    const myItems = await loadMyItems();
    const existingListing = myItems.find(item => 
      item.id_conta_autenticada === accountId &&
      item.catalog_product_id === catalogProductId &&
      item.listing_type_id === listingTypeId &&
      item.status === 'active'
    );
    if (existingListing) {
      return { success: false, error: `Já existe um anúncio ativo (${existingListing.id}) para este produto, nesta conta e com este tipo de anúncio.`, result: null };
    }
    // END: Lógica de verificação de duplicidade

    const conditionValue = formData.get('condition') as string;
    const itemConditionValueName = conditionValue === 'new' ? 'Nuevo' : 'Usado';
    const itemConditionValueId = conditionValue === 'new' ? '2230284' : '2230581';


    payload = {
      site_id: "MLB",
      category_id: formData.get('category_id') as string,
      price: Number(formData.get('price')),
      currency_id: "BRL",
      available_quantity: Number(formData.get('available_quantity')),
      buying_mode: "buy_it_now",
      listing_type_id: listingTypeId,
      condition: formData.get('condition') as 'new' | 'used' | 'not_specified',
      sale_terms: [
        { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
        { id: "WARRANTY_TIME", value_name: "3 meses" },
      ],
      pictures: [],
      attributes: [
        {
            id: "CARRIER",
            name: "Compañía telefónica",
            value_id: "298335",
            value_name: "Liberado",
            value_struct: null,
            attribute_group_id: "OTHERS",
            attribute_group_name: "Otros"
        },
        {
            id: "ITEM_CONDITION",
            name: "Condición del ítem",
            value_id: itemConditionValueId,
            value_name: itemConditionValueName,
            value_struct: null,
            attribute_group_id: "OTHERS",
            attribute_group_name: "Otros"
        }
      ],
      catalog_product_id: catalogProductId,
      catalog_listing: true, 
      shipping: {
        mode: "me2",
        methods: [],
        tags: [
            "self_service_out",
            "mandatory_free_shipping",
            "self_service_available"
        ],
        dimensions: null,
        local_pick_up: false,
        free_shipping: true,
        logistic_type: "xd_drop_off"
      },
    };
    
    // Adiciona o SKU apenas se ele foi fornecido
    if (sellerSku) {
        payload.attributes.push({ 
            id: "SELLER_SKU",
            value_name: sellerSku
        });
    }
    
    // Adiciona o título apenas se não for um anúncio de catálogo
    if (!payload.catalog_listing) {
      payload.title = formData.get('title') as string;
    }
    
    const result = await createListingFromCatalog(payload, creds.accessToken);

    if (result.error) {
        return { success: false, error: result.error, result: result.data, payload };
    }
    
    revalidatePath('/laboratorio/testes-mercado-livre');
    revalidatePath('/anuncios'); // Adicionado para revalidar a página de anúncios
    return { success: true, error: null, result: result.data, payload };

  } catch(e: any) {
    return { success: false, error: e.message || 'Falha ao criar o anúncio.', result: null, payload };
  }
}


export async function saveProductsAction(products: Product[]) {
  try {
    await saveProducts(products);
    revalidatePath('/produtos');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function saveMagaluCredentialsAction(_prevState: any, formData: FormData): Promise<{ success: boolean; error: string | null; message: string; }> {
    try {
        const payload: MagaluCredentials = {
            accountName: formData.get('accountName') as string,
            uuid: formData.get('uuid') as string,
            clientId: formData.get('clientId') as string,
            clientSecret: formData.get('clientSecret') as string,
            refreshToken: formData.get('refreshToken') as string,
            accessToken: formData.get('accessToken') as string | undefined,
        };

        if (!payload.accountName || !payload.clientId || !payload.clientSecret) {
            throw new Error("Nome da conta, Client ID e Client Secret são obrigatórios.");
        }

        await saveMagaluCredentials(payload);
        
        // Futuramente, adicionar o teste de conexão aqui
        
        return { success: true, error: null, message: "Credenciais da Magalu salvas com sucesso!" };

    } catch (e: any) {
        return { success: false, error: e.message, message: '' };
    }
}

export async function fetchAllProductsFromFeedAction(): Promise<{ products: FeedEntry['products'] | null, error: string | null }> {
    try {
        const products = await fetchAllProductsFromFeedService();
        return { products, error: null };
    } catch (e: any) {
        return { products: null, error: e.message || 'Falha ao buscar produtos do feed.' };
    }
}
    

    

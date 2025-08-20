

import type { Sale } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { iderisFields } from '@/lib/ideris-fields';
import { subDays } from 'date-fns';

let inMemoryToken: { token: string; expires: number } | null = null;
const TOKEN_LIFETIME = 3500 * 1000;

async function generateAccessToken(privateKey: string): Promise<string> {
    const loginUrl = 'https://apiv3.ideris.com.br/login';
    if (!privateKey) {
      throw new Error("A Chave Privada da Ideris (login_token) é obrigatória.");
    }
    const body = JSON.stringify(privateKey);
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(loginUrl, { method: 'POST', headers, body, cache: 'no-store' });
    const responseText = await response.text();
    if (!response.ok) {
        console.error('Ideris auth error response:', responseText);
        let specificError = responseText;
        try {
            const errorData = JSON.parse(responseText);
            specificError = errorData?.message || errorData?.errors?.[0] || responseText;
        } catch (e) {}
        throw new Error(`Falha na autenticação: ${specificError}`);
    }
    const token = responseText.replace(/"/g, '');
    inMemoryToken = { token, expires: Date.now() + TOKEN_LIFETIME };
    return token;
}

async function getValidAccessToken(privateKey: string): Promise<string> {
    if (inMemoryToken && inMemoryToken.expires > Date.now()) {
        return inMemoryToken.token;
    }
    return await generateAccessToken(privateKey);
}

function getValueFromPath(obj: any, path: string | undefined): any {
    if (!path) return undefined;
    return path.split('.').reduce((res, key) => {
        if (res === undefined || res === null) return undefined;
        if (key.endsWith('[0]')) {
            const arrKey = key.slice(0, -3);
            return Array.isArray(res[arrKey]) && res[arrKey].length > 0 ? res[arrKey][0] : undefined;
        }
        return res[key];
    }, obj);
}

export function mapIderisOrderToSale(iderisOrder: any, index: number): Sale {
    const mappedSale: Partial<Sale> = {};
    iderisFields.forEach(iderisField => {
        (mappedSale as any)[iderisField.key] = getValueFromPath(iderisOrder, iderisField.path);
    });
    let cleanedSale: any = { ...mappedSale };
    for (const key in cleanedSale) {
        if (Object.prototype.hasOwnProperty.call(cleanedSale, key)) {
            let value = cleanedSale[key];
             if (value === null || value === undefined) {
                const numericKeys = ['value_with_shipping', 'paid_amount', 'fee_shipment', 'fee_order', 'net_amount', 'left_over', 'discount', 'discount_marketplace', 'item_quantity'];
                if (numericKeys.includes(key)) { cleanedSale[key] = 0; } else { cleanedSale[key] = ''; }
                continue;
            }
            const keyLower = key.toLowerCase();
            if (keyLower.includes('date') || keyLower.includes('approved') || keyLower.includes('sent')) {
                 const parsedDate = new Date(value as string);
                 cleanedSale[key] = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : '';
            } else if (typeof value === 'string' && (keyLower.includes('value') || keyLower.includes('amount') || keyLower.includes('fee') || keyLower.includes('cost') || keyLower.includes('discount') || keyLower.includes('leftover') || keyLower.includes('profit'))) {
                cleanedSale[key] = parseFloat(value.replace(',', '.')) || 0;
            }
        }
    }
    const finalSale = cleanedSale as Sale;
    finalSale.id = `ideris-${(mappedSale as any).order_id || `temp-${index}`}`;
    finalSale.costs = finalSale.costs || [];
    finalSale.productName = finalSale.productName || (finalSale as any).item_title;
    return finalSale;
}

function formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
}

async function fetchWithToken<T>(url: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const headers = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...options.headers };
    const response = await fetch(url, { ...options, headers, cache: 'no-store' });
     if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ideris API error for URL ${url}:`, errorText);
        try {
            const errorData = JSON.parse(errorText);
            if (response.status === 401 || errorData?.message?.includes("Authorization has been denied for this request")) {
                throw new Error("Token de acesso expirado ou inválido.");
            }
            throw new Error(`Erro na API Ideris: ${errorData.message || response.statusText}`);
        } catch (e) {
             if (e instanceof Error && e.message.includes("Token de acesso expirado")) throw e;
             throw new Error(`Erro na API Ideris: ${response.statusText} - ${errorText || "Resposta vazia."}`);
        }
    }
    const responseText = await response.text();
    if (!responseText) {
        // CORREÇÃO: Retorna um objeto vazio em vez de lançar um erro.
        return JSON.parse('{}');
    }
    return JSON.parse(responseText);
}

type ProgressCallback = (progress: number, current: number, total: number) => void;

async function fetchOrderDetailsByIds(orderIds: string[], token: string, onProgress?: ProgressCallback): Promise<Sale[]> {
    const sales: Sale[] = [];
    for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        if (orderId) {
            try {
                const detailsResult = await fetchOrderById(token, orderId);
                if (detailsResult && detailsResult.obj) {
                    sales.push(mapIderisOrderToSale(detailsResult.obj, i));
                }
            } catch (e) {
                console.warn(`Falha ao buscar detalhes do pedido ${orderId}:`, e);
            }
        }
        if (onProgress) {
            const currentCount = i + 1;
            onProgress((currentCount / orderIds.length) * 100, currentCount, orderIds.length);
        }
    }
    return sales;
}

export async function fetchOpenOrdersFromIderis(privateKey: string): Promise<any[]> {
    const token = await getValidAccessToken(privateKey);
    const startDate = formatDateForApi(subDays(new Date(), 5));
    const endDate = formatDateForApi(new Date());

    let allSummaries: any[] = [];
    let currentOffset = 0;
    const limitPerPage = 50;
    let hasMorePages = true;
    let currentPage = 0;
    const maxPages = 100; // Safety break for infinite loops

    while (hasMorePages && currentPage < maxPages) {
        const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${startDate}&endDate=${endDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;
        try {
            const searchResult = await fetchWithToken<{ obj?: any[], result?: { obj?: any[] } }>(searchUrl, token);
            let pageResults: any[] = [];

            if (searchResult?.result?.obj && Array.isArray(searchResult.result.obj)) {
                pageResults = searchResult.result.obj;
            } else if (searchResult?.obj && Array.isArray(searchResult.obj)) {
                pageResults = searchResult.obj;
            }
            
            if (pageResults.length > 0) {
                allSummaries = allSummaries.concat(pageResults);
                currentOffset += pageResults.length;
            } else {
                hasMorePages = false;
            }
        } catch (error) {
            console.error(`Falha ao buscar página ${currentPage + 1} de pedidos da Ideris:`, error);
            hasMorePages = false; // Stop fetching on error
        }
        currentPage++;
    }

    if (currentPage >= maxPages) {
        console.warn("Atingido o limite máximo de páginas na busca da Ideris. A lista pode estar incompleta.");
    }

    return allSummaries;
}


async function performFetchWithRetry(privateKey: string, dateRange: DateRange, existingSaleIds: string[], onProgress?: ProgressCallback): Promise<Sale[]> {
    if (!dateRange.from || !dateRange.to) throw new Error("O período de datas é obrigatório para a busca.");
    const token = await getValidAccessToken(privateKey);
    const initialDate = formatDateForApi(dateRange.from);
    const finalDate = formatDateForApi(dateRange.to);
    let allSummaries: any[] = [];
    let currentOffset = 0;
    const limitPerPage = 50;
    let hasMorePages = true;
    let currentPage = 0;
    const maxPages = 100; // Prevenção de loop infinito

    while (hasMorePages && currentPage < maxPages) {
        const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${initialDate}&endDate=${finalDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;
        const searchResult = await fetchWithToken<{ obj?: any[], result?: { obj?: any[] } }>(searchUrl, token);

        let pageResults: any[] = [];

        // --- INÍCIO DA CORREÇÃO ---
        // Lógica robusta para encontrar os resultados da página atual
        if (searchResult?.result?.obj && Array.isArray(searchResult.result.obj)) {
            pageResults = searchResult.result.obj;
        } else if (searchResult?.obj && Array.isArray(searchResult.obj)) {
            pageResults = searchResult.obj;
        }
        // --- FIM DA CORREÇÃO ---

        if (pageResults.length > 0) {
            allSummaries = allSummaries.concat(pageResults);
            currentOffset += pageResults.length;
        } else {
            hasMorePages = false;
        }
        currentPage++;
    }

    if (currentPage >= maxPages) {
        console.warn("Atingido o limite máximo de páginas na busca da Ideris. A lista pode estar incompleta.");
    }
    
    console.log('[Dashboard Fetch] Total de pedidos encontrados na Ideris:', allSummaries.length);
    console.log('[Dashboard Fetch] IDs já existentes no seu DB:', existingSaleIds.length);

    const newSummaries = allSummaries.filter(summary => !existingSaleIds.includes(`ideris-${summary.id}`));
    
    console.log('[Dashboard Fetch] Novos pedidos a serem importados:', newSummaries.length);

    const newOrderIds = newSummaries.map(s => String(s.id)); // Garante que IDs sejam strings
    if (newOrderIds.length === 0) {
        if (onProgress) onProgress(100, 0, 0);
        return [];
    }

    const tokenForDetails = await getValidAccessToken(privateKey);
    return await fetchOrderDetailsByIds(newOrderIds, tokenForDetails, onProgress);
}

export async function fetchOrdersFromIderis(privateKey: string, dateRange: DateRange, existingSaleIds: string[], onProgress?: ProgressCallback): Promise<Sale[]> {
  try {
      return await performFetchWithRetry(privateKey, dateRange, existingSaleIds, onProgress);
  } catch (error) {
      if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
          console.log("Token expirado, gerando um novo e tentando novamente...");
          inMemoryToken = null;
          return await performFetchWithRetry(privateKey, dateRange, existingSaleIds, onProgress);
      }
      console.error('Falha ao buscar pedidos da Ideris:', error);
      throw error instanceof Error ? new Error(`Não foi possível buscar os pedidos da Ideris: ${error.message}`) : new Error('Ocorreu um erro desconhecido ao se comunicar com a Ideris.');
  }
}

export async function fetchOrderById(privateKey: string, orderId: string): Promise<any> {
    const token = await getValidAccessToken(privateKey);
    const url = `https://apiv3.ideris.com.br/order/${orderId}`;
    try {
        return await fetchWithToken<any>(url, token);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
            console.warn(`Token expirado para o pedido ${orderId}. Tentando novamente...`);
            inMemoryToken = null; // Forçar a regeneração do token
            const newToken = await getValidAccessToken(privateKey);
            return await fetchWithToken<any>(url, newToken);
        }
        console.error(`Falha ao buscar detalhes do pedido ${orderId}:`, error);
        throw error;
    }
}

export async function fetchOrdersStatus(privateKey: string, dateRange: DateRange): Promise<any[]> {
    const token = await getValidAccessToken(privateKey);
    const initialDate = formatDateForApi(dateRange.from!);
    const finalDate = formatDateForApi(dateRange.to!);

    let allStatuses: any[] = [];
    let currentOffset = 0;
    const limitPerPage = 50;
    let hasMorePages = true;
    let currentPage = 0;
    const maxPages = 100; // Safety break

    while (hasMorePages && currentPage < maxPages) {
        const searchUrl = `https://apiv3.ideris.com.br/order/status/search?startDate=${initialDate}&endDate=${finalDate}&limit=${limitPerPage}&offset=${currentOffset}`;
        try {
            const result = await fetchWithToken<{ obj?: any[] }>(searchUrl, token);
            if (result.obj && result.obj.length > 0) {
                allStatuses = allStatuses.concat(result.obj);
                currentOffset += result.obj.length;
            } else {
                hasMorePages = false;
            }
        } catch (error) {
            console.error(`Falha ao buscar página ${currentPage + 1} de status de pedidos:`, error);
            hasMorePages = false;
        }
        currentPage++;
    }

    if (currentPage >= maxPages) {
        console.warn("Atingido o limite máximo de páginas na busca de status da Ideris.");
    }
    
    return allStatuses;
}

export async function testIderisConnection(privateKey: string): Promise<{ success: boolean; message: string }> {
    try {
        await generateAccessToken(privateKey);
        return { success: true, message: "Conexão bem-sucedida!" };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
        return { success: false, message: `Falha na conexão: ${errorMessage}` };
    }
}

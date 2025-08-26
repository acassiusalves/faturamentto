
import type { Sale } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { iderisFields } from '@/lib/ideris-fields';
import { subDays } from 'date-fns';


// === UTIL: parse número em formatos "1.234,56" / "1234,56" / number ===
function toNumberSmart(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  return Number(v.replace(/\./g, '').replace(',', '.')) || 0;
}


let inMemoryToken: { token: string; expires: number } | null = null;
const TOKEN_LIFETIME = 3500 * 1000;

async function generateAccessToken(privateKey: string): Promise<string> {
  const loginUrl = 'https://apiv3.ideris.com.br/login';
  if (!privateKey) throw new Error("A Chave Privada da Ideris (login_token) é obrigatória.");

  // tenta primeiro como string pura
  let body = JSON.stringify(privateKey);
  let headers = { 'Content-Type': 'application/json' };

  let response = await fetch(loginUrl, { method: 'POST', headers, body, cache: 'no-store' });
  let text = await response.text();

  if (!response.ok) {
    // tenta como objeto { login_token: ... }
    body = JSON.stringify({ login_token: privateKey });
    response = await fetch(loginUrl, { method: 'POST', headers, body, cache: 'no-store' });
    text = await response.text();

    if (!response.ok) {
      console.error('Ideris auth error response:', text);
      try {
        const err = JSON.parse(text);
        throw new Error(`Falha na autenticação: ${err?.message || err?.errors?.[0] || text}`);
      } catch {
        throw new Error(`Falha na autenticação: ${text}`);
      }
    }
  }

  const token = text.replace(/"/g, '');
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
    
    // Explicitly add order_code if it's not already mapped by another field
    if (!('order_code' in mappedSale) && iderisOrder.code) {
        (mappedSale as any).order_code = iderisOrder.code;
    }

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
                cleanedSale[key] = toNumberSmart(value);
            }
        }
    }
    const finalSale = cleanedSale as Sale;
    finalSale.id = `ideris-${(mappedSale as any).order_id || `temp-${index}`}`;
    finalSale.costs = finalSale.costs || [];
    
    // Combine first and last names
    const firstName = (mappedSale as any).customer_name || '';
    const lastName = (mappedSale as any).customerLastName || '';
    finalSale.customer_name = `${firstName} ${lastName}`.trim();
    
    finalSale.productName = finalSale.productName || (finalSale as any).item_title;
    return finalSale;
}

function formatDateForApi(date: Date): string {
    return date.toISOString().split('T')[0];
}

async function fetchWithToken<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; statusText: string; data: T; errorBody?: string }> {
  const method = (options.method || 'GET').toUpperCase();

  // headers base
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // 👇 SÓ seta Content-Type quando realmente tem corpo
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  const text = await response.text();

  if (!response.ok) {
    let message = `Erro na API Ideris: ${response.statusText}`;
    try {
      const json = JSON.parse(text);
      if (response.status === 401 || json?.message?.includes('Authorization has been denied')) {
        message = 'Token de acesso expirado ou inválido.';
      } else if (json?.message) {
        message = `Erro na API Ideris: ${json.message}`;
      }
    } catch {}
    console.error(`Ideris API error for URL ${url} [${method}]:`, text);
    return { ok: false, statusText: message, data: null as T, errorBody: text };
  }

  // Se for ZPL, o texto é o dado. Caso contrário, tenta JSON.
  if (headers['Accept']?.includes('text/plain') || url.includes("pdfOrZpl=ZPL")) {
      return { ok: true, statusText: 'OK', data: text as any };
  }

  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = {} as T;
  }
  return { ok: true, statusText: 'OK', data };
}

type ProgressCallback = (current: number, total: number) => void;

async function fetchOrderDetailsByIds(
  orderIds: string[],
  privateKey: string,
  onProgress?: (current: number, total: number) => void
): Promise<Sale[]> {
  const sales: Sale[] = [];
  if (onProgress) onProgress(0, orderIds.length);

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    if (!orderId) continue;
    try {
      const detailsResult = await fetchOrderById(privateKey, orderId); // << privateKey!
      if (detailsResult?.obj) {
        sales.push(mapIderisOrderToSale(detailsResult.obj, i));
      }
    } catch (e) {
      console.warn(`Falha ao buscar detalhes do pedido ${orderId}:`, e);
    }
    if (onProgress) onProgress(i + 1, orderIds.length);
    // (Opcional): aguardar 100ms pra respeitar rate limit
    // await new Promise(r => setTimeout(r, 100));
  }
  return sales;
}


export async function fetchOpenOrdersFromIderis(privateKey: string): Promise<any[]> {
  const startDate = formatDateForApi(subDays(new Date(), 5));
  const endDate   = formatDateForApi(new Date());

  let allSummaries: any[] = [];
  let currentOffset = 0;
  const limitPerPage = 50;
  let hasMorePages = true;
  let currentPage = 0;
  const maxPages = 100;

  while (hasMorePages && currentPage < maxPages) {
    let token = await getValidAccessToken(privateKey);
    const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${startDate}&endDate=${endDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;

    let resp = await fetchWithToken<{ obj?: any[]; result?: { obj?: any[] } }>(searchUrl, token);

    if (!resp.ok && resp.statusText.includes('Token de acesso expirado')) {
      inMemoryToken = null;
      token = await getValidAccessToken(privateKey);
      resp = await fetchWithToken<{ obj?: any[]; result?: { obj?: any[] } }>(searchUrl, token);
    }
    if (!resp.ok) {
      console.error(`Falha ao buscar página ${currentPage + 1}:`, resp.errorBody);
      break;
    }

    const payload = resp.data || {};
    const pageResults: any[] = payload?.result?.obj ?? payload?.obj ?? [];

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
  return allSummaries;
}


async function performFetchWithRetry(
  privateKey: string,
  dateRange: DateRange,
  existingSaleIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Sale[]> {
  if (!dateRange.from || !dateRange.to) throw new Error("O período de datas é obrigatório para a busca.");

  const initialDate = formatDateForApi(dateRange.from);
  const finalDate   = formatDateForApi(dateRange.to);

  let allSummaries: any[] = [];
  let currentOffset = 0;
  const limitPerPage = 50;
  let hasMorePages = true;
  let currentPage = 0;
  const maxPages = 100;

  while (hasMorePages && currentPage < maxPages) {
    let token = await getValidAccessToken(privateKey);
    const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${initialDate}&endDate=${finalDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;

    let resp = await fetchWithToken<{ obj?: any[]; result?: { obj?: any[] } }>(searchUrl, token);

    // tenta renovar token se 401
    if (!resp.ok && resp.statusText.includes('Token de acesso expirado')) {
      inMemoryToken = null;
      token = await getValidAccessToken(privateKey);
      resp = await fetchWithToken<{ obj?: any[]; result?: { obj?: any[] } }>(searchUrl, token);
    }
    if (!resp.ok) throw new Error(resp.statusText);

    const payload = resp.data || {};
    const pageResults: any[] = payload?.result?.obj ?? payload?.obj ?? [];

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

  const newSummaries = allSummaries.filter(s => !existingSaleIds.includes(`ideris-${s.id}`));
  const newOrderIds = newSummaries.map(s => String(s.id));
  if (newOrderIds.length === 0) {
    if (onProgress) onProgress(0, 0);
    return [];
  }

  // >>> passa privateKey (não token)!
  return await fetchOrderDetailsByIds(newOrderIds, privateKey, onProgress);
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
        const result = await fetchWithToken<any>(url, token);
        // Ensure the order code is present in the final object
        if (result && result.data && result.data.obj && !result.data.obj.code) {
            result.data.obj.code = result.data.obj.id; // Fallback to id if code is missing
        }
        return result.data;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
            console.warn(`Token expirado para o pedido ${orderId}. Tentando novamente...`);
            inMemoryToken = null; // Forçar a regeneração do token
            const newToken = await getValidAccessToken(privateKey);
            const result = await fetchWithToken<any>(url, newToken);
             if (result && result.data && result.data.obj && !result.data.obj.code) {
                result.data.obj.code = result.data.obj.id;
            }
            return result.data;
        }
        console.error(`Falha ao buscar detalhes do pedido ${orderId}:`, error);
        throw error;
    }
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

export async function fetchOrderLabel(
  privateKey: string,
  orderId: string,
  format: 'PDF' | 'ZPL'
): Promise<{ data: any; error?: string; rawError?: string }> {
  const token = await getValidAccessToken(privateKey);
  const url = `https://apiv3.ideris.com.br/order/label?orderId=${orderId}&pdfOrZpl=${format}`;
  
  const headers = { 'Accept': format === 'ZPL' ? 'text/plain' : 'application/json' };
  const response = await fetchWithToken<any>(url, token, { headers });

  if (!response.ok) {
    return { data: null, error: response.statusText, rawError: response.errorBody };
  }
  
  if (format === 'ZPL') {
      try {
        // Tenta parsear como JSON primeiro, caso a API retorne um JSON mesmo para ZPL
        const jsonData = JSON.parse(response.data);
        const zplText = jsonData?.obj?.[0]?.text;
        if(zplText) {
            return { data: { obj: [{ text: zplText }] } };
        }
      } catch (e) {
        // Se não for JSON, assume que é texto ZPL puro
        return { data: { obj: [{ text: response.data }] } };
      }
  }

  return { data: response.data };
}

export async function fetchOrdersStatus(
  privateKey: string,
  dateRange: DateRange,
  onProgress?: ProgressCallback,
  totalToSync?: number
): Promise<any[]> {
    if (!dateRange.from || !dateRange.to) {
        throw new Error("O período de datas é obrigatório para a busca de status.");
    }
    const token = await getValidAccessToken(privateKey);
    const startDate = formatDateForApi(dateRange.from);
    const endDate = formatDateForApi(dateRange.to);

    const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${startDate}&endDate=${endDate}&sort=desc&limit=9999`;
    
    if (onProgress) onProgress(0, totalToSync || 1);
    
    const response = await fetchWithToken<{result?: { obj: any[]}}>(searchUrl, token);

    if (onProgress) onProgress(totalToSync || 1, totalToSync || 1);

    if (!response.ok) {
        throw new Error(response.statusText);
    }
    
    return response.data?.result?.obj || [];
}

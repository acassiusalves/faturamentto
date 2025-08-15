
"use client";

import type { Sale } from '@/lib/types';
import type { DateRange } from 'react-day-picker';
import { iderisFields } from '@/lib/ideris-fields';
import { startOfDay } from 'date-fns';

// This is a simplified in-memory "cache" for the token.
// In a more complex app, this might use a proper cache like Redis with TTL.
let inMemoryToken: { token: string; expires: number } | null = null;
const TOKEN_LIFETIME = 3500 * 1000; // 3500 seconds in ms, slightly less than 1 hour.

async function generateAccessToken(privateKey: string): Promise<string> {
    const loginUrl = 'https://apiv3.ideris.com.br/login';
    
    if (!privateKey) {
      throw new Error("A Chave Privada da Ideris (login_token) é obrigatória.");
    }

    // According to the documentation, the body must be the token as a JSON string literal.
    const body = JSON.stringify(privateKey);
    const headers = { 'Content-Type': 'application/json' };

    const response = await fetch(loginUrl, {
        method: 'POST',
        headers: headers,
        body: body,
        cache: 'no-store'
    });
    
    const responseText = await response.text();

    if (!response.ok) {
        console.error('Ideris auth error response:', responseText);
        let specificError = responseText;
        try {
            const errorData = JSON.parse(responseText);
            specificError = errorData?.message || errorData?.errors?.[0] || responseText;
        } catch (e) {
            // Ignore if parsing fails, use the raw text.
        }
        throw new Error(`Falha na autenticação: ${specificError}`);
    }
    
    // The response is a string literal including quotes, which need to be removed.
    const token = responseText.replace(/"/g, '');
    inMemoryToken = { token, expires: Date.now() + TOKEN_LIFETIME };
    return token;
}

async function getValidAccessToken(privateKey: string): Promise<string> {
    if (inMemoryToken && inMemoryToken.expires > Date.now()) {
        return inMemoryToken.token;
    }
    // Token is expired or doesn't exist, generate a new one
    return await generateAccessToken(privateKey);
}

export async function testIderisConnection(privateKey: string): Promise<{ success: boolean; message: string; }> {
    try {
        const accessToken = await generateAccessToken(privateKey);
        if (accessToken) {
             return { success: true, message: 'Conexão bem-sucedida.' };
        }
        return { success: false, message: 'Falha ao obter o Access Token.' };
    } catch (error: any) {
        console.error('Erro ao testar conexão com Ideris:', error);
        return { success: false, message: error.message || 'Ocorreu um erro desconhecido.' };
    }
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


function mapIderisOrderToSale(iderisOrder: any, index: number): Sale {
    const mappedSale: Partial<Sale> = {};

    iderisFields.forEach(iderisField => {
        (mappedSale as any)[iderisField.key] = getValueFromPath(iderisOrder, iderisField.path);
    });

    // Create a mutable copy for cleaning
    let cleanedSale: any = { ...mappedSale };

    // Perform data sanitization and type coercion
    for (const key in cleanedSale) {
        if (Object.prototype.hasOwnProperty.call(cleanedSale, key)) {
            let value = cleanedSale[key];
             if (value === null || value === undefined) {
                // Keep the type consistent: set to 0 for numbers, '' for strings
                const numericKeys = ['value_with_shipping', 'paid_amount', 'fee_shipment', 'fee_order', 'net_amount', 'left_over', 'discount', 'discount_marketplace', 'item_quantity'];
                if (numericKeys.includes(key)) {
                    cleanedSale[key] = 0;
                } else if (key === 'order_status') {
                    cleanedSale[key] = ''; // Ensure order_status is never undefined
                }
                else {
                    cleanedSale[key] = ''; // Default to empty string for any other undefined/null value
                }
                continue;
            }

            const keyLower = key.toLowerCase();
            if (keyLower.includes('date') || keyLower.includes('approved')) {
                 const parsedDate = new Date(value as string);
                 cleanedSale[key] = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : '';
            } else if (typeof value === 'string' && (keyLower.includes('value') || keyLower.includes('amount') || keyLower.includes('fee') || keyLower.includes('cost') || keyLower.includes('discount') || keyLower.includes('leftover') || keyLower.includes('profit'))) {
                cleanedSale[key] = parseFloat(value.replace(',', '.')) || 0;
            }
        }
    }
    
    // Final default values and calculations
    const finalSale = cleanedSale as Sale;
    finalSale.id = `ideris-${(mappedSale as any).order_id || `temp-${index}`}`;
    finalSale.costs = finalSale.costs || [];
    finalSale.productName = finalSale.productName || (finalSale as any).item_title;


    return finalSale;
}


function formatDateForApi(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

async function fetchWithToken<T>(url: string, accessToken: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
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
        // Return a default value for the generic type T, like an empty object or array
        // depending on what the caller expects. Here, null seems safer.
        return null as T;
    }
    return JSON.parse(responseText);
}

type ProgressCallback = (progress: number, current: number, total: number) => void;

async function fetchOrderDetailsByIds(orderIds: string[], token: string, onProgress?: ProgressCallback): Promise<Sale[]> {
    const sales: Sale[] = [];
    const totalOrders = orderIds.length;

    for (let i = 0; i < totalOrders; i++) {
        const orderId = orderIds[i];
        if (orderId) {
            const detailsUrl = `https://apiv3.ideris.com.br/order/${orderId}`;
            try {
                const detailsResult = await fetchWithToken<{ obj: any }>(detailsUrl, token);
                if (detailsResult && detailsResult.obj) {
                    sales.push(mapIderisOrderToSale(detailsResult.obj, i));
                }
            } catch (e) {
                console.warn(`Falha ao buscar detalhes do pedido ${orderId}:`, e);
            }
        }
        if (onProgress) {
            const currentCount = i + 1;
            const progressPercentage = (currentCount / totalOrders) * 100;
            onProgress(progressPercentage, currentCount, totalOrders);
        }
    }
    return sales;
}


async function performFetchWithRetry(
    privateKey: string, 
    dateRange: DateRange, 
    existingSaleIds: string[], 
    onProgress?: ProgressCallback
): Promise<Sale[]> {
    if (!dateRange.from || !dateRange.to) {
        throw new Error("O período de datas é obrigatório para a busca.");
    }

    const token = await getValidAccessToken(privateKey);
    const initialDate = formatDateForApi(dateRange.from);
    const finalDate = formatDateForApi(dateRange.to);

    let allSummaries: any[] = [];
    let currentOffset = 0;
    const limitPerPage = 50;
    let hasMorePages = true;

    while (hasMorePages) {
        const searchUrl = `https://apiv3.ideris.com.br/order/search?startDate=${initialDate}&endDate=${finalDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;
        const searchResult = await fetchWithToken<{ obj: any[] }>(searchUrl, token);

        if (searchResult && Array.isArray(searchResult.obj) && searchResult.obj.length > 0) {
            allSummaries = allSummaries.concat(searchResult.obj);
            currentOffset += searchResult.obj.length;
        } else {
            hasMorePages = false;
        }
    }
    
    // Filter out orders that already exist in the database
    const newSummaries = allSummaries.filter(summary => !existingSaleIds.includes(`ideris-${summary.id}`));
    const newOrderIds = newSummaries.map(s => s.id);
    
    if (newOrderIds.length === 0) {
        if (onProgress) onProgress(100, 0, 0);
        return [];
    }

    return await fetchOrderDetailsByIds(newOrderIds, token, onProgress);
}

export async function fetchOrdersFromIderis(
    privateKey: string, 
    dateRange: DateRange, 
    existingSaleIds: string[],
    onProgress?: ProgressCallback
): Promise<Sale[]> {
  try {
      return await performFetchWithRetry(privateKey, dateRange, existingSaleIds, onProgress);
  } catch (error) {
      if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
          console.log("Token expirado, gerando um novo e tentando novamente...");
          inMemoryToken = null; // Força a geração de um novo token na próxima chamada
          return await performFetchWithRetry(privateKey, dateRange, existingSaleIds, onProgress);
      }
      console.error('Falha ao buscar pedidos da Ideris:', error);
      if (error instanceof Error) {
        throw new Error(`Não foi possível buscar os pedidos da Ideris: ${error.message}`);
      }
      throw new Error('Ocorreu um erro desconhecido ao se comunicar com a Ideris.');
  }
}

async function searchOrdersByDate(privateKey: string, days: number): Promise<Sale[]> {
    const token = await getValidAccessToken(privateKey);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const initialDate = formatDateForApi(startDate);
    const finalDate = formatDateForApi(endDate);
    
    let allSummaries: any[] = [];
    let currentOffset = 0;
    const limitPerPage = 50;
    let hasMorePages = true;

    while(hasMorePages) {
        const url = `https://apiv3.ideris.com.br/order/search?startDate=${initialDate}&endDate=${finalDate}&sort=desc&limit=${limitPerPage}&offset=${currentOffset}`;
        const result = await fetchWithToken<{ obj: any[] }>(url, token);
        
        if (result && Array.isArray(result.obj) && result.obj.length > 0) {
            allSummaries = allSummaries.concat(result.obj);
            currentOffset += result.obj.length;
        } else {
            hasMorePages = false;
        }
    }
    
    const orderIds = allSummaries.map(s => s.id);
    return await fetchOrderDetailsByIds(orderIds, token);
}

export async function fetchOpenOrders(privateKey: string): Promise<Sale[]> {
    try {
        // Look back 5 days for open orders
        const allRecentOrders = await searchOrdersByDate(privateKey, 5);
        const statusesToInclude = ['Aberto', 'A faturar', 'Faturado', 'Em separação'];
        return allRecentOrders.filter(order => order.order_status && statusesToInclude.includes(order.order_status));
    } catch (error) {
        if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
            console.log("Token expirado, gerando um novo e tentando novamente...");
            inMemoryToken = null; // Força a geração de um novo token
            return await fetchOpenOrders(privateKey); // Retry the call
        }
        console.error('Falha ao buscar pedidos em aberto da Ideris:', error);
        if (error instanceof Error) {
            throw new Error(`Não foi possível buscar os pedidos da Ideris: ${error.message}`);
        }
        throw new Error('Ocorreu um erro desconhecido ao se comunicar com a Ideris.');
    }
}

export async function fetchOrderById(privateKey: string, orderId: string): Promise<Sale | null> {
    const token = await getValidAccessToken(privateKey);
    const url = `https://apiv3.ideris.com.br/order/${orderId}`;
    try {
        const result = await fetchWithToken<{ obj: any }>(url, token);
        if (result && result.obj) {
            return mapIderisOrderToSale(result.obj, 0);
        }
        return null;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
            inMemoryToken = null;
            return await fetchOrderById(privateKey, orderId); // Retry
        }
        console.error(`Falha ao buscar detalhes do pedido ${orderId}:`, error);
        throw error;
    }
}

export async function updateOrderStatusInIderis(privateKey: string, payload: any): Promise<any> {
    const token = await getValidAccessToken(privateKey);
    const url = `https://apiv3.ideris.com.br/order/status`;
    try {
        const result = await fetchWithToken(url, token, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        return result;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Token de acesso expirado")) {
            inMemoryToken = null;
            return await updateOrderStatusInIderis(privateKey, payload); // Retry
        }
        console.error(`Falha ao atualizar status do pedido:`, error);
        throw error;
    }
}

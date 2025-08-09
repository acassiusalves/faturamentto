// @ts-nocheck
"use server";

import { suggestCostCategory, type SuggestCostCategoryInput } from "@/ai/flows/suggest-cost-category";

export async function getCategorySuggestion(input: SuggestCostCategoryInput) {
  // This is a workaround for a bug in the AI SDK that causes a type error
  // when the function is called from a client component.
  const result = await suggestCostCategory(input);
  return result;
}


// Mock server actions for mapping page
export async function getMappingSuggestions(marketplaceId: string, headers: string[]) {
    await new Promise(res => setTimeout(res, 1000));
    // Simulate some suggestions
    const suggestions = {
        sale_id: headers.find(h => /id/i.test(h) && /venda/i.test(h)) || '',
        order_id: headers.find(h => /pedido/i.test(h)) || '',
        sale_date: headers.find(h => /data/i.test(h)) || '',
        item_sku: headers.find(h => /sku/i.test(h)) || '',
        item_title: headers.find(h => /produto|nome|titulo/i.test(h)) || '',
        gross_value: headers.find(h => /bruto|valor/i.test(h)) || '',
    };
    return suggestions;
}

export async function testIderisConnection(userId: string, privateKey: string) {
    await new Promise(res => setTimeout(res, 1500));
    if (privateKey === 'mock-private-key' || privateKey.length > 10) {
        return { success: true, message: 'Conexão bem-sucedida!' };
    }
    return { success: false, message: 'Chave privada inválida ou incorreta.' };
}


export async function getSheetHeaders(sheetId: string, apiKey: string): Promise<string[]> {
    await new Promise(res => setTimeout(res, 1000));
    if (sheetId === 'valid-sheet-id' && apiKey) {
        return ['ID Pedido', 'Data', 'SKU Produto', 'Valor', 'Custo Frete', 'Imposto', 'Comissão'];
    }
    if (!apiKey) {
      throw new Error("A chave de API do Google é necessária.");
    }
    throw new Error("Não foi possível acessar a planilha. Verifique o ID e se ela está pública.");
}

export async function importFromSheet(userId: string, sheetId: string, apiKey: string, friendlyNames: Record<string, string>, associationKey: string) {
    await new Promise(res => setTimeout(res, 2000));
    if (sheetId === 'valid-sheet-id' && associationKey) {
        return { success: true, updatedCount: 5, message: '5 vendas foram atualizadas com sucesso.' };
    }
    return { success: false, message: 'Falha na importação. Verifique os dados.' };
}
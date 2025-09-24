
'use server';

import { loadAllTrendKeywords } from '@/services/firestore';
import { z } from 'genkit';

export type TrendingProductsOutput = {
  trendingProducts: {
    productName: string;
    matchedKeywords: string[];
  }[];
};

const normalizeText = (text: string) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export async function findTrendingProducts(
  productNames: string[]
): Promise<TrendingProductsOutput> {
  // 1. Carregar todas as palavras-chave de tendências do Firestore
  const trendKeywords = await loadAllTrendKeywords();
  const normalizedTrendKeywords = trendKeywords.map(normalizeText).filter(Boolean);

  if (normalizedTrendKeywords.length === 0 || productNames.length === 0) {
    return { trendingProducts: [] };
  }

  const out: TrendingProductsOutput['trendingProducts'] = [];

  // 2. Para cada nome de produto, verificar se ele contém alguma palavra-chave de tendência
  for (const productName of productNames) {
    const normalizedProductName = normalizeText(productName);
    const matchedKeywords: string[] = [];

    for (const keyword of normalizedTrendKeywords) {
      // Verifica se o nome do produto contém a palavra-chave da tendência
      if (normalizedProductName.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // 3. Se houver correspondências, adicione à lista de resultados
    if (matchedKeywords.length > 0) {
      out.push({
        productName: productName,
        matchedKeywords: matchedKeywords,
      });
    }
  }

  return { trendingProducts: out };
}


'use server';

import { loadAllTrendEmbeddings } from '@/services/firestore';
import { generateEmbedding } from '@/ai/flows/generate-embedding-flow';
import { z } from 'genkit';

export type TrendingProductsOutput = {
  trendingProducts: {
    productName: string;
    matchedKeywords: string[];
  }[];
};

type ProductWithEmbedding = {
  name: string;
  embedding: number[];
};

type TrendWithEmbedding = {
  keyword: string;
  embedding: number[];
};

// Função para calcular o produto escalar entre dois vetores
function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0; // Vetores devem ter o mesmo tamanho
  }
  return vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
}

export async function findTrendingProducts(
  productNames: string[]
): Promise<TrendingProductsOutput> {
  const SIMILARITY_THRESHOLD = 0.75; // Limiar de similaridade (ajuste conforme necessário)

  // 1. Carregar todas as tendências com seus embeddings do Firestore
  const trendsWithEmbeddings: TrendWithEmbedding[] = (await loadAllTrendEmbeddings())
    .filter(t => t.embedding && t.embedding.length > 0) as TrendWithEmbedding[];
    
  if (trendsWithEmbeddings.length === 0 || productNames.length === 0) {
    return { trendingProducts: [] };
  }

  // 2. Gerar embeddings para todos os nomes de produtos de entrada de uma vez
  const productEmbeddingsResponse = await generateEmbedding({ texts: productNames });
  const productsWithEmbeddings: ProductWithEmbedding[] = productNames.map((name, i) => ({
    name,
    embedding: productEmbeddingsResponse.embeddings[i] || [],
  })).filter(p => p.embedding.length > 0);


  const out: TrendingProductsOutput['trendingProducts'] = [];

  // 3. Comparar cada produto com todas as tendências
  for (const product of productsWithEmbeddings) {
    const matchedKeywords: string[] = [];
    
    for (const trend of trendsWithEmbeddings) {
      // 4. Calcular o produto escalar
      const similarity = dotProduct(product.embedding, trend.embedding);
      
      // 5. Verificar se a similaridade atinge o limiar
      if (similarity >= SIMILARITY_THRESHOLD) {
        matchedKeywords.push(trend.keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      out.push({
        productName: product.name,
        matchedKeywords: matchedKeywords,
      });
    }
  }

  return { trendingProducts: out };
}

    
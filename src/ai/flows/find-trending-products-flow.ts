
'use server';

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAllTrendKeywords } from '@/services/firestore';
import { loadAppSettings } from '@/services/firestore';

const TrendingProductsInputSchema = z.object({
  productNames: z.array(z.string()).describe('A list of product names to check for trends.'),
  trendKeywords: z.array(z.string()).describe('A list of known trending keywords.'),
});

const TrendingProductInfoSchema = z.object({
  productName: z.string().describe('O nome do produto que está em alta.'),
  matchedKeywords: z.array(z.string()).describe('A lista de palavras-chave de tendência que correspondem a este produto.'),
});

const TrendingProductsOutputSchema = z.object({
  trendingProducts: z
    .array(TrendingProductInfoSchema)
    .describe('Uma lista de produtos que são considerados em alta, junto com as palavras-chave que corresponderam.'),
});

export type TrendingProductsInput = z.infer<typeof TrendingProductsInputSchema>;
export type TrendingProductsOutput = z.infer<typeof TrendingProductsOutputSchema>;

export async function findTrendingProducts(
  productNames: string[]
): Promise<TrendingProductsOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    // Se não houver chave de API, não podemos fazer a análise, então retornamos uma lista vazia.
    console.warn("Chave de API do Gemini não configurada. Análise de tendências pulada.");
    return { trendingProducts: [] };
  }
  
  const trendKeywords = await loadAllTrendKeywords();
  if (trendKeywords.length === 0) {
    // Se não há tendências salvas, não há como comparar.
    return { trendingProducts: [] };
  }

  const ai = getAi(apiKey);
  const input: TrendingProductsInput = { productNames, trendKeywords };

  const prompt = ai.definePrompt({
    name: 'findTrendingProductsPrompt',
    model: gemini15Flash,
    input: { schema: TrendingProductsInputSchema },
    output: { schema: TrendingProductsOutputSchema },
    prompt: `
      Você é um analista de e-commerce.
      Sua tarefa é comparar uma lista de nomes de produtos com uma lista de palavras-chave de tendências de busca.
      Para cada produto da lista de entrada, verifique se ele corresponde a uma ou mais palavras-chave da lista de tendências.
      Retorne APENAS os produtos que você considera estarem em alta, junto com a lista de palavras-chave que corresponderam.
      Seja rigoroso: um produto só está em alta se seu nome tiver uma forte correlação com uma ou mais palavras-chave.

      Lista de Produtos para Análise:
      {{#each productNames}}
      - {{{this}}}
      {{/each}}

      Lista de Palavras-chave em Alta:
      {{{json trendKeywords}}}
    `,
  });

  try {
    const { output } = await prompt(input);
    return output || { trendingProducts: [] };
  } catch (error) {
    console.error("Erro ao executar o fluxo de tendências:", error);
    // Em caso de erro na API, retorna uma lista vazia para não quebrar a interface.
    return { trendingProducts: [] };
  }
}

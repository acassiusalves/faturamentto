
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

const TrendingProductsOutputSchema = z.object({
  trendingProductNames: z
    .array(z.string())
    .describe('A sub-list of product names that are considered to be trending.'),
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
    return { trendingProductNames: [] };
  }
  
  const trendKeywords = await loadAllTrendKeywords();
  if (trendKeywords.length === 0) {
    // Se não há tendências salvas, não há como comparar.
    return { trendingProductNames: [] };
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
      Retorne APENAS os nomes dos produtos que você considera estarem em alta, com base na correspondência com as palavras-chave.
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
    return output || { trendingProductNames: [] };
  } catch (error) {
    console.error("Erro ao executar o fluxo de tendências:", error);
    // Em caso de erro na API, retorna uma lista vazia para não quebrar a interface.
    return { trendingProductNames: [] };
  }
}


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
      Você é um analista de e-commerce especialista em interpretar a intenção de busca dos usuários.
      Sua tarefa é comparar uma lista de nomes de produtos com uma lista de palavras-chave de tendências.

      CRITÉRIO DE CORRESPONDÊNCIA BASEADO NA INTENÇÃO:
      Um produto está "em alta" SE a palavra-chave da tendência se refere À COMPRA DO PRODUTO PRINCIPAL, e não a um acessório, peça ou consumível para ele.

      Exemplo Prático:
      - Nome do Produto: "Caixa de som Gamer RGB luz para Smartphone/Notebook/PC 6W"
      - Tendências de Pesquisa:
        - "caixa de som multilaser" -> SIM, CORRESPONDE (Busca pelo produto, com uma marca)
        - "caixa de som para pc" -> SIM, CORRESPONDE (Busca pelo produto, com um uso específico)
        - "caixa de som de musica" -> SIM, CORRESPONDE (Busca pelo produto)
        - "caixa de som amplificada" -> SIM, CORRESPONDE (Busca por um tipo do produto)
        - "fio para caixa de som" -> NÃO, NÃO CORRESPONDE (Busca por um acessório)
        - "cabo caixa de som" -> NÃO, NÃO CORRESPONDE (Busca por um acessório)
        - "bateria para caixa de som" -> NÃO, NÃO CORRESPONDE (Busca por uma peça)

      Analise a intenção de cada palavra-chave de tendência em relação a cada produto.
      Retorne APENAS os produtos que você considera estarem em alta, junto com a lista de palavras-chave que corresponderam.

      Lista de Produtos para Análise:
      {{#each productNames}}
      - {{{this}}}
      {{/each}}

      Lista de Palavras-chave em Alta para Comparar:
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


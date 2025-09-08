
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
      Você é um analista de dados rigoroso. Sua tarefa é comparar uma lista de nomes de produtos com uma lista de palavras-chave de tendências.

      CRITÉRIO DE CORRESPONDÊNCIA ESTRITO:
      Um produto está "em alta" SOMENTE SE o substantivo principal que define o tipo do produto estiver presente TANTO no nome do produto QUANTO na palavra-chave da tendência.

      Exemplos:
      - Produto: "Kit Gamer Teclado e Mouse"
        - Tendência: "mouse gamer" -> CORRESPONDE (ambos têm "mouse").
        - Tendência: "teclado mecânico" -> CORRESPONDE (ambos têm "teclado").
      - Produto: "Caixa de som bluetooth"
        - Tendência: "headset gamer" -> NÃO CORRESPONDE (A palavra "headset" não está no nome do produto. Não associe por serem ambos de áudio).
        - Tendência: "caixa som jbl" -> CORRESPONDE (ambos têm "caixa" e "som").
      
      Seja extremamente literal. Ignore qualquer correlação semântica ou de categoria.
      Retorne APENAS os produtos que você considera estarem em alta, junto com a lista de palavras-chave que corresponderam.

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

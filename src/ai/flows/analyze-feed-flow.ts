
'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing a comparative price feed.
 *
 * - analyzeFeed - Takes a list of products with prices from multiple stores and analyzes them.
 * - AnalyzeFeedInput - The input type for the analyzeFeed function.
 * - AnalyzeFeedOutput - The return type for the analyzeFeed function.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import { z } from 'genkit';

const ProductInputSchema = z.object({
  sku: z.string(),
  name: z.string(),
  averagePrice: z.number(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  storeCount: z.number(),
  prices: z.record(z.number().nullable()), // Record<storeName, price>
});

const ProductAnalysisSchema = z.object({
  sku: z.string().describe('The SKU of the product being analyzed.'),
  status: z
    .enum(['PRECO_OK', 'ATENCAO', 'OPORTUNIDADE'])
    .describe(
      'The status of the product price. PRECO_OK: Price is normal. ATENCAO: Price is suspiciously high or has large variations. OPORTUNIDADE: Price is a good buying opportunity.'
    ),
  justification: z
    .string()
    .describe('A brief justification for the assigned status.'),
});

const AnalyzeFeedOutputSchema = z.object({
  analysis: z.array(ProductAnalysisSchema),
});

export type AnalyzeFeedOutput = z.infer<typeof AnalyzeFeedOutputSchema>;

const DEFAULT_ANALYZE_PROMPT = `
Você é um analista de e-commerce especialista em comparar preços de produtos de diferentes fornecedores. Sua tarefa é analisar uma lista de produtos e seus preços para identificar anomalias, oportunidades e consistências.

**DADOS PARA ANÁLISE (formato JSON):**
\'\'\'json
{{{json products}}}
\'\'\'

**REGRAS DE ANÁLISE E CLASSIFICAÇÃO:**

Para cada produto na lista, você deve fazer uma análise e retornar um dos seguintes status:

1.  **ATENCAO**:
    *   **Critério Principal:** O preço de um produto em uma loja (MÍNIMO ou MÁXIMO) está **muito distante** da MÉDIA de preços. Uma diferença de 20% ou mais (para cima ou para baixo) é um forte sinal de alerta. Isso provavelmente indica um erro de digitação na lista de preços do fornecedor.
    *   **Justificativa:** Indique a loja com o preço discrepante e o motivo da suspeita. (ex: "Loja X com preço 30% abaixo da média. Provavelmente um erro de digitação na lista.") ou (ex: "Loja Y com preço 25% acima da média. Verificar se o produto é o mesmo ou se há erro.").

2.  **OPORTUNIDADE**:
    *   **Critério Principal:** O preço MÍNIMO de um produto está **moderadamente abaixo** do seu preço MÉDIO. Uma diferença entre 5% e 15% é um indicador realista de oportunidade.
    *   **Justificativa:** Indique qual loja tem o preço mais baixo e por que é uma boa oportunidade (ex: "Loja X com preço 10% abaixo da média. Boa oportunidade de compra para margem de lucro.").

3.  **PRECO_OK**:
    *   **Critério Principal:** Os preços em todas as lojas estão **próximos** uns dos outros e da MÉDIA. Variações pequenas (menos de 5%) são consideradas normais.
    *   **Justificativa:** Uma breve confirmação de que os preços estão alinhados. (ex: "Preços consistentes entre as lojas.").


**FORMATO DE SAÍDA OBRIGATÓRIO:**
A saída DEVE ser um objeto JSON contendo uma única chave chamada "analysis". Esta chave deve conter um array de objetos, onde cada objeto representa a análise de um produto e possui os seguintes campos:
*   \`sku\`: O SKU do produto analisado.
*   \`status\`: A classificação do produto ('OPORTUNIDADE', 'ATENCAO', ou 'PRECO_OK').
*   \`justification\`: A sua justificativa para a classificação.

Analise cada produto da lista de entrada e gere o JSON de saída completo.
`;


export async function analyzeFeed(input: any): Promise<AnalyzeFeedOutput> {
  // Move schema definition inside the function
  const AnalyzeFeedInputSchema = z.object({
    products: z.array(ProductInputSchema),
    apiKey: z.string().optional(),
    modelName: z.string().optional(),
  });
  
  const ai = getAi(input.apiKey);
  const selectedModel = input.modelName === 'gemini-1.5-pro-latest' ? gemini15Pro : gemini15Flash;

  const prompt = ai.definePrompt({
    name: 'analyzeFeedPrompt',
    model: selectedModel,
    input: { schema: AnalyzeFeedInputSchema },
    output: { schema: AnalyzeFeedOutputSchema },
    prompt: DEFAULT_ANALYZE_PROMPT,
  });

  const { output } = await prompt(input);
  return output!;
}

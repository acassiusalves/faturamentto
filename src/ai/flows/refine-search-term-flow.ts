
'use server';

/**
 * @fileOverview An AI agent that refines a product search term for Mercado Livre.
 *
 * - refineSearchTerm - A function that takes product details and returns an optimized search query.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAppSettings } from '@/services/firestore';
import { buildSearchQuery } from '@/lib/search-query';
import {
    RefineSearchTermInputSchema,
    RefineSearchTermOutputSchema,
    type RefineSearchTermInput,
    type RefineSearchTermOutput
} from '@/lib/types';


export async function refineSearchTerm(input: RefineSearchTermInput): Promise<RefineSearchTermOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;

  const fallbackQuery = buildSearchQuery({ name: input.productName, model: input.productModel, brand: input.productBrand });
  if (!apiKey) {
    return { refinedQuery: fallbackQuery };
  }

  const ai = getAi(apiKey);
  
  const refineFlow = ai.defineFlow(
    {
      name: 'refineSearchTermFlow',
      inputSchema: RefineSearchTermInputSchema,
      outputSchema: RefineSearchTermOutputSchema,
    },
    async (flowInput) => {
        const prompt = ai.definePrompt({
          name: 'refineSearchTermPrompt',
          model: gemini15Flash,
          input: { schema: RefineSearchTermInputSchema },
          output: { schema: RefineSearchTermOutputSchema },
          prompt: `
            Gere um termo curto para BUSCAR no Mercado Livre.
            Regras:
            - DEVE conter a marca (se fornecida) e o modelo (se fornecido).
            - DEVE incluir pelo menos 2 palavras relevantes do nome do produto.
            - Sem stopwords, nem pontuação; máx. 90 chars.
            Responda JSON: {"refinedQuery":"..."}
            Dados: name={{productName}}, model={{productModel}}, brand={{productBrand}}
          `,
        });
        
        try {
            const { output } = await prompt(flowInput);
            const candidate = output?.refinedQuery?.trim() || "";

            const enforcedQuery = buildSearchQuery({
              name: `${flowInput.productName} ${candidate}`,
              description: "", 
              model: flowInput.productModel,
              brand: flowInput.productBrand,
            });

            return { refinedQuery: enforcedQuery };
        } catch (e) {
            console.error("AI refinement failed, using fallback", e);
            const fallback = buildSearchQuery({ name: flowInput.productName, model: flowInput.productModel, brand: flowInput.productBrand });
            return { refinedQuery: fallback };
        }
    }
  );
  
  return refineFlow(input);
}

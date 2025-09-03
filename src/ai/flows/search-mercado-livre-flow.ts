
'use server';

/**
 * @fileOverview An AI agent that finds product offers on Mercado Livre.
 *
 * - searchMercadoLivre - A function that handles the search process.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { searchMercadoLivreProducts } from '@/services/mercadolivre';

const OfferSchema = z.object({
  title: z.string().describe('The full title of the product listing.'),
  price: z.string().describe('The price of the product, formatted as a string (e.g., "R$ 1.299,00").'),
  url: z.string().url().describe('The direct URL to the product listing.'),
});

const SearchMercadoLivreInputSchema = z.object({
  productName: z.string().describe('The name of the product to search for.'),
  apiKey: z.string().optional(),
});

const SearchMercadoLivreOutputSchema = z.object({
  offers: z.array(OfferSchema).describe('A list of offers found on Mercado Livre.'),
});

export async function searchMercadoLivre(
  input: z.infer<typeof SearchMercadoLivreInputSchema>
): Promise<z.infer<typeof SearchMercadoLivreOutputSchema>> {
  const ai = getAi(input.apiKey);

  // This tool now uses the real Mercado Livre API service.
  const searchTool = ai.defineTool(
    {
      name: 'searchMercadoLivre',
      description: 'Searches for product offers on mercadolivre.com.br and returns the top 3 results.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({
        offers: z.array(z.object({ 
            title: z.string(), 
            price: z.string(), 
            url: z.string() 
        })),
      })
    },
    async ({ query }) => {
      const results = await searchMercadoLivreProducts(query);
      
      // Map the API response to the expected Offer schema
      const mappedOffers = results.slice(0, 3).map((item: any) => ({
        title: item.title,
        price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency_id || 'BRL' }).format(item.price),
        url: item.permalink
      }));

      return {
        offers: mappedOffers
      };
    }
  );

  const searchFlow = ai.defineFlow(
    {
      name: 'searchMercadoLivreFlow',
      inputSchema: SearchMercadoLivreInputSchema,
      outputSchema: SearchMercadoLivreOutputSchema,
    },
    async (flowInput) => {
      const prompt = ai.definePrompt({
        name: 'searchMercadoLivrePrompt',
        model: gemini15Flash,
        tools: [searchTool],
        prompt: `You MUST use the searchMercadoLivre tool to find the top 3 offers for the product "{{{productName}}}" on Mercado Livre. Return the tool's output directly.`,
      });

      const { output } = await prompt(flowInput);
      
      // Ensure we always return an object with an offers array, even if it's empty.
      return output || { offers: [] };
    }
  );

  return searchFlow(input);
}


'use server';

/**
 * @fileOverview An AI agent that finds product offers on Mercado Livre.
 *
 * - searchMercadoLivre - A function that handles the search process.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';

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

  // This is a placeholder tool. In a real application, this would
  // use an actual API (like Google Custom Search API) to browse the web.
  const searchTool = ai.defineTool(
    {
      name: 'searchMercadoLivre',
      description: 'Searches for product offers on mercadolivre.com.br and returns the top 3 results.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.array(z.object({ 
        title: z.string(), 
        price: z.string(), 
        url: z.string() 
      })),
    },
    async ({ query }) => {
      console.log(`(Mock) Searching Mercado Livre for: ${query}`);
      // In a real scenario, you'd fetch from an API here.
      // This is mock data for demonstration.
      return [
        { title: `${query} - 128GB - Novo Lacrado`, price: "R$ 1.599,00", url: `https://www.mercadolivre.com.br/` },
        { title: `${query} - Pronta Entrega com Garantia`, price: "R$ 1.650,00", url: `https://www.mercadolivre.com.br/` },
        { title: `Oferta Imperdível: ${query} Original`, price: "R$ 1.550,00", url: `https://www.mercadolivre.com.br/` },
      ];
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
        prompt: `Use the searchMercadoLivre tool to find the top 3 offers for the product "{{{productName}}}" on Mercado Livre.`,
      });

      const { output } = await prompt(flowInput);
      return output!;
    }
  );

  return searchFlow(input);
}

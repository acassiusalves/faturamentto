
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

const CatalogProductSchema = z.object({
  id: z.string().describe('The Mercado Livre product ID (e.g., MLB12345678).'),
  catalog_product_id: z.string().nullable().describe('The catalog product ID, if available (e.g., MLB98765432).'),
  name: z.string().describe('The full title of the product.'),
  brand: z.string().describe('The brand of the product.'),
  model: z.string().describe('The model of the product.'),
});

const SearchMercadoLivreInputSchema = z.object({
  productName: z.string().describe('The name of the product to search for.'),
  apiKey: z.string().optional(),
});

const SearchMercadoLivreOutputSchema = z.object({
  products: z.array(CatalogProductSchema).describe('A list of catalog products found on Mercado Livre.'),
});

export async function searchMercadoLivre(
  input: z.infer<typeof SearchMercadoLivreInputSchema>
): Promise<z.infer<typeof SearchMercadoLivreOutputSchema>> {
  const ai = getAi(input.apiKey);

  const searchTool = ai.defineTool(
    {
      name: 'searchMercadoLivreCatalog',
      description: 'Searches for catalog products on mercadolivre.com.br and returns the top results.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({
        products: z.array(z.object({ 
            id: z.string(),
            catalog_product_id: z.string().nullable(),
            name: z.string(),
            brand: z.string(),
            model: z.string(),
        })),
      })
    },
    async ({ query }) => {
      const results = await searchMercadoLivreProducts(query);
      
      const mappedProducts = results.slice(0, 5).map((item: any) => {
        const attributes = new Map(item.attributes.map((attr: any) => [attr.id, attr.value_name]));
        return {
          id: item.id,
          catalog_product_id: item.catalog_product_id,
          name: item.name,
          brand: attributes.get('BRAND') || 'N/A',
          model: attributes.get('MODEL') || 'N/A',
        };
      });

      return {
        products: mappedProducts
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
        prompt: `You MUST use the searchMercadoLivreCatalog tool to find the top 5 catalog products for "{{{productName}}}" on Mercado Livre. Return the tool's output directly.`,
      });

      const { output } = await prompt(flowInput);
      
      return output || { products: [] };
    }
  );

  return searchFlow(input);
}

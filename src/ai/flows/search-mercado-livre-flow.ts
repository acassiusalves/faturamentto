
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
import { loadAppSettings } from '@/services/firestore';


const CatalogProductSchema = z.object({
  id: z.string().describe('The Mercado Livre product ID (e.g., MLB12345678).'),
  catalog_product_id: z.string().nullable().describe('The catalog product ID, if available (e.g., MLB98765432).'),
  name: z.string().describe('The full title of the product.'),
  brand: z.string().describe('The brand of the product.'),
  model: z.string().describe('The model of the product.'),
});

const SearchMercadoLivreInputSchema = z.object({
  productName: z.string().describe('The name of the product to search for.'),
});

const SearchMercadoLivreOutputSchema = z.object({
  products: z.array(CatalogProductSchema).describe('A list of catalog products found on Mercado Livre.'),
});

const RefinedQuerySchema = z.object({
  refinedQuery: z.string().describe('The refined search query, containing only the product name and model.'),
});


export async function searchMercadoLivre(
  input: z.infer<typeof SearchMercadoLivreInputSchema>
): Promise<z.infer<typeof SearchMercadoLivreOutputSchema>> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('A chave de API do Gemini não está configurada no sistema.');
  }
  const ai = getAi(apiKey);

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
      // 1. Refine the query first
      const refinePrompt = ai.definePrompt({
          name: 'refineSearchQueryPrompt',
          model: gemini15Flash,
          input: { schema: z.object({ productName: z.string() }) },
          output: { schema: RefinedQuerySchema },
          prompt: `Refine o termo de busca a seguir. Mantenha apenas o nome principal do produto e seu modelo. Remova todas as outras descrições, como "para PC/Notebook", "versão global", "cor", etc.
          
          Termo de Busca Original: "{{{productName}}}"
          `,
      });

      const { output: refinedOutput } = await refinePrompt(flowInput);
      const queryToUse = refinedOutput?.refinedQuery || flowInput.productName;

      // 2. Use the refined query to search
      const searchPrompt = ai.definePrompt({
        name: 'searchMercadoLivrePrompt',
        model: gemini15Flash,
        tools: [searchTool],
        prompt: `You MUST use the searchMercadoLivreCatalog tool to find the top 5 catalog products for "${queryToUse}" on Mercado Livre. Return the tool's output directly.`,
      });

      const { output } = await searchPrompt(flowInput);
      
      return output || { products: [] };
    }
  );

  return searchFlow(input);
}

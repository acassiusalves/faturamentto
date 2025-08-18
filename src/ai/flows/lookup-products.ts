
'use server';

/**
 * @fileOverview This file defines a Genkit flow for looking up standardized products in a database.
 *
 * - lookupProducts - Takes a standardized list and finds matching products in the database.
 * - LookupProductsInput - The input type for the lookupProducts function.
 * - LookupResult - The return type for the lookupProducts function.
 */

import {getAi} from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import {z} from 'genkit';
import type { LookupResult } from '@/lib/types';


const LookupProductsInputSchema = z.object({
  productList: z.string().describe('The standardized list of products (Brand Model Storage RAM etc.) with their costs.'),
  databaseList: z
    .string()
    .describe(
      'The list of available products in the database, formatted as "Product Name\\tSKU" per line.'
    ),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
});
export type LookupProductsInput = z.infer<typeof LookupProductsInputSchema>;


const LookupResultSchema = z.object({
  details: z
    .array(
      z.object({
        sku: z.string().describe('The corresponding SKU from the database, or "N/D" if not found.'),
        name: z.string().describe('The full name of the product from the database, or the original name if not found.'),
        costPrice: z.string().describe('The cost price of the product, extracted from the initial list.'),
      })
    )
    .describe(
      'A structured array of the final product details after matching with the database.'
    ),
});

export async function lookupProducts(input: LookupProductsInput): Promise<LookupResult> {
    const ai = getAi(input.apiKey);
    const selectedModel = input.modelName === 'gemini-1.5-pro-latest' ? gemini15Pro : gemini15Flash;

    const prompt = ai.definePrompt({
        name: 'lookupProductsPrompt',
        model: selectedModel,
        input: {schema: LookupProductsInputSchema},
        output: {schema: LookupResultSchema},
        prompt: `Você é um sistema de busca inteligente para uma loja de celulares.
        
        Sua tarefa é cruzar a 'Lista Padronizada de Produtos' com a 'Lista do Banco de Dados' para encontrar o SKU e o nome oficial de cada item, e manter o preço de custo original.

        **LISTA PADRONIZADA DE PRODUTOS (com preços):**
        \`\`\`
        {{{productList}}}
        \`\`\`

        **LISTA DO BANCO DE DADOS (Nome do Produto\tSKU):**
        \`\`\`
        {{{databaseList}}}
        \`\`\`

        **REGRAS DE BUSCA E FORMATAÇÃO:**
        1.  **Correspondência de Produtos:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima na 'Lista do Banco de Dados'. O nome no banco de dados é a versão oficial e completa do nome do produto.
        2.  **Formatação da Saída:** Crie um array de objetos ('details') onde cada objeto representa um produto e contém EXATAMENTE os seguintes campos:
            *   'sku': O SKU correspondente, extraído da 'Lista do Banco de Dados'. Se um item não for encontrado, use o valor "N/D".
            *   'name': O nome COMPLETO e OFICIAL do produto, exatamente como está na 'Lista do Banco de Dados'. Se não for encontrado, repita o nome do produto da 'Lista Padronizada'.
            *   'costPrice': O preço de custo, extraído da 'Lista Padronizada' original. Formate como "R$ XXX,XX".
        
        **EXEMPLO DE ENTRADA:**
        *   productList: \`Redmi Note 12 256GB Global 8GB RAM Azul 5G 1200.00\nTablet Galaxy A9 64GB Global 4GB RAM 4G 630.00\`
        *   databaseList: \`Xiaomi Redmi Note 12 256GB 8GB RAM 5G - Versão Global\t#RN12P256A\`

        **EXEMPLO DE SAÍDA ESPERADA:**
        \`\`\`json
        {
            "details": [
                {
                    "sku": "#RN12P256A",
                    "name": "Xiaomi Redmi Note 12 256GB 8GB RAM 5G - Versão Global",
                    "costPrice": "R$ 1.200,00"
                },
                {
                    "sku": "N/D",
                    "name": "Tablet Galaxy A9 64GB Global 4GB RAM 4G",
                    "costPrice": "R$ 630,00"
                }
            ]
        }
        \`\`\`

        Execute a busca e a formatação, gerando a saída JSON completa com a chave 'details' e nada mais.
        `,
    });

    const {output} = await prompt(input);
    return output!;
}

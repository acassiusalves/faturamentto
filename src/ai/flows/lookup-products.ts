
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
  productList: z.string().describe('The standardized list of products (Brand Model Storage RAM etc.)'),
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
        name: z.string().describe('The full name of the product from the database.'),
        sku: z.string().describe('The corresponding SKU from the database.'),
        quantity: z.string().describe('The quantity of the product.'),
        unitPrice: z.string().describe('The unit price of the product.'),
        totalPrice: z.string().describe('The total price for the quantity.'),
      })
    )
    .describe(
      'A structured array of the final product details after matching with the database.'
    ),
  finalFormattedList: z
    .string()
    .describe(
      'The final output formatted as a string with columns (Name, SKU, Quantity, Unit Price, Total Price) separated by tabs.'
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
        
        Sua tarefa é cruzar a 'Lista Padronizada de Produtos' com a 'Lista do Banco de Dados' para encontrar o nome completo e o SKU de cada item.

        **LISTA PADRONIZADA DE PRODUTOS:**
        \`\`\`
        {{{productList}}}
        \`\`\`

        **LISTA DO BANCO DE DADOS (Nome do Produto\tSKU):**
        \`\`\`
        {{{databaseList}}}
        \`\`\`

        **REGRAS DE BUSCA E FORMATAÇÃO:**
        1.  **Correspondência de Produtos:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima na 'Lista do Banco de Dados'. O nome no banco de dados é a versão oficial e completa do nome do produto.
        2.  **Extração de Quantidade e Preço:** A 'Lista Padronizada' pode conter quantidade e preço. Você deve extrair a quantidade e o preço de cada linha da 'Lista Padronizada'. Se a quantidade não for explícita, assuma 1. Se o preço não for explícito, coloque "R$ 0,00".
        3.  **Criação da Lista Final ('details'):** Crie um array de objetos onde cada objeto representa um produto encontrado e contém os seguintes campos:
            *   'name': O nome COMPLETO e OFICIAL do produto, exatamente como está na 'Lista do Banco de Dados'.
            *   'sku': O SKU correspondente, extraído da 'Lista do Banco de Dados'.
            *   'quantity': A quantidade do produto, extraída da 'Lista Padronizada'.
            *   'unitPrice': O preço unitário, extraído da 'Lista Padronizada'.
            *   'totalPrice': O preço total (preço unitário * quantidade).
        4.  **Criação da String Final ('finalFormattedList'):** Crie uma única string que representa uma tabela. Cada linha corresponde a um produto e contém as colunas (Nome, SKU, Quantidade, Preço Unitário, Preço Total) separadas por um caractere de tabulação (\t).
        
        **EXEMPLO DE ENTRADA:**
        *   productList: \`Redmi Note 12 256GB 8GB RAM Azul 5G 1.200,00\`
        *   databaseList: \`Xiaomi Redmi Note 12 256GB 8GB RAM 5G - Versão Global\t#RN12P256A\`

        **EXEMPLO DE SAÍDA ESPERADA:**
        \`\`\`json
        {
            "details": [
                {
                    "name": "Xiaomi Redmi Note 12 256GB 8GB RAM 5G - Versão Global",
                    "sku": "#RN12P256A",
                    "quantity": "1",
                    "unitPrice": "R$ 1.200,00",
                    "totalPrice": "R$ 1.200,00"
                }
            ],
            "finalFormattedList": "Xiaomi Redmi Note 12 256GB 8GB RAM 5G - Versão Global\t#RN12P256A\t1\tR$ 1.200,00\tR$ 1.200,00"
        }
        \`\`\`

        Execute a busca e a formatação, gerando a saída JSON completa.
        `,
    });

    const {output} = await prompt(input);
    return output!;
}

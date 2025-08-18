
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
        sku: z.string().describe('The corresponding SKU from the database, or "SEM CÓDIGO" if not found.'),
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
        prompt: `Você é um sistema avançado de busca e organização para um e-commerce de celulares. Sua tarefa é cruzar a 'Lista Padronizada' com o 'Banco de Dados', aplicar regras de negócio específicas e organizar o resultado.

        **LISTA PADRONIZADA (Resultado do Passo 2):**
        \`\`\`
        {{{productList}}}
        \`\`\`

        **BANCO DE DADOS (Nome do Produto\tSKU):**
        \`\`\`
        {{{databaseList}}}
        \`\`\`

        **REGRAS DE PROCESSAMENTO E BUSCA:**
        1.  **Correspondência Inteligente:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima no 'Banco de Dados'.
        2.  **Foco nos Componentes-Chave:** Para a correspondência, priorize os seguintes componentes: **Modelo, RAM e Armazenamento**. Variações pequenas no nome podem ser ignoradas se estes componentes forem idênticos.
        3.  **Regra de Conectividade Padrão:**
            *   Se a 'Lista Padronizada' não especificar "4G" ou "5G", assuma **4G** como padrão ao procurar no 'Banco de Dados'.
            *   Se houver dois produtos idênticos no 'Banco de Dados' (um 4G e outro 5G), e a lista de entrada não especificar, priorize a versão **4G**. A versão 5G só deve ser escolhida se "5G" estiver explicitamente na linha do produto de entrada.
        4.  **Extração de Preço:** O preço de custo (\`costPrice\`) deve ser o valor numérico extraído do final de cada linha da 'Lista Padronizada'. Remova qualquer formatação de milhar (pontos) e use um ponto como separador decimal (ex: "1.234,56" deve se tornar "1234.56").
        5.  **Formato de Saída (JSON):** A saída deve ser um array de objetos JSON dentro da chave 'details'. Cada objeto deve conter:
            *   \`sku\`: O código do produto do 'Banco de Dados'. Se não houver uma correspondência com alta confiança, use a string **"SEM CÓDIGO"**.
            *   \`name\`: O nome completo e oficial do produto, exatamente como está no 'Banco de Dados'. Se não for encontrado, repita o nome original da 'Lista Padronizada'.
            *   \`costPrice\`: O preço de custo extraído e formatado como número.

        **REGRAS DE ORGANIZAÇÃO DO RESULTADO FINAL:**
        1.  **Agrupamento por Marca:** Organize o array 'details' final agrupando os produtos por marca na seguinte ordem de prioridade: **Xiaomi, Realme, Motorola, Samsung**.
        2.  **Itens "SEM CÓDIGO":** Todos os produtos para os quais não foi encontrado um SKU (ou seja, \`sku\` é "SEM CÓDIGO") devem ser movidos para o **final da lista**, após todas as marcas.

        **EXEMPLO DE SAÍDA ESPERADA:**
        \`\`\`json
        {
          "details": [
            { "sku": "#XMS12P256A", "name": "Xiaomi Mi 12S 256GB 8GB RAM 5G - Versão Global", "costPrice": "3100.00" },
            { "sku": "#RMGTN256P", "name": "Realme GT Neo 256GB 12GB RAM 5G - Preto", "costPrice": "2800.00" },
            { "sku": "#MTG2264A", "name": "Motorola Moto G22 64GB 4GB RAM 4G - Azul", "costPrice": "980.00" },
            { "sku": "#SMA53128V", "name": "Samsung Galaxy A53 128GB 8GB RAM 5G - Verde", "costPrice": "1500.00" },
            { "sku": "SEM CÓDIGO", "name": "Tablet Desconhecido 64GB 4GB RAM 4G", "costPrice": "630.00" }
          ]
        }
        \`\`\`

        Execute a busca, aplique todas as regras de negócio e de organização, e gere o JSON final completo.
        `,
    });

    const {output} = await prompt(input);
    return output!;
}

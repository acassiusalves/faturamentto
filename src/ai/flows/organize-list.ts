
'use server';

/**
 * @fileOverview This file defines a Genkit flow for organizing a raw, unstructured product list.
 *
 * - organizeList - Takes a raw text blob and organizes it into a line-by-line list.
 * - OrganizeListInput - The input type for the organizeList function.
 * - OrganizeResult - The return type for the organizeList function.
 */

import {getAi} from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import {z} from 'genkit';
import type { OrganizeResult } from '@/lib/types';


const OrganizeListInputSchema = z.object({
  productList: z.string().describe('The raw, unstructured list of products to process.'),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
});
export type OrganizeListInput = z.infer<typeof OrganizeListInputSchema>;


const OrganizeResultSchema = z.object({
  organizedList: z
    .string()
    .describe(
      'The cleaned and organized list, with each product on a new line, typically in "1x Product Name" format.'
    ),
});

export async function organizeList(input: OrganizeListInput): Promise<OrganizeResult> {
    const ai = getAi(input.apiKey);
    const selectedModel = input.modelName === 'gemini-1.5-pro-latest' ? gemini15Pro : gemini15Flash;

    const prompt = ai.definePrompt({
        name: 'organizeListPrompt',
        model: selectedModel,
        input: {schema: OrganizeListInputSchema},
        output: {schema: OrganizeResultSchema},
        prompt: `Você é um assistente de organização de dados. Sua tarefa é pegar uma lista de produtos em texto bruto e não estruturado e organizá-la de forma limpa.
        
        **LISTA BRUTA:**
        \`\`\`
        {{{productList}}}
        \`\`\`

        **REGRAS DE ORGANIZAÇÃO:**
        1.  **Um Item por Linha:** Cada produto distinto deve ocupar sua própria linha.
        2.  **Limpeza:** Remova qualquer texto desnecessário, saudações, ou formatação que não seja parte da descrição do produto (ex: "Bom dia, segue a lista:", "Att," etc.).
        3.  **Formato de Quantidade:** Se a quantidade for mencionada (ex: "2x", "02 ", "3un"), padronize para o formato "1x " no início da linha. Se nenhuma quantidade for mencionada, assuma 1 e adicione "1x " no início.
        
        **EXEMPLO DE ENTRADA:**
        \`\`\`
        Bom dia, segue a lista: 2x IPHONE 15 PRO MAX 256GB - AZUL, 01 POCO X6 5G 128GB/6GB RAM.
        SAMSUNG GALAXY S24 ULTRA 512GB - 5.100,00
        \`\`\`

        **EXEMPLO DE SAÍDA ESPERADA:**
        \`\`\`json
        {
            "organizedList": "2x IPHONE 15 PRO MAX 256GB - AZUL\n1x POCO X6 5G 128GB/6GB RAM\n1x SAMSUNG GALAXY S24 ULTRA 512GB - 5.100,00"
        }
        \`\`\`

        Apenas retorne o JSON com a chave 'organizedList' contendo a lista organizada.
        `,
    });
    
    const {output} = await prompt(input);
    return output!;
}

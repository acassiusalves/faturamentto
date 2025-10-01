
'use server';

/**
 * @fileOverview This file defines a Genkit flow for organizing a raw, unstructured product list.
 *
 * - organizeList - Takes a raw text blob and organizes it into a line-by-line list.
 * - OrganizeListInput - The input type for the organizeList function.
 * - OrganizeResult - The return type for the organizeList function.
 */

import {getAi} from '@/ai/genkit';
import {z} from 'genkit';
import type { OrganizeResult } from '@/lib/types';


const DEFAULT_ORGANIZE_PROMPT = `Você é um assistente de organização de dados especialista em listas de produtos de fornecedores. Sua tarefa é pegar uma lista de produtos em texto bruto, não estruturado e com múltiplas variações, e organizá-la de forma limpa e individualizada.

**LISTA BRUTA DO FORNECEDOR:**
'''
{{{productList}}}
'''

**REGRAS DE ORGANIZAÇÃO:**
1.  **Um Produto Por Linha:** A regra principal é identificar cada produto e suas variações. Se um item como "iPhone 13" tem duas cores (Azul e Preto) listadas, ele deve ser transformado em duas linhas separadas na saída.
2.  **Agrupamento por Variação:** Fique atento a padrões onde um item principal tem várias cores ou preços listados juntos. Crie uma linha separada para cada combinação de produto/variação.
3.  **Extração de Detalhes:** Para cada linha, extraia os detalhes que conseguir identificar: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor e Preço.
4.  **Limpeza Geral:** Remova qualquer informação desnecessária: saudações ("Bom dia"), emojis, formatação excessiva (ex: "---"), ou palavras de marketing que não são essenciais ("Qualidade Premium", "Oportunidade").
5.  **Formato de Quantidade:** Padronize a quantidade para o formato "1x " no início de cada linha. Se nenhuma quantidade for mencionada, assuma 1.

**EXEMPLO DE ENTRADA:**
'''
Bom dia! Segue a lista:
- 2x IPHONE 15 PRO MAX 256GB - AZUL/PRETO - 5.100,00
- SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00
- 1x POCO X6 5G 128GB/6GB RAM
'''

**EXEMPLO DE SAÍDA ESPERADA:**
'''json
{
    "organizedList": [
        "2x IPHONE 15 PRO MAX 256GB - AZUL - 5.100,00",
        "2x IPHONE 15 PRO MAX 256GB - PRETO - 5.100,00",
        "1x SAMSUNG GALAXY S24 ULTRA 512GB, 12GB RAM, cor Creme - 5.100,00",
        "1x POCO X6 5G 128GB/6GB RAM"
    ]
}
'''

Apenas retorne o JSON com a chave 'organizedList' contendo um array de strings, onde cada string é uma variação de produto em sua própria linha.
`;


const OrganizeListInputSchema = z.object({
  productList: z.string().describe('The raw, unstructured list of products to process.'),
  apiKey: z.string().optional(),
  prompt_override: z.string().optional(),
});
export type OrganizeListInput = z.infer<typeof OrganizeListInputSchema>;


const OrganizeResultSchema = z.object({
  organizedList: z
    .array(z.string())
    .describe(
      'An array of strings, where each string is a cleaned and organized product entry.'
    ),
});

export async function organizeList(input: OrganizeListInput): Promise<OrganizeResult> {
    const ai = getAi(input.apiKey);
    const model = 'googleai/gemini-2.0-flash';

    const prompt = ai.definePrompt({
        name: 'organizeListPrompt',
        model: model,
        input: {schema: OrganizeListInputSchema},
        output: {schema: OrganizeResultSchema},
        prompt: input.prompt_override || DEFAULT_ORGANIZE_PROMPT,
    });
    
    const {output} = await prompt(input);
    return output!;
}


'use server';

/**
 * @fileOverview This file defines a Genkit flow for standardizing an organized product list into a structured format.
 *
 * - standardizeList - Takes an organized text list and returns a more structured, standardized version.
 * - StandardizeListInput - The input type for the standardizeList function.
 * - StandardizeListOutput - The return type for the standardizeList function.
 */

import {getAi} from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import {z} from 'genkit';

const StandardizeListInputSchema = z.object({
  organizedList: z.string().describe('The organized, line-by-line list of products, including prices.'),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
});
export type StandardizeListInput = z.infer<typeof StandardizeListInputSchema>;

const UnprocessedItemSchema = z.object({
    line: z.string().describe('The original line item that could not be processed.'),
    reason: z.string().describe('The reason why the item could not be standardized.'),
});

const StandardizeListOutputSchema = z.object({
  standardizedList: z
    .array(z.string())
    .describe(
      'An array of strings, where each string is a fully standardized product line, including the price.'
    ),
  unprocessedItems: z.array(UnprocessedItemSchema).describe('A list of items that could not be standardized and the reason why.'),
});
export type StandardizeListOutput = z.infer<typeof StandardizeListOutputSchema>;

export async function standardizeList(input: StandardizeListInput): Promise<StandardizeListOutput> {
    const ai = getAi(input.apiKey);
    const selectedModel = input.modelName === 'gemini-1.5-pro-latest' ? gemini15Pro : gemini15Flash;

    const prompt = ai.definePrompt({
    name: 'standardizeListPrompt',
    model: selectedModel,
    input: {schema: StandardizeListInputSchema},
    output: {schema: StandardizeListOutputSchema},
    prompt: `Você é um especialista em padronização de dados de produtos.

    Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado, mantendo o preço.

    **LISTA ORGANIZADA PARA ANÁLISE:**
    \`\`\`
    {{{organizedList}}}
    \`\`\`

    **REGRAS DE PADRONIZAÇÃO:**
    1.  **Extraia e Reorganize os Componentes:** Para cada linha, extraia os componentes existentes: Marca, Modelo, Armazenamento, Memória RAM, Cor, Rede (se informado) e Preço. **NÃO adivinhe ou infira a marca.** Use apenas as palavras presentes no item.
    2.  **Ordem Estrita:** Reorganize os componentes de cada produto para seguir EXATAMENTE esta ordem, separados por um espaço:
        \`Marca Modelo Armazenamento Memoria Cor Rede Preço\`
    3.  **Memória RAM e Armazenamento:** Assegure que "GB" ou "TB" esteja associado ao armazenamento e que a memória RAM seja identificada corretamente (ex: 8GB RAM).
    4.  **Rede:** Se a rede (ex: 4G, 5G) não for mencionada, omita essa parte da estrutura, mas mantenha os outros campos.
    5.  **Preço:** O preço DEVE ser mantido no final de cada linha.
    6.  **Limpeza:** Remova qualquer informação extra que não se encaixe na estrutura (como "Americano A+").
    7.  **Itens Não Processados:** Se uma linha não puder ser padronizada (por exemplo, faltam informações essenciais como modelo ou preço, ou o formato é irreconhecível), adicione-a à lista 'unprocessedItems'. Para cada item, forneça a linha original e uma breve razão para a falha na padronização (ex: "Faltando preço", "Formato de memória RAM/ROM irreconhecível").

    **EXEMPLO DE ENTRADA:**
    \`\`\`
    1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00
    1x REDMI NOTE 14 PRO 4G 8GB/256GB - PRETO - 1.235,00
    1x Produto com defeito sem preço
    \`\`\`

    **EXEMPLO DE SAÍDA ESPERADA:**
    \`\`\`json
    {
        "standardizedList": [
            "iPhone 13 128GB 4GB RAM Rosa 5G 2.000,00",
            "Redmi Note 14 Pro 256GB 8GB RAM Preto 4G 1.235,00"
        ],
        "unprocessedItems": [
        {
            "line": "1x Produto com defeito sem preço",
            "reason": "Faltando preço"
        }
        ]
    }
    \`\`\`

    Execute a análise e gere a lista padronizada e a lista de itens não processados. A saída deve ser um JSON válido.\
    `,
    });

    const {output} = await prompt(input);
    return output!;
}

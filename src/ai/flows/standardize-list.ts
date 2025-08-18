
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

const DEFAULT_STANDARDIZE_PROMPT = `Você é um especialista em padronização de dados de produtos. Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado.

    **LISTA ORGANIZADA PARA ANÁLISE:**
    \`\`\`
    {{{organizedList}}}
    \`\`\`

    **REGRAS DE PADRONIZAÇÃO:**
    1.  **Extração de Componentes:** Para cada linha, identifique e extraia os seguintes dados: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor, Rede (4G/5G, se houver) e Preço. **Importante:** Não adivinhe a marca; use apenas o que está escrito no item.
    2.  **Ordem Estrita:** Reorganize os componentes extraídos para seguir EXATAMENTE esta ordem, separados por um espaço: \`Marca Modelo Armazenamento Global Memoria Cor Rede Preço\`.
    3.  **Formatação de Memória:** Garanta que "GB" ou "TB" esteja associado ao armazenamento e que a memória RAM seja identificada corretamente (ex: "8GB RAM"). Formatos como "8/256GB" significam "8GB RAM" e "256GB" de armazenamento.
    4.  **Omissão de Rede:** Se a conectividade (4G ou 5G) não for mencionada na linha original do produto, essa informação deve ser **omitida** da string final. Não assuma um valor padrão.
    5.  **Manutenção do Preço:** O preço DEVE ser mantido no final de cada linha padronizada.
    6.  **Limpeza de Dados:** Após a padronização, remova qualquer informação extra que não se encaixe na nova estrutura (por exemplo, "6/128GB", "Versão Global", "Americano A+") para limpar a descrição do produto.
    7.  **Tratamento de Erros:** Se uma linha não puder ser padronizada (por faltar informações essenciais como preço, ou se o formato for muito confuso), adicione-a à lista 'unprocessedItems' com uma breve justificativa (ex: "Faltando preço", "Formato de memória/armazenamento irreconhecível").

    **EXEMPLO DE ENTRADA:**
    \`\`\`
    1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00
    1x REDMI NOTE 14 PRO 5G 8/256GB - PRETO - 1.235,00
    1x Produto com defeito sem preço
    \`\`\`

    **EXEMPLO DE SAÍDA ESPERADA:**
    \`\`\`json
    {
        "standardizedList": [
            "iPhone 13 128GB Global 4GB RAM Rosa 2.000,00",
            "Redmi Note 14 Pro 256GB Global 8GB RAM Preto 5G 1.235,00"
        ],
        "unprocessedItems": [
        {
            "line": "1x Produto com defeito sem preço",
            "reason": "Faltando preço"
        }
        ]
    }
    \`\`\`

    Execute a análise e gere a lista padronizada e a lista de itens não processados. A saída deve ser um JSON válido.
    `;

const StandardizeListInputSchema = z.object({
  organizedList: z.string().describe('The organized, line-by-line list of products, including prices.'),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
  prompt_override: z.string().optional(),
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
    prompt: input.prompt_override || DEFAULT_STANDARDIZE_PROMPT,
    });

    const {output} = await prompt(input);
    return output!;
}

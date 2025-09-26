

'use server';

/**
 * @fileOverview This file defines a Genkit flow for standardizing an organized product list into a structured format.
 *
 * - standardizeList - Takes an organized text list and returns a more structured, standardized version.
 * - StandardizeListInput - The input type for the standardizeList function.
 * - StandardizeListOutput - The return type for the standardizeList function.
 */

import {getAi} from '@/ai/genkit';
import {z} from 'genkit';

const DEFAULT_STANDARDIZE_PROMPT = `Você é um especialista em padronização de dados de produtos. Sua tarefa é analisar a lista de produtos já organizada e reescrevê-la em um formato padronizado e estruturado, focando apenas em marcas específicas.

    **LISTA ORGANIZADA PARA ANÁLISE:**
    '''
    {{{organizedList}}}
    '''

    **REGRAS DE PADRONIZAÇÃO:**
    1.  **Foco em Marcas Principais:** Processe e padronize **APENAS** produtos que sejam claramente das marcas **Xiaomi, Realme, Motorola ou Samsung**.
    2.  **Ignorar Outras Marcas:** Se um produto não pertencer a uma das quatro marcas acima, ele deve ser adicionado à lista 'unprocessedItems' com o motivo "Marca não prioritária".
    3.  **Extração de Componentes:** Para cada linha de uma marca prioritária, identifique e extraia: Marca, Modelo, Armazenamento (ROM), Memória RAM, Cor, Rede (4G/5G, se houver) e Preço.
    4.  **Ordem Estrita:** Reorganize os componentes extraídos para seguir EXATAMENTE esta ordem: \`Marca Modelo Armazenamento Memoria Cor Rede Preço\`.
    5.  **Formatação de Memória:** Garanta que "GB" ou "TB" esteja associado ao armazenamento e que a memória RAM seja identificada (ex: "8GB RAM"). Formatos como "8/256GB" significam "8GB RAM" e "256GB" de armazenamento.
    6.  **Omissão de Rede:** Se a conectividade (4G ou 5G) não for mencionada na linha original, omita essa informação na saída. Não assuma um valor padrão. Se for mencionada, coloque-a apenas uma vez, antes do preço.
    7.  **Manutenção do Preço:** O preço DEVE ser mantido no final de cada linha padronizada.
    8.  **Limpeza de Dados:** Após a padronização, remova qualquer informação extra que não se encaixe na nova estrutura (por exemplo, "Versão Global", "Americano A+", "/") para limpar a descrição do produto.
    9.  **Tratamento de Erros:** Se uma linha (de uma marca prioritária) não puder ser padronizada por outro motivo (faltando preço, formato confuso), adicione-a à lista 'unprocessedItems' com uma breve justificativa.

    **EXEMPLO DE ENTRADA:**
    '''
    1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00
    1x REDMI NOTE 14 PRO 5G 8/256GB - PRETO - 1.235,00
    1x Produto com defeito sem preço
    1x SAMSUNG GALAXY S23 128GB PRETO 5G - 3500.00
    '''

    **EXEMPLO DE SAÍDA ESPERADA:**
    '''json
    {
        "standardizedList": [
            "Redmi Note 14 Pro 256GB 8GB RAM Preto 5G 1.235,00",
            "Samsung Galaxy S23 128GB 8GB RAM Preto 5G 3500.00"
        ],
        "unprocessedItems": [
        {
            "line": "1x IPHONE 13 128GB AMERICANO A+ - ROSA - 2.000,00",
            "reason": "Marca não prioritária"
        },
        {
            "line": "1x Produto com defeito sem preço",
            "reason": "Faltando preço"
        }
        ]
    }
    '''

    Execute a análise e gere a lista padronizada e a lista de itens não processados. A saída deve ser um JSON válido.
    `;

const StandardizeListInputSchema = z.object({
  organizedList: z.string().describe('The organized, line-by-line list of products, including prices.'),
  apiKey: z.string().optional(),
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

    const prompt = ai.definePrompt({
    name: 'standardizeListPrompt',
    model: 'googleai/gemini-2.0-flash',
    input: {schema: StandardizeListInputSchema},
    output: {schema: StandardizeListOutputSchema},
    prompt: input.prompt_override || DEFAULT_STANDARDIZE_PROMPT,
    });

    const {output} = await prompt(input);
    return output!;
}

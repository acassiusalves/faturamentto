
'use server';

/**
 * @fileOverview This file defines a Genkit flow for looking up standardized products in a database.
 *
 * - lookupProducts - Takes a standardized list and finds matching products in the database.
 */

import {getAi} from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import { LookupProductsInputSchema, type LookupProductsInput, LookupResultSchema, type LookupResult } from '@/lib/types';


const DEFAULT_LOOKUP_PROMPT = `Você é um sistema avançado de busca e organização para um e-commerce de celulares. Sua tarefa principal é converter CADA linha da 'Lista Padronizada' de entrada em um objeto JSON na saída, cruzando as informações com o 'Banco de Dados' para encontrar o SKU correto.

        **LISTA PADRONIZADA (Entrada para conversão):**
        '''
        {{{productList}}}
        '''

        **BANCO DE DADOS (Fonte para consulta de SKU):**
        '''
        {{{databaseList}}}
        '''

        **REGRAS DE PROCESSAMENTO E CONVERSÃO:**
        1.  **REGRA CRÍTICA - UM-PARA-UM:** Para CADA linha na 'Lista Padronizada' de entrada, você DEVE gerar exatamente um objeto JSON correspondente na saída. A contagem de itens na entrada e na saída (array 'details') deve ser IDÊNTICA. Não adicione, duplique ou omita itens.
        2.  **Correspondência Inteligente:** Para cada item na 'Lista Padronizada', encontre a correspondência mais próxima no 'Banco de Dados'.
        3.  **Foco nos Componentes-Chave:** Para a correspondência, priorize os seguintes componentes: **Modelo, RAM e Armazenamento**. Variações pequenas no nome (como "/") podem ser ignoradas se estes componentes forem idênticos.
        4.  **Regra de Conectividade Padrão:**
            *   Se a 'Lista Padronizada' não especificar "4G" ou "5G", assuma **4G** como padrão ao procurar no 'Banco de Dados'.
            *   Se houver dois produtos idênticos no 'Banco de Dados' (um 4G e outro 5G), e a lista de entrada não especificar, priorize a versão **4G**. A versão 5G só deve ser escolhida se "5G" estiver explicitamente na linha do produto de entrada.
        5.  **Extração de Preço:** O preço de custo (\`costPrice\`) deve ser o valor numérico extraído do final de cada linha da 'Lista Padronizada'. Mantenha o formato original do número (com pontos e vírgulas). O resultado para costPrice deve ser uma string. Exemplos: "R$ 1.234,56" se torna "1.234,56". "R$ 1.130" se torna "1.130". "R$ 545.00" se torna "545.00".
        6.  **Formato de Saída (JSON):** A saída deve ser um array de objetos JSON dentro da chave 'details'. Cada objeto deve conter:
            *   \`sku\`: O código do produto do 'Banco de Dados'. Se não houver uma correspondência com alta confiança, use a string **"SEM CÓDIGO"**.
            *   \`name\`: O nome completo e oficial do produto, **exatamente como está no 'Banco de Dados'**. Se não for encontrado, repita o nome original da 'Lista Padronizada'.
            *   \`costPrice\`: O preço de custo extraído como uma string, mantendo o formato original.
        
        **REGRAS DE ORGANIZAÇÃO DO RESULTADO FINAL:**
        1.  **Agrupamento por Marca:** Organize o array 'details' final agrupando os produtos por marca na seguinte ordem de prioridade: **Xiaomi, Realme, Motorola, Samsung**.
        2.  **Ignorar Outras Marcas:** Produtos de marcas que não sejam uma das quatro mencionadas acima devem ser completamente ignorados e não devem aparecer no resultado final.
        3.  **Itens "SEM CÓDIGO":** Todos os produtos para os quais não foi encontrado um SKU (ou seja, \`sku\` é "SEM CÓDIGO") devem ser movidos para o **final da lista**, após todas as marcas.

        **EXEMPLO DE SAÍDA ESPERADA:**
        '''json
        {
          "details": [
            { "sku": "#XMS12P256A", "name": "Xiaomi Mi 12S 256GB 8GB RAM 5G - Versão Global", "costPrice": "3.100,00" },
            { "sku": "#RMGTN256P", "name": "Realme GT Neo 256GB 12GB RAM 5G - Preto", "costPrice": "2.800" },
            { "sku": "#MTG2264A", "name": "Motorola Moto G22 64GB 4GB RAM 4G - Azul", "costPrice": "980.00" },
            { "sku": "#SMA53128V", "name": "Samsung Galaxy A53 128GB 8GB RAM 5G - Verde", "costPrice": "1500.00" },
            { "sku": "SEM CÓDIGO", "name": "Tablet Desconhecido 64GB 4GB RAM 4G", "costPrice": "630,00" }
          ]
        }
        '''
        
        **INSTRUÇÃO FINAL ABSOLUTA:** É absolutamente crítico que o JSON de saída seja VÁLIDO. Se a lista for muito longa e você não conseguir processar todos os itens, PARE antes de atingir seu limite de tokens. É MELHOR retornar uma lista JSON mais curta e VÁLIDA do que uma lista completa e QUEBRADA. Não termine a resposta no meio de um objeto JSON.

        Execute a conversão, aplique todas as regras de negócio e de organização, e gere o JSON final completo.
        `
export async function lookupProducts(input: LookupProductsInput): Promise<LookupResult> {
    const ai = getAi(input.apiKey);
    const selectedModel = input.modelName === 'gemini-1.5-pro-latest' ? gemini15Pro : gemini15Flash;

    const prompt = ai.definePrompt({
        name: 'lookupProductsPrompt',
        model: selectedModel,
        input: {schema: LookupProductsInputSchema},
        output: {schema: LookupResultSchema},
        prompt: input.prompt_override || DEFAULT_LOOKUP_PROMPT,
    });
    
    const {output} = await prompt({ productList: input.productList, databaseList: input.databaseList });
    return output!;
}

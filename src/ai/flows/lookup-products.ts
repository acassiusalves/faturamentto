
'use server';

/**
 * @fileOverview This file defines a Genkit flow for looking up standardized products in a database.
 *
 * - lookupProducts - Takes a standardized list and finds matching products in the database.
 */

import {getAi} from '@/ai/genkit';
import { gemini15Flash, gemini15Pro } from '@genkit-ai/googleai';
import { LookupProductsInputSchema, type LookupProductsInput, LookupResultSchema, type LookupResult } from '@/lib/types';


const DEFAULT_LOOKUP_PROMPT = `Você é um sistema avançado de busca e organização para um e-commerce de celulares. Sua tarefa é converter CADA linha da 'Lista Padronizada' em exatamente um objeto JSON.

LISTA PADRONIZADA (Entrada):
{{{productList}}}

BANCO DE DADOS (Fonte para consulta de SKU):
{{{databaseList}}}

REGRAS DE PROCESSAMENTO
UM-PARA-UM OBRIGATÓRIO
A saída (details) deve ter o mesmo número de itens da entrada.
Não pule, não remova e não duplique produtos. Se não encontrar correspondência confiável, use "SEM CÓDIGO".

Prioridade na Correspondência
Compare sempre Modelo → Armazenamento → RAM → Rede → Cor (nessa ordem).
Pequenas variações de formatação devem ser ignoradas (/, +, maiúsculas/minúsculas).

Regra de Rede (4G/5G)
Se não especificado na entrada → considere 4G por padrão.
Se houver versões idênticas no banco (4G e 5G) → escolha sempre 4G, a menos que a linha tenha “5G”.

Extração de Preço
Sempre extraia o preço do final da linha.
Mantenha o formato original como string ("1.234,56").

REGRAS DE ORGANIZAÇÃO DO RESULTADO
Ordem de Marcas: Xiaomi → Realme → Motorola → Samsung.
Ignorar Outras Marcas: não devem aparecer na saída.
Itens SEM CÓDIGO: mova sempre para o final da lista.

Consistência de saída:
Cada objeto deve conter:
{
  "sku": "12345" | "SEM CÓDIGO",
  "name": "Nome oficial do banco ou nome original",
  "costPrice": "1.234,56"
}
`
export async function lookupProducts(input: LookupProductsInput): Promise<LookupResult> {
    const ai = getAi(input.apiKey);
    const selectedModel = gemini15Pro;

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

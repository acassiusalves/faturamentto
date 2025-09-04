
'use server';

/**
 * @fileOverview An AI agent that refines a product search term for Mercado Livre.
 *
 * - refineSearchTerm - A function that takes product details and returns an optimized search query.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAppSettings } from '@/services/firestore';
import {
    RefineSearchTermInputSchema,
    RefineSearchTermOutputSchema,
    type RefineSearchTermInput,
    type RefineSearchTermOutput
} from '@/lib/types';


export async function refineSearchTerm(input: RefineSearchTermInput): Promise<RefineSearchTermOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('A chave de API do Gemini não está configurada no sistema.');
  }
  const ai = getAi(apiKey);
  
  const refineFlow = ai.defineFlow(
    {
      name: 'refineSearchTermFlow',
      inputSchema: RefineSearchTermInputSchema,
      outputSchema: RefineSearchTermOutputSchema,
    },
    async (flowInput) => {
        const prompt = ai.definePrompt({
          name: 'refineSearchTermPrompt',
          model: gemini15Flash,
          input: { schema: RefineSearchTermInputSchema },
          output: { schema: RefineSearchTermOutputSchema },
          prompt: `
            Você é um especialista em otimizar termos de busca para o Mercado Livre.
            Sua tarefa é criar um termo de busca curto e eficiente a partir dos detalhes do produto fornecido.

            Regras:
            1.  **Mantenha o essencial:** Mantenha a marca, o modelo e o tipo principal do produto (ex: "Caixa de som", "Teclado Gamer").
            2.  **Remova o supérfluo:** Remova detalhes genéricos e de marketing como "para PC/Notebook", "Smartphone", "6W", "RGB", "versão global", "multimídia", "sem fio", "Padrão Brasileiro", etc.
            3.  **Priorize o código:** O código do modelo (ex: "CS-C20", "BK-G800") é a parte mais importante.
            4.  **Seja direto:** O termo final deve ser o mais limpo e direto possível.

            Produto Original: '{{productName}}'
            {{#if productBrand}}Marca: '{{productBrand}}'{{/if}}
            {{#if productModel}}Modelo: '{{productModel}}'{{/if}}
            
            Exemplo 1 (CORRETO):
            - Entrada: "Caixa de som smart para PC/Notebook/Smartphone 6W EXBOM CS-C20"
            - Saída: "Caixa de som EXBOM CS-C20"

            Exemplo 2 (CORRETO):
            - Entrada: "Kit gaming teclado metal com mouse LED RGB ABNT2 Padrão Brasileiro EXBOM BK-G800"
            - Saída: "Teclado gamer EXBOM BK-G800"
            
            Exemplo 3 (ERRADO):
            - Entrada: "Caixa de som smart para PC/Notebook EXBOM CS-C54"
            - Saída: "EXBOM CS-C54" (Isto está errado. O tipo "Caixa de som" foi removido).
            - Correção: A saída deveria ser "Caixa de som EXBOM CS-C54".

            Gere o termo de busca otimizado e correto.
          `,
        });

        const { output } = await prompt(flowInput);
        return output!;
    }
  );
  
  return refineFlow(input);
}



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
            1.  Remova informações genéricas como "Caixa de som", "Kit", "para PC/Notebook", "Smartphone", "6W", "RGB", etc.
            2.  Mantenha a marca e o modelo, pois são essenciais.
            3.  Se houver um código de modelo (ex: "CS-C20"), ele é a parte mais importante.
            4.  O termo final deve ser o mais limpo e direto possível.

            Produto Original: '{{productName}}'
            {{#if productBrand}}Marca: '{{productBrand}}'{{/if}}
            {{#if productModel}}Modelo: '{{productModel}}'{{/if}}
            
            Exemplo:
            - Entrada: "Caixa de som smart para PC/Notebook/Smartphone 6W EXBOM CS-C20"
            - Saída: "EXBOM CS-C20"

            - Entrada: "Kit gaming teclado metal com mouse LED RGB ABNT2 Padrão Brasileiro EXBOM BK-G800"
            - Saída: "EXBOM BK-G800"
            
            Gere o termo de busca otimizado.
          `,
        });

        const { output } = await prompt(flowInput);
        return output!;
    }
  );
  
  return refineFlow(input);
}

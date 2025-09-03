
'use server';

/**
 * @fileOverview An AI agent that analyzes a PDF catalog.
 *
 * - analyzeCatalog - A function that handles the catalog analysis process.
 */

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { AnalyzeCatalogInputSchema, AnalyzeCatalogOutputSchema, type AnalyzeCatalogInput, type AnalyzeCatalogOutput } from '@/lib/types';


export async function analyzeCatalog(input: AnalyzeCatalogInput): Promise<AnalyzeCatalogOutput> {
  const settings = await import('@/services/firestore').then(m => m.loadAppSettings());
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('A chave de API do Gemini não está configurada no sistema.');
  }
  const ai = getAi(apiKey);
  
  const analyzeFlow = ai.defineFlow(
    {
      name: 'analyzeCatalogFlow',
      inputSchema: AnalyzeCatalogInputSchema,
      outputSchema: AnalyzeCatalogOutputSchema,
    },
    async (flowInput) => {
        const prompt = ai.definePrompt({
          name: 'analyzeCatalogPrompt',
          model: gemini15Flash,
          input: { schema: AnalyzeCatalogInputSchema },
          output: { schema: AnalyzeCatalogOutputSchema },
          prompt: `
            Você é um especialista em extrair informações de catálogos de produtos em PDF.
            Analise o texto abaixo, que foi extraído de um PDF, e identifique cada produto listado.

            Para cada produto, extraia as seguintes informações:
            - name: O nome completo do produto.
            - description: Uma breve descrição do produto, se disponível.
            - price: O preço do produto. Formate o preço como uma string com vírgula para decimais (ex: "1.299,00").
            - imageUrl: Se uma URL de imagem for mencionada, use-a. Caso contrário, deixe em branco.

            Ignore qualquer texto que não seja uma listagem de produto (ex: introduções, índices, informações de contato).

            Texto do PDF para análise:
            \`\`\`
            {{{pdfContent}}}
            \`\`\`
          `,
        });

        const { output } = await prompt(flowInput);
        return output!;
    }
  );
  
  return analyzeFlow(input);
}


'use server';

/**
 * @fileOverview An AI agent that analyzes a single page of a PDF catalog.
 *
 * - analyzeCatalog - A function that handles the catalog analysis process for one page.
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
      name: 'analyzeCatalogPageFlow',
      inputSchema: AnalyzeCatalogInputSchema,
      outputSchema: AnalyzeCatalogOutputSchema,
    },
    async (flowInput) => {
        const prompt = ai.definePrompt({
          name: 'analyzeCatalogPagePrompt',
          model: gemini15Flash,
          input: { schema: AnalyzeCatalogInputSchema },
          output: { schema: AnalyzeCatalogOutputSchema },
          prompt: `
            Você é um especialista em extrair informações de catálogos de produtos em PDF.
            Sua tarefa é analisar o texto da página {{pageNumber}} de um total de {{totalPages}} páginas.

            Para cada produto encontrado APENAS NESTA PÁGINA, extraia as seguintes informações:
            - name: O nome completo do produto.
            - model: O modelo específico do produto (ex: "Note 13 Pro", "Galaxy S24 Ultra", "Poco X6").
            - description: Uma breve descrição do produto, se disponível (incluindo cor, memória, etc.).
            - price: O preço do produto. Formate o preço como uma string com vírgula para decimais (ex: "1.299,00").
            - imageUrl: Se uma URL de imagem for mencionada, use-a. Caso contrário, deixe em branco.

            Ignore qualquer texto que não seja uma listagem de produto (ex: introduções, índices, informações de contato, cabeçalhos ou rodapés repetitivos).

            Texto da Página {{pageNumber}} para análise:
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

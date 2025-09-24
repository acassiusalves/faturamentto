
'use server';

import { getAi } from '@/ai/genkit';
import { textEmbeddingGecko } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAppSettings } from '@/services/firestore';

const GenerateEmbeddingInputSchema = z.object({
  texts: z.array(z.string()).describe('An array of texts to be converted into embeddings.'),
});

const GenerateEmbeddingOutputSchema = z.object({
  embeddings: z.array(z.array(z.number())).describe('An array of embeddings, one for each input text.'),
});

export type GenerateEmbeddingInput = z.infer<typeof GenerateEmbeddingInputSchema>;
export type GenerateEmbeddingOutput = z.infer<typeof GenerateEmbeddingOutputSchema>;

export async function generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('A chave de API do Gemini não está configurada no sistema.');
  }
  const ai = getAi(apiKey);
  
  const embeddingFlow = ai.defineFlow(
    {
      name: 'generateEmbeddingFlow',
      inputSchema: GenerateEmbeddingInputSchema,
      outputSchema: GenerateEmbeddingOutputSchema,
    },
    async (flowInput) => {
      // O modelo de embedding lida com um array de textos diretamente.
      const { output } = await ai.embed({
        model: textEmbeddingGecko,
        input: flowInput.texts,
      });

      return { embeddings: output };
    }
  );

  return embeddingFlow(input);
}

    
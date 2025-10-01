
import {genkit, type GenkitErrorCode} from 'genkit';
import {googleAI, type GoogleAIGeminiError} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
      googleAI(),
  ],
  model: 'googleai/gemini-2.0-flash',
});

// Helper function to get the AI instance, optionally with a user-provided API key.
export function getAi(apiKey?: string | null) {
  // Se a chave for fornecida, assumimos que é do Gemini.
  if (apiKey) {
    return genkit({
      plugins: [
        googleAI({
          apiKey: apiKey,
          // Optional: Add a client option to handle API key errors gracefully.
          client: {
            async generateContent(
              request: any
            ): Promise<any> {
              const {GoogleAIFileManager, GoogleGenerativeAI} = await import(
                '@google/generative-ai'
              );
              const client = new GoogleGenerativeAI(apiKey);
              try {
                // Remove o prefixo 'googleai/' se existir
                const modelName = request.model.replace('googleai/', '');
                
                return await client
                  .getGenerativeModel({model: modelName})
                  .generateContent(request);
              } catch (e: any) {
                if (e.message?.includes('API key not valid')) {
                  const err: GoogleAIGeminiError = new Error(
                    'The provided API key is not valid. Please check the key in the settings and try again.'
                  );
                  err.name = `[${'permission-denied' satisfies GenkitErrorCode}]`;
                  throw err;
                }
                throw e;
              }
            },
          },
        }),
      ],
    });
  }

  // Se nenhuma chave for fornecida, usa a instância global padrão.
  return ai;
}

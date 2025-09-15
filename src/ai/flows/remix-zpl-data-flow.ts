
'use server';

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { RemixZplDataInputSchema, RemixZplDataOutputSchema, type RemixZplDataInput, type RemixZplDataOutput } from '@/lib/types';
import { loadAppSettings } from '@/services/firestore';

export async function remixZplData(input: RemixZplDataInput): Promise<RemixZplDataOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('IA não configurada: defina a chave do Gemini na página Mapeamento.');
  }
  const ai = getAi(apiKey);
  
  const prompt = ai.definePrompt({
    name: 'remixZplDataPrompt',
    model: gemini15Flash,
    input: { schema: RemixZplDataInputSchema },
    output: { schema: RemixZplDataOutputSchema },
    prompt: `
You are a ZPL expert. Modify the label in an anchored way.

MATCH MODE: "{{{matchMode}}}"
TOLERANCE_PX = 12

RULES:
1) CRITICAL: text in ZPL is hex-encoded with underscore prefix (e.g., "PHONEART" => "_50_48_4f_4e_45_41_52_54"). Convert baseline plain text to this format to find the correct ^FD.
2) Never change barcode blocks (^BC, ^B3, ^BQN, etc.).
3) Text block shape: ^FOx,y, ^A*, ^FD<content>^FS.
4) If a field in "remixedData" is empty (""), delete the entire block (^FO...^FS) for that field.
5) If a field changed, update the corresponding ^FD with the new value, hex-encoded.
6) Keep all other commands untouched. Ensure ^CI28 appears right after ^XA.

Return ONLY valid JSON with this exact shape:
{"modifiedZpl": "<FINAL_ZPL_WITHOUT_BACKTICKS>"}

Original ZPL:
{{{originalZpl}}}

Baseline values (plain text):
{{{json baselineData}}}

New values (plain text):
{{{json remixedData}}}
`.trim(),
  });

  const remixZplDataFlow = ai.defineFlow(
    {
      name: 'remixZplDataFlow',
      inputSchema: RemixZplDataInputSchema,
      outputSchema: RemixZplDataOutputSchema,
    },
    async (flowInput) => {
      const { output } = await prompt(flowInput);
      if (!output?.modifiedZpl) {
        throw new Error('A IA não retornou "modifiedZpl".');
      }
      return output;
    }
  );

  return remixZplDataFlow(input);
}

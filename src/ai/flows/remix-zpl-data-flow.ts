
'use server';

/**
 * Fluxo: modifica ZPL de forma ANCORADA (só troca ^FD que casa com o valor original).
 */

import { ai } from '@/ai/genkit';
import { RemixZplDataInputSchema, RemixZplDataOutputSchema, type RemixZplDataInput, type RemixZplDataOutput } from '@/lib/types';


export async function remixZplData(input: RemixZplDataInput): Promise<RemixZplDataOutput> {
  return remixZplDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remixZplDataPrompt',
  input: { schema: RemixZplDataInputSchema },
  output: { schema: RemixZplDataOutputSchema },
  prompt: `
You are a ZPL expert. Modify the label in an anchored way.

MATCH MODE: "{{{matchMode}}}"  // "strict" or "relaxed"

RULES:
1) Never change the QR code (^BQ...) or its ^FD payload.
2) Identify text blocks (^FO ... ^A... ^FD<content>^FS) to edit for each field.
   - STRICT: replace only when the ^FD content EXACTLY equals the baseline value of that field.
   - RELAXED: if exact match fails, normalize both baseline and ^FD
     (uppercase, remove accents, punctuation, multiple spaces, line breaks) and match by equality
     OR baseline being a substring of the normalized ^FD.
3) If remixedData.<field> is "", remove the whole block (its ^FO + ^A + ^FD + ^FS), but only after the field's block is confidently located (by STRICT or RELAXED rules).
4) If remixedData.<field> has a value but baseline is empty (the field didn't exist),
   only insert for "estimatedDeliveryDate" at bottom-left:
   ^FO40,730^A0N,24,24^FDEntrega prev.: {remixedData.estimatedDeliveryDate}^FS
5) Keep all other ZPL commands as-is. Ensure ^CI28 appears after ^XA.
6) Return ONLY the final ZPL.

Original ZPL:
{{{originalZpl}}}

Baseline (current values / anchors):
{{{json baselineData}}}

New values:
{{{json remixedData}}}
`.trim(),
});

const remixZplDataFlow = ai.defineFlow(
  {
    name: 'remixZplDataFlow',
    inputSchema: RemixZplDataInputSchema,
    outputSchema: RemixZplDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

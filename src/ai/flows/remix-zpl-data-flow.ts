
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
You are a ZPL expert. Modify the label in a strictly anchored way.

RULES (very important):
1) NEVER change the QR code block (^BQ...) or its ^FD payload.
2) Only edit text blocks that you can confidently anchor by the current text value found in "baselineData".
   - A typical text block is: ^FOx,y ^A... ^FD<content>^FS
   - Replace ONLY the ^FD content that EXACTLY matches the baseline value for that field.
   - Do NOT move, reorder or change ^FO coordinates or ^A fonts.
3) If remixedData.<field> is "", remove the WHOLE block of that field (its ^FO + ^A + ^FD + ^FS). Removal is allowed only if you matched the baseline text to locate the correct block.
4) If remixedData.<field> has a value but the baseline value is empty (i.e., that field didn't exist on the label),
   insert a NEW block at a safe fixed position:
   - For "estimatedDeliveryDate": place near bottom-left:
     ^FO40,730^A0N,24,24^FDEntrega prev.: {remixedData.estimatedDeliveryDate}^FS
   - For others that don't exist, DO NOT invent positions; leave them unchanged (skip).
5) Keep ALL other ZPL commands exactly as-is (lines ^GB, etc.).
6) Ensure ^CI28 is present right after ^XA (UTF-8). If not, add it.
7) Output ONLY the final ZPL (no backticks, no extra commentary).

Original ZPL:
{{{originalZpl}}}

Anchors (baselineData):
{{{json baselineData}}}

New values (remixedData):
{{{json remixedData}}}

Now return the final "modifiedZpl".
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

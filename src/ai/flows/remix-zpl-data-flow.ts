
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
TOLERANCE_PX = 12

RULES:
1) NEVER change any block that contains a barcode command:
   lines with ^B* (e.g. ^BC, ^B3, ^BQN, ^B128, ^BY etc) within the last 6 lines above the ^FD are barcodes.
   Also never touch the QR (^BQ...).
2) A text block to edit must have this shape:
   ^FOx,y or ^FTx,y
   (optional ^A* / ^FB*)
   ^FD<content>^FS
3) Primary anchor = coordinates. For each field, if "baselinePositions.<field>" exists,
   only edit the block whose ^FO/^FT is within ±TOLERANCE_PX of that (x,y).
4. **Critical Instruction**: If a field in 'remixedData' is an empty string (""), you MUST find the corresponding ZPL command (usually a line containing ^FD followed by the old data) and completely remove the information. The best approach is to delete the entire ZPL command block (from ^FO... to ^FS) related to that field so that it is not printed on the label.
5) If remixedData.<field> has value but the field didn't exist (baseline empty), ONLY insert for "estimatedDeliveryDate" at:
   ^FO40,730^A0N,24,24^FDEntrega prev.: {remixedData.estimatedDeliveryDate}^FS
6) Keep every other ZPL command untouched. Ensure ^CI28 appears right after ^XA (add if missing).
7) Output ONLY the final ZPL (no comments, no backticks).

Original ZPL:
{{{originalZpl}}}

Baseline values:
{{{json baselineData}}}

Baseline positions (if any):
{{{json baselinePositions}}}

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

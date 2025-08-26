
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

MATCH MODE: "{{{matchMode}}}"
TOLERANCE_PX = 12

RULES:
1) **CRITICAL DATA ENCODING RULE: The text data in the ZPL file is hex-encoded. For example, the string "PHONEART" appears in the ZPL as "_50_48_4f_4e_45_41_52_54". Before you search for a value from 'baselineData' inside the 'originalZpl', you MUST convert the baselineData value to this underscore-prefixed hex format to find the correct ^FD command.**
2) NEVER change any block that contains a barcode command (^BC, ^B3, ^BQN, etc.).
3) A text block to edit has the shape: ^FOx,y, ^A*, ^FD<content>^FS.
4) If a field in 'remixedData' is an empty string (""), you MUST delete the entire ZPL command block for that field (from its ^FO... to its ^FS).
5) If a field in 'remixedData' has a new value, update the content inside the corresponding ^FD command, ensuring the new value is also properly hex-encoded.
6) Keep every other ZPL command untouched. Ensure ^CI28 appears right after ^XA.
7) Output ONLY the final ZPL (no comments, no backticks).

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
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

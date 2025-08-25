
'use server';

/**
 * @fileOverview An AI agent that modifies shipping label data.
 *
 * - remixLabelData - A function that takes original label data and returns modified data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { RemixLabelDataInput, RemixLabelDataOutput } from '@/app/actions';

// Schemas are defined in the action file. We only need the types here.
const RemixLabelDataInputSchema = z.object({
  fieldToRemix: z.enum(['orderNumber', 'invoiceNumber', 'trackingNumber', 'senderName', 'senderAddress']),
  originalValue: z.string(),
});

const RemixLabelDataOutputSchema = z.object({
  newValue: z.string().describe("The new, remixed value for the requested field."),
});


export async function remixLabelData(
  input: RemixLabelDataInput
): Promise<RemixLabelDataOutput> {
  return remixLabelDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remixLabelDataPrompt',
  input: { schema: RemixLabelDataInputSchema },
  output: { schema: RemixLabelDataOutputSchema },
  prompt: `You are a creative AI that generates modified data for shipping labels based on a specific field.
  Follow these instructions precisely based on the 'fieldToRemix':

  - If 'fieldToRemix' is 'orderNumber', 'invoiceNumber', or 'trackingNumber': Generate a new random number that has the exact same number of characters and format (including hyphens or other symbols) as the 'originalValue' ('{{{originalValue}}}').
  - If 'fieldToRemix' is 'senderName': Generate a new, plausible, but fake store/company name that has a similar character count to the 'originalValue' ('{{{originalValue}}}').
  - If 'fieldToRemix' is 'senderAddress': Set the value to the fixed string 'RUA DA ALFÂNDEGA, 200'.

  Return ONLY the 'newValue' in the specified JSON format.
  `,
});

const remixLabelDataFlow = ai.defineFlow(
  {
    name: 'remixLabelDataFlow',
    inputSchema: RemixLabelDataInputSchema,
    outputSchema: RemixLabelDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

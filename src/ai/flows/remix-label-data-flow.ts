
'use server';

/**
 * @fileOverview An AI agent that modifies shipping label data.
 *
 * - remixLabelData - A function that takes original label data and returns modified data.
 * - RemixLabelDataInput - The input type for the remixLabelData function.
 * - RemixLabelDataOutput - The return type for the remixLabelData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeLabelOutput } from './analyze-label-flow';

export const RemixLabelDataInputSchema = z.object({
  orderNumber: z.string(),
  invoiceNumber: z.string(),
  senderName: z.string(),
});
export type RemixLabelDataInput = z.infer<typeof RemixLabelDataInputSchema>;

// The output will only contain the modified fields.
export const RemixLabelDataOutputSchema = z.object({
  orderNumber: z.string().describe("A new, randomly generated number with the same character count as the original order number."),
  invoiceNumber: z.string().describe("A new, randomly generated number with the same character count as the original invoice number."),
  senderName: z.string().describe("A new, randomly generated store name with the same character count as the original sender name."),
  senderAddress: z.string().describe("The fixed address 'RUA DA ALFÂNDEGA, 200'."),
});
export type RemixLabelDataOutput = z.infer<typeof RemixLabelDataOutputSchema>;


export async function remixLabelData(
  input: RemixLabelDataInput
): Promise<RemixLabelDataOutput> {
  return remixLabelDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remixLabelDataPrompt',
  input: { schema: RemixLabelDataInputSchema },
  output: { schema: RemixLabelDataOutputSchema },
  prompt: `You are a creative AI that generates modified data for shipping labels based on original data.
  Follow these instructions precisely:

  1.  **orderNumber**: Generate a new random number that has the exact same number of characters as the original '{{{orderNumber}}}'.
  2.  **invoiceNumber**: Generate a new random number that has the exact same number of characters as the original '{{{invoiceNumber}}}'.
  3.  **senderName**: Generate a new, plausible, but fake store/company name that has the exact same number of characters as the original '{{{senderName}}}'.
  4.  **senderAddress**: Set this value to the fixed string 'RUA DA ALFÂNDEGA, 200'.

  Return ONLY the modified data in the specified JSON format.
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

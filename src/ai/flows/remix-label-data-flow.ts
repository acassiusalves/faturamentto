
'use server';

/**
 * @fileOverview An AI agent that modifies shipping label data.
 *
 * - remixLabelData - A function that takes original label data and returns modified data.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import type { RemixLabelDataInput, RemixLabelDataOutput } from '@/lib/types';
import { gemini15Flash } from '@genkit-ai/googleai';

// Schemas are defined in the action file. We only need the types here.
const RemixLabelDataInputSchema = z.object({
  fieldToRemix: z.enum(['orderNumber', 'invoiceNumber', 'trackingNumber', 'senderName', 'senderAddress']),
  originalValue: z.string(),
  apiKey: z.string().optional(),
});

const RemixLabelDataOutputSchema = z.object({
  newValue: z.string().describe("The new, remixed value for the requested field."),
});


export async function remixLabelData(
  input: RemixLabelDataInput
): Promise<RemixLabelDataOutput> {
  const ai = getAi(input.apiKey);
  
  const remixLabelDataFlow = ai.defineFlow(
    {
      name: 'remixLabelDataFlow',
      inputSchema: RemixLabelDataInputSchema,
      outputSchema: RemixLabelDataOutputSchema,
    },
    async (flowInput) => {
      const flowPrompt = ai.definePrompt({
          name: 'remixLabelDataPrompt',
          input: { schema: RemixLabelDataInputSchema },
          output: { schema: RemixLabelDataOutputSchema },
          model: gemini15Flash, // Specify the model to be used
          prompt: `You are a creative AI that generates modified data for shipping labels based on a specific field.
          Your task is to generate a new value for the field specified in 'fieldToRemix'.

          The current value for the field '{{{fieldToRemix}}}' is '{{{originalValue}}}'.

          Follow these instructions precisely:

          - If 'fieldToRemix' is 'orderNumber', 'invoiceNumber', or 'trackingNumber': Generate a new random number that has the exact same number of characters and format as the 'originalValue'.
          - If 'fieldToRemix' is 'senderName': Generate a new, plausible, but fake store/company name.
          - If 'fieldToRemix' is 'senderAddress': Set the 'newValue' to the fixed string 'RUA DA ALFÂNDEGA, 200'.

          Return ONLY the 'newValue' in the specified JSON format. Do not add any other text.
          `,
      });
      const { output } = await flowPrompt(flowInput);
      return output!;
    }
  );

  return remixLabelDataFlow(input);
}


'use server';

/**
 * @fileOverview An AI agent that modifies ZPL shipping label data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { RemixZplDataInput, RemixZplDataOutput } from '@/app/actions';

// Schemas will be defined in the action file to avoid exporting non-functions from a 'use server' file.
// We still need to import the types for the function signature.
const RemixZplDataInputSchema = z.object({
  originalZpl: z.string().describe("The original, complete ZPL code of the shipping label."),
  remixedData: z.object({
    recipientName: z.string(),
    streetAddress: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    orderNumber: z.string(),
    invoiceNumber: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
  }).describe("The new, modified data that should be placed on the label."),
});

const RemixZplDataOutputSchema = z.object({
  modifiedZpl: z.string().describe("The new, complete ZPL code with the modified data, with the original QR code data preserved."),
});


export async function remixZplData(
  input: RemixZplDataInput
): Promise<RemixZplDataOutput> {
  return remixZplDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'remixZplDataPrompt',
  input: { schema: RemixZplDataInputSchema },
  output: { schema: RemixZplDataOutputSchema },
  prompt: `You are an expert in ZPL (Zebra Programming Language). Your task is to modify an existing ZPL shipping label with new data.

  **IMPORTANT RULES:**
  1.  You MUST identify and preserve the original QR code command block (\`^BQ,...\`) and its associated data (\`^FD...\`) completely untouched. The QR code data is critical and cannot be changed.
  2.  For all other text fields (like recipient, sender, order number, invoice number, etc.), you must find their corresponding \`^FD\` commands and replace the text content with the new data provided in \`remixedData\`.
  3.  All other ZPL commands for positioning (\`^FO\`), fonts (\`^A0\`), lines (\`^GB\`), etc., must be kept exactly as they are in the original ZPL.
  4.  The output must be a single, complete, and valid ZPL string.

  **Original ZPL Code:**
  \`\`\`zpl
  {{{originalZpl}}}
  \`\`\`

  **New Data to Insert:**
  \`\`\`json
  {{{json remixedData}}}
  \`\`\`

  Now, generate the final \`modifiedZpl\` code.
  `,
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

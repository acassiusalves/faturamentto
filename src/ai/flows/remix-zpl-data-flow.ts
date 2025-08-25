
'use server';

/**
 * @fileOverview An AI agent that modifies ZPL shipping label data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { RemixZplDataInput, RemixZplDataOutput } from '@/app/actions';

// Schemas are defined in the action file.
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
    estimatedDeliveryDate: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
    trackingNumber: z.string(),
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
  3.  **If a field in \`remixedData\` is an empty string, you must remove the corresponding \`^FD\` command AND its associated positioning command (\`^FO...\`) and font command (\`^A0N,...\` or similar) from the ZPL entirely.** A field is typically represented by a block of commands like \`^FOx,y^A0N,h,w^FDtext^FS\`. The entire block for that field must be removed.
  4.  All other ZPL commands for lines (\`^GB\`), etc., must be kept exactly as they are in the original ZPL.
  5.  The output must be a single, complete, and valid ZPL string.

  **Original ZPL Code:**
  \`\`\`zpl
  {{{originalZpl}}}
  \`\`\`

  **New Data to Insert (empty strings mean the field and its related commands should be removed):**
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

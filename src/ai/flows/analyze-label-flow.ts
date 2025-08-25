
'use server';

/**
 * @fileOverview An AI agent that analyzes a shipping label image.
 *
 * - analyzeLabel - A function that handles the label analysis process.
 * - AnalyzeLabelInput - The input type for the analyzeLabel function.
 * - AnalyzeLabelOutput - The return type for the analyzeLabel function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeLabelInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a shipping label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeLabelInput = z.infer<typeof AnalyzeLabelInputSchema>;

const AnalyzeLabelOutputSchema = z.object({
  recipientName: z.string().describe('The name of the recipient (DESTINATÁRIO).'),
  streetAddress: z.string().describe('The full street address of the recipient, including number and any complements.'),
  city: z.string().describe('The city of the recipient.'),
  state: z.string().describe('The state (UF) of the recipient.'),
  zipCode: z.string().describe('The ZIP code (CEP) of the recipient.'),
  orderNumber: z.string().describe('The order number (Pedido).'),
  invoiceNumber: z.string().describe('The invoice number (Nota Fiscal).'),
  estimatedDeliveryDate: z.string().describe('The estimated delivery date (Data estimada).'),
  trackingNumber: z.string().describe('The barcode number, usually located vertically next to the barcode.'),
  senderName: z.string().describe('The name of the sender (REMETENTE).'),
  senderAddress: z.string().describe('The full address of the sender.'),
});
export type AnalyzeLabelOutput = z.infer<typeof AnalyzeLabelOutputSchema>;


export async function analyzeLabel(
  input: AnalyzeLabelInput
): Promise<AnalyzeLabelOutput> {
  return analyzeLabelFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeLabelPrompt',
  input: { schema: AnalyzeLabelInputSchema },
  output: { schema: AnalyzeLabelOutputSchema },
  prompt: `You are an expert in reading and extracting information from Brazilian shipping labels.

  Analyze the provided image of a shipping label and extract the following information. Be precise and return only the requested data in the specified format.

  Image to analyze: {{media url=photoDataUri}}
  `,
});

const analyzeLabelFlow = ai.defineFlow(
  {
    name: 'analyzeLabelFlow',
    inputSchema: AnalyzeLabelInputSchema,
    outputSchema: AnalyzeLabelOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

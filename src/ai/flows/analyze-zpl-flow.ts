
'use server';

/**
 * @fileOverview An AI agent that analyzes ZPL (Zebra Programming Language) shipping label content.
 *
 * - analyzeZpl - A function that handles the ZPL content analysis process.
 * - AnalyzeZplInput - The input type for the analyzeZpl function.
 * - AnalyzeLabelOutput - The return type for the analyzeZpl function.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeLabelOutput } from '@/lib/types';
import { loadAppSettings } from '@/services/firestore';
import { gemini15Flash } from '@genkit-ai/googleai';

const AnalyzeLabelOutputSchema = z.object({
  recipientName: z.string().describe('The name of the recipient (DESTINATÁRIO).'),
  streetAddress: z.string().describe('The full street address of the recipient, including number and any complements.'),
  city: z.string().describe('The city of the recipient.'),
  state: z.string().describe('The state (UF) of the recipient.'),
  zipCode: z.string().describe('The ZIP code (CEP) of the recipient.'),
  orderNumber: z.string().describe('The order number (Pedido).'),
  invoiceNumber: z.string().describe('The invoice number (Nota Fiscal).'),
  estimatedDeliveryDate: z.string().describe('The estimated delivery date (Data estimada).'),
  trackingNumber: z.string().describe('The barcode number. In ZPL, this is often the data for the ^BC (Code 128) command.'),
  senderName: z.string().describe('The name of the sender (REMETENTE).'),
  senderAddress: z.string().describe('The full address of the sender.'),
});

const AnalyzeZplInputSchema = z.object({
  zplContent: z
    .string()
    .describe(
      "The raw ZPL text content of a shipping label."
    ),
});
export type AnalyzeZplInput = z.infer<typeof AnalyzeZplInputSchema>;


export async function analyzeZpl(
  input: AnalyzeZplInput
): Promise<AnalyzeLabelOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
      throw new Error("A chave de API do Gemini não está configurada no sistema.");
  }
  const ai = getAi(apiKey);

  const prompt = ai.definePrompt({
    name: 'analyzeZplPrompt',
    input: { schema: AnalyzeZplInputSchema },
    output: { schema: AnalyzeLabelOutputSchema },
    model: gemini15Flash, // Specify the model to be used
    prompt: `You are an expert in reading and extracting information from Brazilian shipping labels written in ZPL (Zebra Programming Language).

    Analyze the provided ZPL content and extract the following information. Be precise and return only the requested data in the specified JSON format. The ^FD command in ZPL defines a data field. Look for keywords like "DESTINATÁRIO", "REMETENTE", "Pedido", "Nota Fiscal", "Data estimada", "CEP", etc. near the ^FD commands to identify the correct information. The address is often split across multiple lines.
    
    The main barcode number (tracking number) is often the data for the ^BC (Code 128) command. Extract it.

    CRITICAL INSTRUCTION: When you find a field like the sender's name (REMETENTE), extract ONLY the text content inside the ^FD command. For example, if you find '^FDLA LIGHTHOUSE^FS', the extracted 'senderName' must be 'LIGHTHOUSE', not 'LIGHTHOUSE-1' or any other variation.

    ZPL Content to analyze: 
    \`\`\`zpl
    {{{zplContent}}}
    \`\`\`
    `,
  });

  const analyzeZplFlow = ai.defineFlow(
    {
      name: 'analyzeZplFlow',
      inputSchema: AnalyzeZplInputSchema,
      outputSchema: z.custom<AnalyzeLabelOutput>(),
    },
    async (flowInput) => {
      const { output } = await prompt(flowInput);
      return output!;
    }
  );

  return analyzeZplFlow(input);
}

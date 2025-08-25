
'use server';

/**
 * @fileOverview An AI agent that analyzes ZPL (Zebra Programming Language) shipping label content.
 *
 * - analyzeZpl - A function that handles the ZPL content analysis process.
 * - AnalyzeZplInput - The input type for the analyzeZpl function.
 * - AnalyzeLabelOutput - The return type for the analyzeZpl function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeLabelOutput } from './analyze-label-flow';
import { AnalyzeLabelOutputSchema } from './analyze-label-flow';

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
  return analyzeZplFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeZplPrompt',
  input: { schema: AnalyzeZplInputSchema },
  output: { schema: AnalyzeLabelOutputSchema },
  prompt: `You are an expert in reading and extracting information from Brazilian shipping labels written in ZPL (Zebra Programming Language).

  Analyze the provided ZPL content and extract the following information. Be precise and return only the requested data in the specified JSON format. The ^FD command in ZPL defines a data field. Look for keywords like "DESTINATÁRIO", "REMETENTE", "Pedido", "Nota Fiscal", "CEP", etc. near the ^FD commands to identify the correct information. The address is often split across multiple lines.

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
    outputSchema: AnalyzeLabelOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

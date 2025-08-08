'use server';

/**
 * @fileOverview An AI agent that suggests cost categories based on transaction data.
 *
 * - suggestCostCategory - A function that handles the cost category suggestion process.
 * - SuggestCostCategoryInput - The input type for the suggestCostCategory function.
 * - SuggestCostCategoryOutput - The return type for the suggestCostCategory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCostCategoryInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the transaction for which to suggest a cost category.'),
  availableCategories: z
    .array(z.string())
    .describe('The list of available cost categories.'),
});
export type SuggestCostCategoryInput = z.infer<typeof SuggestCostCategoryInputSchema>;

const SuggestCostCategoryOutputSchema = z.object({
  suggestedCategory: z
    .string()
    .describe('The suggested cost category for the transaction.'),
  confidenceScore: z
    .number()
    .describe('A score between 0 and 1 indicating the confidence in the suggested category.'),
});
export type SuggestCostCategoryOutput = z.infer<typeof SuggestCostCategoryOutputSchema>;

export async function suggestCostCategory(
  input: SuggestCostCategoryInput
): Promise<SuggestCostCategoryOutput> {
  return suggestCostCategoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCostCategoryPrompt',
  input: {schema: SuggestCostCategoryInputSchema},
  output: {schema: SuggestCostCategoryOutputSchema},
  prompt: `You are an expert in categorizing transaction costs for marketplace sales.

  Given the following transaction description and available cost categories, suggest the most appropriate cost category.
  Also provide a confidence score between 0 and 1 indicating your confidence in the suggestion.

  Transaction Description: {{{transactionDescription}}}
  Available Cost Categories: {{#each availableCategories}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Consider factors such as the nature of the transaction, the goods or services involved, and common cost types associated with marketplace sales.
  The confidence score should reflect the certainty of your suggestion based on the available information. A score of 1 indicates very high confidence, while a score closer to 0 indicates low confidence.
  `,
});

const suggestCostCategoryFlow = ai.defineFlow(
  {
    name: 'suggestCostCategoryFlow',
    inputSchema: SuggestCostCategoryInputSchema,
    outputSchema: SuggestCostCategoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

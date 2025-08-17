'use server';

/**
 * @fileOverview An AI agent that processes raw product lists into a structured format.
 *
 * - processListPipeline - A function that orchestrates the entire list processing pipeline.
 * - ProcessListPipelineInput - The input type for the pipeline.
 * - PipelineResult - The output type for the pipeline.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {PipelineResult} from '@/lib/types';

const ProcessListPipelineInputSchema = z.object({
  productList: z.string().describe('The raw, unstructured list of products to process.'),
  databaseList: z
    .string()
    .describe(
      'The list of available products in the database, formatted as "Product Name\\tSKU" per line.'
    ),
});
export type ProcessListPipelineInput = z.infer<typeof ProcessListPipelineInputSchema>;

const PipelineResultSchema = z.object({
  organizedList: z
    .string()
    .describe(
      'The cleaned and organized list, with each product on a new line, typically in "1x Product Name" format.'
    ),
  standardizedList: z
    .string()
    .describe(
      'The list standardized into a "Product Name | Quantity" format per line.'
    ),
  details: z
    .array(
      z.object({
        name: z.string().describe('The full name of the product.'),
        sku: z.string().describe('The corresponding SKU from the database.'),
        quantity: z.string().describe('The quantity of the product.'),
        unitPrice: z.string().describe('The unit price of the product.'),
        totalPrice: z.string().describe('The total price for the quantity.'),
      })
    )
    .describe(
      'A structured array of the final product details after matching with the database.'
    ),
  finalFormattedList: z
    .string()
    .describe(
      'The final output formatted as a string with columns (Name, SKU, Quantity, Unit Price, Total Price) separated by tabs.'
    ),
  unprocessedItems: z
    .array(
      z.object({
        line: z.string().describe('The original line that could not be processed.'),
        reason: z.string().describe('The reason for the processing failure.'),
      })
    )
    .describe(
      'A list of items from the original list that could not be processed, along with the reason.'
    ),
});

export async function processListPipeline(
  input: ProcessListPipelineInput
): Promise<PipelineResult> {
  return processListPipelineFlow(input);
}

const pipelinePrompt = ai.definePrompt({
  name: 'processListPipelinePrompt',
  input: {schema: ProcessListPipelineInputSchema},
  output: {schema: PipelineResultSchema},
  prompt: `You are an expert system for processing product purchase lists for a cellphone store.
Your task is to take a raw product list, clean it, standardize it, and then look up the products in the provided database list to find their SKUs and format a final output.

Follow these steps precisely:

1.  **Organize List**: Take the 'Raw Product List' and clean it up. Standardize the format so each item is on its own line, prefixed with its quantity (e.g., "1x Product Name"). This becomes the 'organizedList'.

2.  **Standardize List**: Convert the 'organizedList' into a machine-readable format: "Product Name | Quantity" for each line. If you cannot determine the product name or quantity for a line, add it to the 'unprocessedItems' list with a clear reason (e.g., "Formato inválido", "Produto não reconhecido"). This becomes the 'standardizedList'.

3.  **Lookup and Final Formatting**:
    *   For each line in the 'standardizedList', find the corresponding product in the 'Database Product List'. The database is formatted as "Product Name\\tSKU".
    *   Use the product name to find the correct SKU.
    *   Create a final structured list ('details') with the following fields: 'name', 'sku', 'quantity', 'unitPrice', 'totalPrice'.
    *   For 'unitPrice' and 'totalPrice', you must assign the value 'R$ 0,00' as prices are not provided.
    *   Also, create a string version of this final list ('finalFormattedList'), with each field separated by a tab character (\\t) and each product on a new line.

**Input Data:**

**Raw Product List:**
\`\`\`
{{{productList}}}
\`\`\`

**Database Product List (Name\\tSKU):**
\`\`\`
{{{databaseList}}}
\`\`\`

Perform all steps and provide the full JSON output as defined in the output schema.
`,
});

const processListPipelineFlow = ai.defineFlow(
  {
    name: 'processListPipelineFlow',
    inputSchema: ProcessListPipelineInputSchema,
    outputSchema: PipelineResultSchema,
  },
  async input => {
    const {output} = await pipelinePrompt(input);
    return output!;
  }
);

'use server';

import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAppSettings } from '@/services/firestore';

const RegenerateZplInputSchema = z.object({
  originalZpl: z.string().describe('O ZPL original para usar como template de layout'),
  editedData: z.object({
    recipientName: z.string(),
    streetAddress: z.string(), 
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    orderNumber: z.string(),
    invoiceNumber: z.string(),
    estimatedDeliveryDate: z.string(),
    trackingNumber: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
    senderNeighborhood: z.string().optional(),
    senderCityState: z.string().optional(),
  }).describe('Os dados editados para inserir na nova etiqueta')
});

const RegenerateZplOutputSchema = z.object({
  newZpl: z.string().describe('O novo ZPL gerado com os dados editados'),
  preservedElements: z.array(z.string()).describe('Elementos preservados do ZPL original')
});

export type RegenerateZplInput = z.infer<typeof RegenerateZplInputSchema>;
export type RegenerateZplOutput = z.infer<typeof RegenerateZplOutputSchema>;

export async function regenerateZpl(input: RegenerateZplInput): Promise<RegenerateZplOutput> {
  const settings = await loadAppSettings();
  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('IA não configurada: defina a chave do Gemini na página Mapeamento.');
  }
  const ai = getAi(apiKey);
  
  const prompt = ai.definePrompt({
    name: 'regenerateZplPrompt',
    model: gemini15Flash,
    input: { schema: RegenerateZplInputSchema },
    output: { schema: RegenerateZplOutputSchema },
    prompt: `
Você é um especialista em ZPL que vai regenerar uma etiqueta de envio completamente nova.

OBJETIVO: Criar um novo ZPL usando o layout/estrutura do original, mas com os dados editados fornecidos.

REGRAS CRÍTICAS:
1. **PRESERVAR CÓDIGOS**: Mantenha todos os códigos de barras (^BC, ^B3, etc) e QR codes (^BQ) EXATAMENTE como estão no original
2. **PRESERVAR LAYOUT**: Mantenha as mesmas posições (^FO), fontes (^A), e estrutura visual
3. **SUBSTITUIR TEXTOS**: Substitua apenas os textos nos campos ^FD pelos novos dados fornecidos
4. **ENCODING**: Use ^FH^FD com encoding hexadecimal (_XX) para caracteres especiais/acentos quando necessário
5. **ESTRUTURA**: Mantenha ^XA no início, ^XZ no fim, e ^CI28 logo após ^XA para suporte UTF-8

PROCESSO:
1. Analise o ZPL original para identificar a estrutura e layout
2. Identifique quais campos ^FD correspondem a quais dados (nome, endereço, etc)
3. Substitua apenas os conteúdos dos campos ^FD pelos novos dados
4. Mantenha todos os códigos de barras, posicionamento e formatação originais
5. Aplique encoding hexadecimal quando necessário para caracteres especiais

ZPL Original (como referência de layout):
{{{originalZpl}}}

Novos dados para inserir:
{{{json editedData}}}

Gere um ZPL novo e limpo que mantenha a estrutura visual do original mas com os dados atualizados.
`,
  });

  const regenerateZplFlow = ai.defineFlow(
    {
      name: 'regenerateZplFlow',
      inputSchema: RegenerateZplInputSchema,
      outputSchema: RegenerateZplOutputSchema,
    },
    async (flowInput) => {
      const { output } = await prompt(flowInput);
      if (!output?.newZpl) {
        throw new Error('A IA não conseguiu gerar o novo ZPL.');
      }
      return output;
    }
  );

  return regenerateZplFlow(input);
}

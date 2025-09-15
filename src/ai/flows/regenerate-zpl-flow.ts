
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
    estimatedDeliveryDate: z.string().optional(),
    trackingNumber: z.string(),
    senderName: z.string(),
    senderAddress: z.string(),
    senderNeighborhood: z.string().optional(),
    senderCityState: z.string().optional(),
  }).describe('Os dados editados para inserir na nova etiqueta')
});

const RegenerateZplOutputSchema = z.object({
  newZpl: z.string().describe('O novo ZPL gerado com os dados editados'),
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
      Você é um especialista em ZPL (Zebra Programming Language). Sua tarefa é gerar um código ZPL para uma etiqueta de envio de 4x6 polegadas (100x150mm) a partir dos dados JSON fornecidos.
      O layout deve ser profissional, limpo e inspirado no exemplo a seguir, mas sem os logos.

      **DADOS PARA A ETIQUETA:**
      \`\`\`json
      {{{json editedData}}}
      \`\`\`

      **REGRAS PARA GERAR O ZPL:**
      1.  **Estrutura Base:** Comece com \`^XA\` e termine com \`^XZ\`. Use \`^CI28\` para encoding UTF-8. Use coordenadas em dots (8dpmm).
      2.  **Linha de Informações Superior:** Crie uma linha no topo com "Volume: 1/1", "Peso (kg): 1,200", "Nota fiscal: {{{editedData.invoiceNumber}}}", e "Coleta: 321". Use uma fonte pequena (ex: \`^A0N,22,20\`).
      3.  **Código de Barras Principal:**
          *   Crie um código de barras Code 128 (\`^BCN,100,Y,N,N\`) com altura de 100 dots usando o valor de \`trackingNumber\`.
          *   Logo ACIMA do código de barras, coloque o texto do \`trackingNumber\` com uma fonte de tamanho médio (ex: \`^A0N,28,28\`).
      4.  **Seção DESTINATÁRIO:**
          *   Use um campo de bloco (\`^FB\`) ou posicione os campos (\`^FO\`) para criar um bloco de endereço claro.
          *   Comece com a palavra "DESTINATÁRIO" em um retângulo preto (\`^FOx,y^GBw,h,h,B,0^FS\`) e texto branco (\`^FOx,y^A0N,25,25^FN"DESTINATARIO"^FS\`).
          *   Destaque o nome do destinatário (\`recipientName\`) com uma fonte maior que o resto do endereço.
          *   Inclua o endereço completo (\`streetAddress\`), cidade, estado e CEP.
      5.  **Seção REMETENTE:**
          *   Crie um bloco de texto similar para o remetente abaixo do destinatário.
          *   Comece com a palavra "REMETENTE" em um retângulo preto.
          *   Inclua \`senderName\` e \`senderAddress\`.
      6.  **Layout e Posição:** Organize os campos de forma lógica e legível. Use o comando \`^FOx,y\` para posicionar os campos. Não precisa replicar o layout do ZPL original. Crie um layout novo, limpo e funcional.
      7.  **Caracteres Especiais:** Se houver caracteres com acentos, use o comando \`^FH\` antes do \`^FD\` correspondente para habilitar o uso de hexadecimais (ex: \`^FH^FDJo_C3_A3o^FS\`).

      Gere um código ZPL completo e válido.
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

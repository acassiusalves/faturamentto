
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
      O layout deve ser profissional, limpo e seguir estritamente as regras abaixo.

      **DADOS PARA A ETIQUETA:**
      \`\`\`json
      {{{json editedData}}}
      \`\`\`

      **REGRAS PARA GERAR O ZPL:**
      1.  **Estrutura Base:**
          *   Comece com \`^XA\`.
          *   Defina a etiqueta com 100mm de largura (\`^PW800\`).
          *   Defina o comprimento da etiqueta para 150mm (\`^LL1200\`).
          *   Use codificação UTF-8 (\`^CI28\`).
          *   Termine com \`^XZ\`.

      2.  **Linha de Informações Superior (Y=20):**
          *   Crie uma linha no topo (Y=20) com: "Volume: 1/1", "Peso (kg): 1,200", "NF: {{{editedData.invoiceNumber}}}". Use uma fonte pequena (\`^A0N,22,20\`).

      3.  **Código de Barras Principal (em torno de Y=80):**
          *   Posicione o código de barras Code 128 (\`^BCN,100,Y,N,N\`) na parte superior da etiqueta (por volta de Y=80).
          *   Use o valor de \`trackingNumber\` como dados do código de barras.
          *   Imediatamente ACIMA do código de barras, adicione o texto legível do \`trackingNumber\` com uma fonte média (\`^A0N,28,28\`).

      4.  **Seção DESTINATÁRIO (em torno de Y=300):**
          *   Comece com a palavra "DESTINATÁRIO" em um retângulo preto.
          *   Use um campo de bloco (\`^FB\`) para o endereço, garantindo que ele quebre a linha corretamente e não ultrapasse a largura da etiqueta.
          *   Destaque o nome do destinatário (\`recipientName\`) com uma fonte maior que o resto do endereço (ex: \`^A0N,40,35\`).
          *   Inclua o endereço completo (\`streetAddress\`), cidade, estado e CEP (\`zipCode\`).

      5.  **Seção REMETENTE (em torno de Y=600):**
          *   Crie um bloco de texto similar para o remetente abaixo do destinatário.
          *   Comece com a palavra "REMETENTE" em um retângulo preto.
          *   Inclua \`senderName\` e \`senderAddress\`.

      6.  **Posicionamento:** Organize os campos de forma lógica e legível usando o comando \`^FOx,y\` para o posicionamento de cada bloco.
      
      7.  **Caracteres Especiais:** Use o comando \`^FH\` antes do \`^FD\` correspondente para habilitar o uso de hexadecimais para acentos (ex: \`^FH^FDJo_C3_A3o^FS\`).

      Gere um código ZPL completo e válido que produza uma etiqueta bem formatada de 100x150mm.
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

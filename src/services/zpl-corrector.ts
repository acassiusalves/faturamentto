
'use server';

import type { AnalyzeLabelOutput } from '@/lib/types';
import { getAi } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';
import { loadAppSettings } from './firestore';

// ==============================================================================
// TIPOS E SCHEMAS
// ==============================================================================

interface ZplTextElement {
  content: string;
  rawContent: string;
  x: number;
  y: number;
  startLine: number;
  endLine: number;
  fdLineIndex: number;
  hasEncoding: boolean;
  isBarcode: boolean;
  isQrCode: boolean;
}

const DebugStatsSchema = z.object({
  totalElements: z.number().describe("Total de elementos de texto extraídos."),
  mappedFields: z.number().describe("Total de campos mapeados com sucesso."),
});

const MappedFieldSchema = z.object({
  field: z.string().describe("O nome do campo do sistema (ex: recipientName)."),
  content: z.string().describe("O valor extraído para o campo."),
  line: z.number().describe("A linha no ZPL onde o valor foi encontrado."),
  confidence: z.number().min(0).max(1).describe("A confiança da IA no mapeamento (de 0 a 1).")
});

const DebugMappingResultSchema = z.object({
  stats: DebugStatsSchema,
  mappedFields: z.array(MappedFieldSchema),
  allElements: z.array(z.object({
    content: z.string(),
    line: z.number(),
  })).describe("Todos os elementos de texto encontrados no ZPL."),
});

type DebugMappingResult = z.infer<typeof DebugMappingResultSchema>;

// ==============================================================================
// FUNÇÃO DE PARSE DO ZPL
// ==============================================================================

function parseZplForTextElements(zpl: string): ZplTextElement[] {
  const elements: ZplTextElement[] = [];
  const lines = zpl.split(/\r?\n/);
  const commandRegex = /^\^([A-Z0-9]+),?([^]*)/;
  
  let currentBlock: Partial<ZplTextElement> & { startLine?: number } = {};

  lines.forEach((line, index) => {
    const match = line.match(commandRegex);
    if (!match) return;

    const [, command, params] = match;

    if (command === 'FO') {
      if (currentBlock.startLine !== undefined) {
        // block was not closed, ignore it
      }
      const [x, y] = params.split(',').map(Number);
      currentBlock = { startLine: index, x, y, isBarcode: false, isQrCode: false, hasEncoding: false };
    } else if (command === 'FH') {
        if (currentBlock.startLine !== undefined) currentBlock.hasEncoding = true;
    } else if (command === 'BC' || command === 'B3') {
        if (currentBlock.startLine !== undefined) currentBlock.isBarcode = true;
    } else if (command === 'BQ') {
        if (currentBlock.startLine !== undefined) currentBlock.isQrCode = true;
    } else if (command === 'FD') {
      if (currentBlock.startLine !== undefined) {
        currentBlock.rawContent = params;
        
        if (currentBlock.hasEncoding) {
            currentBlock.content = params.replace(/_([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        } else {
            currentBlock.content = params;
        }
        currentBlock.fdLineIndex = index;
      }
    } else if (command === 'FS') {
      if (currentBlock.startLine !== undefined && currentBlock.rawContent !== undefined) {
        elements.push({ ...currentBlock, endLine: index } as ZplTextElement);
      }
      currentBlock = {}; // Reset for the next block
    }
  });

  return elements;
}


// ==============================================================================
// FUNÇÕES EXPORTADAS
// ==============================================================================

export async function correctExtractedData(
  originalZpl: string,
  extractedData: AnalyzeLabelOutput
): Promise<AnalyzeLabelOutput> {
  const textElements = parseZplForTextElements(originalZpl);
  
  // Simple heuristic: find the largest block of text for the address
  const sortedByY = [...textElements].sort((a, b) => a.y - b.y);
  
  // Find recipient block (usually after the middle of the label)
  const midPointY = Math.max(...sortedByY.map(e => e.y)) / 2;
  const potentialRecipientElements = sortedByY.filter(e => e.y > midPointY && !e.isBarcode && !e.isQrCode);
  
  const recipientBlock = potentialRecipientElements.slice(0, 5).map(e => e.content).join('\n');

  // Let AI fix just the address parts based on a more structured block
  const settings = await loadAppSettings();
  const ai = getAi(settings?.geminiApiKey);

  const AddressSchema = z.object({
    recipientName: z.string().describe("The name of the recipient."),
    streetAddress: z.string().describe("The full street address, including number."),
    city: z.string().describe("The city."),
    state: z.string().describe("The state (UF)."),
    zipCode: z.string().describe("The ZIP code (CEP)."),
  });
  
  const prompt = ai.definePrompt({
    name: "zplAddressCorrector",
    model: gemini15Flash,
    output: { schema: AddressSchema },
    prompt: `
      You are an expert in parsing Brazilian addresses. From the text block below, extract the recipient's information.
      TEXT BLOCK:
      ---
      ${recipientBlock}
      ---
    `
  });

  try {
    const { output } = await prompt();
    if(output) {
      return {
        ...extractedData,
        recipientName: output.recipientName,
        streetAddress: output.streetAddress,
        city: output.city,
        state: output.state,
        zipCode: output.zipCode,
      };
    }
  } catch (e) {
    console.error("AI address correction failed, returning original data", e);
    return extractedData; // Fallback
  }
  
  return extractedData; // Fallback
}


export async function debugMapping(
  originalZpl: string,
  extractedData: AnalyzeLabelOutput
): Promise<DebugMappingResult> {
  const allElements = parseZplForTextElements(originalZpl);

  const mappedFields: { field: string; content: string; line: number; confidence: number; }[] = [];
  let mappedCount = 0;

  Object.entries(extractedData).forEach(([key, value]) => {
      const foundElement = allElements.find(el => el.content.includes(String(value)));
      if (foundElement) {
          mappedFields.push({
              field: key,
              content: String(value),
              line: foundElement.fdLineIndex + 1,
              confidence: 1.0 // Simple confidence, can be improved
          });
          mappedCount++;
      }
  });

  return {
    stats: {
        totalElements: allElements.length,
        mappedFields: mappedCount,
    },
    mappedFields,
    allElements: allElements.map(el => ({ content: el.content, line: el.fdLineIndex + 1 }))
  };
}

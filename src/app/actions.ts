
'use server';

import {processListPipeline} from '@/ai/flows/process-list-flow';
import type {PipelineResult} from '@/lib/types';
import {organizeList, type OrganizeListInput} from '@/ai/flows/organize-list';
import {standardizeList, type StandardizeListInput} from '@/ai/flows/standardize-list';
import {lookupProducts} from '@/ai/flows/lookup-products';
import { saveAppSettings, loadAppSettings } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import { analyzeFeed } from '@/ai/flows/analyze-feed-flow';
import { fetchOrderLabel } from '@/services/ideris';
import { analyzeLabel } from '@/ai/flows/analyze-label-flow';
import { analyzeZpl } from '@/ai/flows/analyze-zpl-flow';
import { remixLabelData } from '@/ai/flows/remix-label-data-flow';
import { remixZplData } from '@/ai/flows/remix-zpl-data-flow';
import type { RemixZplDataInput, RemixZplDataOutput, AnalyzeLabelOutput, RemixableField, RemixLabelDataInput, OrganizeResult, StandardizeListOutput, LookupResult, LookupProductsInput, AnalyzeCatalogInput, AnalyzeCatalogOutput } from '@/lib/types';
import { regenerateZpl, type RegenerateZplInput, type RegenerateZplOutput } from '@/ai/flows/regenerate-zpl-flow';
import { analyzeCatalog } from '@/ai/flows/analyze-catalog-flow';
import { searchMercadoLivreProducts } from '@/services/mercadolivre';
import { debugMapping, correctExtractedData } from '@/services/zpl-corrector';

// === SISTEMA DE MAPEAMENTO PRECISO ZPL ===
// Substitui todo o sistema anterior por uma abordagem mais determinística

interface ZplTextElement {
  content: string;           // texto decodificado
  rawContent: string;        // texto original no ZPL  
  x: number;                 // coordenada X
  y: number;                 // coordenada Y
  startLine: number;         // linha onde começa o bloco
  endLine: number;           // linha onde termina o bloco
  fdLineIndex: number;       // linha específica do ^FD
  hasEncoding: boolean;      // se tem ^FH
  isBarcode: boolean;        // se é código de barra
  isQrCode: boolean;         // se é QR code
}

interface ZplMapping {
  allTextElements: ZplTextElement[];
  mappedFields: {
    [K in keyof AnalyzeLabelOutput]?: {
        content: string;
        line: number;
        confidence: number;
    }
  }
}
// Server Actions
export async function searchMercadoLivreAction(
  _prevState: any,
  formData: FormData
) {
  try {
    const productName = String(formData.get("productName") || "").trim();
    const quantity = Number(formData.get("quantity") || 10);
    const result = await searchMercadoLivreProducts(productName, quantity);
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e?.message || "Falha inesperada" };
  }
}

export async function organizeListAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: OrganizeResult | null; error: string | null }> {
  try {
    const productList = formData.get('productList') as string;
    const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!productList) throw new Error("A lista de produtos não pode estar vazia.");
    const result = await organizeList({ productList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao organizar a lista." };
  }
}

export async function standardizeListAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: StandardizeListOutput | null; error: string | null }> {
  try {
    const organizedList = formData.get('organizedList') as string;
     const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!organizedList) throw new Error("A lista organizada não pode estar vazia.");
    const result = await standardizeList({ organizedList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao padronizar a lista." };
  }
}

export async function lookupProductsAction(
  _prevState: any,
  formData: FormData
): Promise<{ result: LookupResult | null; error: string | null }> {
  try {
    const productList = formData.get('productList') as string;
    const databaseList = formData.get('databaseList') as string;
     const apiKey = formData.get('apiKey') as string | undefined;
    const prompt_override = formData.get('prompt_override') as string | undefined;
    if (!productList) throw new Error("A lista de produtos não pode estar vazia.");
    if (!databaseList) throw new Error("A base de dados de produtos não pode estar vazia.");
    const result = await lookupProducts({ productList, databaseList, apiKey, prompt_override });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao buscar produtos no banco de dados." };
  }
}

export async function fetchLabelAction(_prevState: any, formData: FormData): Promise<{ labelUrl: string | null, zplContent: string | null, error: string | null, rawError: string | null }> {
    const orderId = formData.get('orderId') as string;
    const format = formData.get('format') as 'PDF' | 'ZPL';
    
    try {
        const settings = await loadAppSettings();
        if (!settings?.iderisPrivateKey) {
          throw new Error("A chave da API da Ideris não está configurada.");
        }
        
        const response = await fetchOrderLabel(settings.iderisPrivateKey, orderId, format);
        
        if (response.error) {
            return { labelUrl: null, zplContent: null, error: response.error, rawError: response.rawError || null };
        }
        
        if (format === 'PDF') {
            const url = response.data?.obj?.[0]?.url;
            return { labelUrl: url || null, zplContent: null, error: url ? null : 'URL do PDF não encontrada na resposta.', rawError: null };
        } else { // ZPL
            const zplText = response.data?.obj?.[0]?.text;
            return { labelUrl: null, zplContent: zplText || null, error: zplText ? null : 'Conteúdo ZPL não encontrado na resposta.', rawError: null };
        }

    } catch (e: any) {
        return { labelUrl: null, zplContent: null, error: e.message || "Ocorreu um erro desconhecido.", rawError: null };
    }
}


export async function analyzeLabelAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const photoDataUri = formData.get('photoDataUri') as string;
    if (!photoDataUri) {
        return { analysis: null, error: "Nenhuma imagem foi enviada para análise." };
    }
    
    try {
        const result = await analyzeLabel({ photoDataUri });
        return { analysis: result, error: null };
    } catch (e: any) {
         return { analysis: null, error: e.message || "Ocorreu um erro desconhecido durante a análise." };
    }
}

export async function analyzeZplAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const zplContent = formData.get('zplContent') as string;
    if (!zplContent) {
        return { analysis: null, error: "Nenhum conteúdo ZPL foi enviado para análise." };
    }
    
    try {
        const result = await analyzeZpl({ zplContent });
        return { analysis: result, error: null };
    } catch (e: any) {
         return { analysis: null, error: e.message || "Ocorreu um erro desconhecido durante a análise ZPL." };
    }
}

export async function remixLabelDataAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
  const originalDataStr = formData.get('originalData') as string;
  const fieldToRemix = formData.get('fieldToRemix') as RemixableField;

  if (!originalDataStr || !fieldToRemix) {
    return { analysis: null, error: "Dados inválidos para remix." };
  }

  try {
    const originalData: AnalyzeLabelOutput = JSON.parse(originalDataStr);
    const originalValue = originalData[fieldToRemix];
    
    const settings = await loadAppSettings();

    const result = await remixLabelData({
      fieldToRemix,
      originalValue,
      apiKey: settings?.geminiApiKey,
    });

    const updatedData = { ...originalData, [fieldToRemix]: result.newValue };

    return { analysis: updatedData, error: null };
  } catch (e: any) {
    return { analysis: null, error: e.message || "Falha ao gerar novos dados." };
  }
}

export async function remixZplDataAction(_prevState: any, formData: FormData): Promise<{ result: RemixZplDataOutput | null; error: string | null; }> {
    try {
        const input: RemixZplDataInput = JSON.parse(formData.get('zplRemixInput') as string);
        if (!input) {
            throw new Error('Input ZPL para remix inválido.');
        }
        const result = await remixZplData(input);
        return { result, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || "Falha ao modificar ZPL." };
    }
}

export async function regenerateZplAction(_prevState: any, formData: FormData): Promise<{ result: RegenerateZplOutput | null; error: string | null }> {
    const originalZpl = formData.get('originalZpl') as string;
    const editedDataStr = formData.get('editedData') as string;
    
    try {
        if (!originalZpl || !editedDataStr) {
            throw new Error('Dados insuficientes para regenerar a etiqueta.');
        }
        const editedData = JSON.parse(editedDataStr);
        const input: RegenerateZplInput = { originalZpl, editedData };
        const result = await regenerateZpl(input);
        return { result, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || 'Falha na regeneração da etiqueta ZPL.' };
    }
}


export async function correctExtractedDataAction(_prevState: any, formData: FormData): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
  try {
    const originalZpl = formData.get('originalZpl') as string;
    const extractedDataStr = formData.get('extractedData') as string;
    if (!originalZpl || !extractedDataStr) {
      throw new Error('Dados de entrada ausentes para correção.');
    }
    const extractedData: AnalyzeLabelOutput = JSON.parse(extractedDataStr);
    const correctedData = await correctExtractedData(originalZpl, extractedData);
    return { analysis: correctedData, error: null };
  } catch (e: any) {
    return { analysis: null, error: e.message };
  }
}


export async function debugMappingAction(_prevState: any, formData: FormData) {
    const originalZpl = formData.get('originalZpl') as string;
    const extractedDataStr = formData.get('extractedData') as string;
     try {
        if (!originalZpl || !extractedDataStr) {
            throw new Error('Dados de entrada ausentes para debug.');
        }
        const extractedData = JSON.parse(extractedDataStr);
        const debugInfo = await debugMapping(originalZpl, extractedData);
        return { result: debugInfo, error: null };
    } catch (e: any) {
        return { result: null, error: e.message || "Falha no processo de debug." };
    }
}

export async function analyzeCatalogAction(_prevState: any, formData: FormData): Promise<{ result: AnalyzeCatalogOutput | null; error: string | null }> {
  try {
    const pdfContent = formData.get('pdfContent') as string;
    const pageNumber = Number(formData.get('pageNumber'));
    const totalPages = Number(formData.get('totalPages'));

    if (!pdfContent) throw new Error("O conteúdo do PDF não pode estar vazio.");
    if (isNaN(pageNumber) || isNaN(totalPages)) throw new Error("Número de página inválido.");

    const result = await analyzeCatalog({ pdfContent, pageNumber, totalPages });
    return { result, error: null };
  } catch (e: any) {
    return { result: null, error: e.message || "Falha ao analisar o catálogo." };
  }
}

export async function savePromptAction(_prevState: any, formData: FormData) {
  try {
    const promptKey = formData.get('promptKey') as string;
    const promptValue = formData.get('promptValue') as string;
    if (!promptKey || !promptValue) {
      throw new Error("Chave ou valor do prompt inválido.");
    }
    await saveAppSettings({ [promptKey]: promptValue });
    revalidatePath('/feed-25');
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

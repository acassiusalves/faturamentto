{// @ts-nocheck
'use server';

import {processListPipeline} from '@/ai/flows/process-list-flow';
import type {PipelineResult} from '@/lib/types';
import {organizeList, type OrganizeResult, type OrganizeListInput} from '@/ai/flows/organize-list';
import {standardizeList, type StandardizeListOutput, type StandardizeListInput} from '@/ai/flows/standardize-list';
import {lookupProducts, type LookupResult, type LookupProductsInput} from '@/ai/flows/lookup-products';
import { saveAppSettings, loadAppSettings } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import { analyzeFeed, type AnalyzeFeedInput } from '@/ai/flows/analyze-feed-flow';
import { fetchOrderLabel } from '@/services/ideris';
import { analyzeLabel, type AnalyzeLabelOutput } from '@/ai/flows/analyze-label-flow';
import * as pdfjs from 'pdfjs-dist';
import { createCanvas } from 'canvas';


// This is the main server action that will be called from the frontend.
export async function processListPipelineAction(
  prevState: {
    result: PipelineResult | null;
    error: string | null;
  },
  formData: FormData
): Promise<{
  result: PipelineResult | null;
  error: string | null;
}> {
  const productList = formData.get('productList') as string;
  const databaseList = formData.get('databaseList') as string;

  if (!productList) {
    return {result: null, error: 'A lista de produtos está vazia.'};
  }
  if (!databaseList) {
    return {
      result: null,
      error:
        'O banco de dados de produtos está vazio. Cadastre produtos na tela de Produtos.',
    };
  }

  try {
    const result = await processListPipeline({
      productList,
      databaseList,
    });
    return {result, error: null};
  } catch (e: any) {
    console.error('Error in processListPipelineAction:', e);
    return {result: null, error: e.message || 'Ocorreu um erro desconhecido.'};
  }
}


export async function organizeListAction(
    prevState: {
        result: OrganizeResult | null;
        error: string | null;
    },
    formData: FormData
): Promise<{
    result: OrganizeResult | null;
    error: string | null;
}> {
    const productList = formData.get('productList') as string;
    const apiKey = formData.get('apiKey') as string;
    const modelName = formData.get('modelName') as string;
    const prompt_override = formData.get('prompt_override') as string;

    if (!productList) {
        return { result: null, error: 'A lista de produtos está vazia.' };
    }
    
    try {
        const result = await organizeList({ productList, apiKey, modelName, prompt_override });
        return { result, error: null };
    } catch (e: any) {
        console.error('Error in organizeListAction:', e);
        return { result: null, error: e.message || 'Ocorreu um erro desconhecido.' };
    }
}

export async function standardizeListAction(
    prevState: {
        result: StandardizeListOutput | null;
        error: string | null;
    },
    formData: FormData
): Promise<{
    result: StandardizeListOutput | null;
    error: string | null;
}> {
    const organizedList = formData.get('organizedList') as string;
    const apiKey = formData.get('apiKey') as string;
    const modelName = formData.get('modelName') as string;
    const prompt_override = formData.get('prompt_override') as string;
    
    if (!organizedList) {
        return { result: null, error: 'A lista organizada está vazia.' };
    }
    
    try {
        const result = await standardizeList({ organizedList, apiKey, modelName, prompt_override });
        return { result, error: null };
    } catch (e: any) {
        console.error('Error in standardizeListAction:', e);
        return { result: null, error: e.message || 'Ocorreu um erro desconhecido.' };
    }
}

export async function lookupProductsAction(
    prevState: {
        result: LookupResult | null;
        error: string | null;
    },
    formData: FormData
): Promise<{
    result: LookupResult | null;
    error: string | null;
}> {
    const productList = formData.get('productList') as string;
    const databaseList = formData.get('databaseList') as string;
    const apiKey = formData.get('apiKey') as string;
    const modelName = formData.get('modelName') as string;
    const prompt_override = formData.get('prompt_override') as string;
    
    if (!productList) {
        return { result: null, error: 'A lista de produtos padronizada está vazia.' };
    }
     if (!databaseList) {
        return { result: null, error: 'O banco de dados de produtos está vazio.' };
    }

    try {
        const result = await lookupProducts({ productList, databaseList, apiKey, modelName, prompt_override });
        return { result, error: null };
    } catch (e: any) {
        console.error('Error in lookupProductsAction:', e);
        return { result: null, error: e.message || 'Ocorreu um erro desconhecido.' };
    }
}

export async function savePromptAction(
  prevState: { error: string | null, success?: boolean },
  formData: FormData
): Promise<{ error: string | null, success?: boolean }> {
  const promptKey = formData.get('promptKey') as string;
  const promptValue = formData.get('promptValue') as string;

  if (!promptKey || !['organizePrompt', 'standardizePrompt', 'lookupPrompt'].includes(promptKey)) {
    return { error: 'Chave de prompt inválida.' };
  }
  if (!promptValue) {
    return { error: 'O conteúdo do prompt não pode estar vazio.' };
  }

  try {
    await saveAppSettings({ [promptKey]: promptValue });
    revalidatePath('/feed-25'); // Revalidate the page to ensure it loads the new prompt
    return { error: null, success: true };
  } catch (e: any) {
    console.error("Error saving prompt:", e);
    return { error: e.message || 'Ocorreu um erro ao salvar o prompt.' };
  }
}

export async function analyzeFeedAction(
    prevState: {
      result: { analysis: any[] } | null;
      error: string | null;
    },
    formData: FormData
  ): Promise<{
    result: { analysis: any[] } | null;
    error: string | null;
  }> {
    const feedData = formData.get('feedData') as string;
    const apiKey = formData.get('apiKey') as string;
    const modelName = formData.get('modelName') as string;

    if (!feedData) {
      return {result: null, error: 'Nenhum dado do feed para analisar.'};
    }
  
    try {
      const parsedFeed = JSON.parse(feedData);
      const input: AnalyzeFeedInput = {
        products: parsedFeed,
        apiKey: apiKey,
        modelName: modelName
      }
      const result = await analyzeFeed(input);

      return {result: { analysis: result.analysis }, error: null};
    } catch (e: any) {
      console.error('Error in analyzeFeedAction:', e);
      return {result: null, error: e.message || 'Ocorreu um erro desconhecido durante a análise.'};
    }
  }

export async function fetchLabelAction(
  prevState: { labelUrl: string | null; error: string | null; rawError: string | null },
  formData: FormData
): Promise<{ labelUrl: string | null; error: string | null; rawError: string | null }> {
  const orderId = String(formData.get('orderId') || '').trim();
  const format = (String(formData.get('format') || 'PDF').toUpperCase()) === 'ZPL' ? 'ZPL' : 'PDF';

  if (!orderId) {
    return { labelUrl: null, error: 'Informe o ID do pedido.', rawError: null };
  }

  try {
    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey) {
      return { labelUrl: null, error: 'A chave da API da Ideris não está configurada.', rawError: null };
    }

    const { data, error, rawError } = await fetchOrderLabel(settings.iderisPrivateKey, orderId, format);
    
    if (error) {
        return { labelUrl: null, error: error, rawError: rawError };
    }

    const labelUrl = data?.obj?.[0]?.text ?? null;

    if (!labelUrl) {
      return {
        labelUrl: null,
        error: 'A Ideris respondeu, mas não foi possível encontrar a URL da etiqueta na resposta.',
        rawError: JSON.stringify(data, null, 2),
      };
    }

    return { labelUrl: labelUrl, error: null, rawError: null };
    
  } catch (e: any) {
    return { labelUrl: null, error: e.message || 'Ocorreu um erro inesperado.', rawError: e.stack || null };
  }
}

// Converts a file to a data URI
async function fileToDataURI(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${file.type};base64,${buffer.toString('base64')}`;
}

async function pdfToPngDataURI(pdfBuffer: Buffer): Promise<string> {
    const data = new Uint8Array(pdfBuffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // Increase scale for better resolution
    
    // The library `canvas` is required for Node.js environment
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    return canvas.toDataURL('image/png');
}

export async function analyzeLabelAction(
    prevState: { analysis: AnalyzeLabelOutput | null; error: string | null; },
    formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const labelFile = formData.get('labelFile') as File;

    if (!labelFile) {
        return { analysis: null, error: 'Nenhum arquivo enviado.' };
    }

    try {
        let photoDataUri = '';
        if (labelFile.type === 'application/pdf') {
            const arrayBuffer = await labelFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            photoDataUri = await pdfToPngDataURI(buffer);
        } else if (labelFile.type.startsWith('image/')) {
            photoDataUri = await fileToDataURI(labelFile);
        } else {
             return { analysis: null, error: 'Formato de ficheiro não suportado. Por favor, envie uma imagem ou PDF.' };
        }

        const result = await analyzeLabel({ photoDataUri });
        return { analysis: result, error: null };
    } catch (e: any) {
        console.error("Error analyzing label:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao analisar a etiqueta.' };
    }
}

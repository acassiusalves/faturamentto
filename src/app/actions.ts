
// @ts-nocheck
'use server';

import {processListPipeline} from '@/ai/flows/process-list-flow';
import type {PipelineResult} from '@/lib/types';
import {organizeList, type OrganizeResult, type OrganizeListInput} from '@/ai/flows/organize-list';
import {standardizeList, type StandardizeListOutput, type StandardizeListInput} from '@/ai/flows/standardize-list';
import {lookupProducts, type LookupResult, type LookupProductsInput} from '@/ai/flows/lookup-products';
import { saveAppSettings, loadAppSettings, generateAccessToken } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import { analyzeFeed, type AnalyzeFeedInput } from '@/ai/flows/analyze-feed-flow';
import { fetchOrderLabel, fetchOrderLabelWithToken } from '@/services/ideris';
import { analyzeLabel, type AnalyzeLabelOutput } from '@/ai/flows/analyze-label-flow';

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

    const token = await generateAccessToken(settings.iderisPrivateKey);
    const decode = (t: string) => {
      try {
        const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString('utf8'));
        const { CustomerId, ApplicationId, MasterUserId, PrivateKeyId } = payload || {};
        return { CustomerId, ApplicationId, MasterUserId, PrivateKeyId };
      } catch { return null; }
    };

    const info = decode(token);
    const resp = await fetchOrderLabelWithToken(token, orderId, format);

    if (resp.url) {
      return { labelUrl: resp.url, error: null, rawError: null };
    }

    return {
      labelUrl: null,
      error: resp.error || 'Erro ao buscar etiqueta.',
      rawError: JSON.stringify({
        requestUrl: resp.requestUrl,
        apiResponse: resp.raw,
        tokenInfo: info,
      }, null, 2),
    };
  } catch (e: any) {
    return { labelUrl: null, error: e.message || 'Ocorreu um erro inesperado.', rawError: e.stack || null };
  }
}

async function fileToDataURI(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export async function analyzeLabelAction(
    prevState: { analysis: AnalyzeLabelOutput | null; error: string | null; },
    formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const labelImage = formData.get('labelImage') as File;

    if (!labelImage) {
        return { analysis: null, error: 'Nenhum arquivo de imagem enviado.' };
    }

    try {
        const photoDataUri = await fileToDataURI(labelImage);
        const result = await analyzeLabel({ photoDataUri });
        return { analysis: result, error: null };
    } catch (e: any) {
        console.error("Error analyzing label:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao analisar a etiqueta.' };
    }
}

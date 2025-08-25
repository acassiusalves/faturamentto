
'use server';

import {processListPipeline} from '@/ai/flows/process-list-flow';
import type {PipelineResult} from '@/lib/types';
import {organizeList, type OrganizeResult, type OrganizeListInput} from '@/ai/flows/organize-list';
import {standardizeList, type StandardizeListOutput, type StandardizeListInput} from '@/ai/flows/standardize-list';
import {lookupProducts, type LookupResult, type LookupProductsInput} from '@/ai/flows/lookup-products';
import { saveAppSettings, loadAppSettings } from '@/services/firestore';
import { revalidatePath } from 'next/cache';
import { analyzeFeed } from '@/ai/flows/analyze-feed-flow';
import { fetchOrderLabel } from '@/services/ideris';
import { analyzeLabel } from '@/ai/flows/analyze-label-flow';
import { analyzeZpl } from '@/ai/flows/analyze-zpl-flow';
import { remixLabelData } from '@/ai/flows/remix-label-data-flow';
import { remixZplData } from '@/ai/flows/remix-zpl-data-flow';
import type { RemixZplDataInput, RemixZplDataOutput, AnalyzeLabelOutput, RemixableField, RemixLabelDataInput } from '@/lib/types';


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
      const input = { // Type assertion here might not be ideal, but it works for now
        products: parsedFeed,
        apiKey: apiKey,
        modelName: modelName
      } as any;
      const result = await analyzeFeed(input);

      return {result: { analysis: result.analysis }, error: null};
    } catch (e: any) {
      console.error('Error in analyzeFeedAction:', e);
      return {result: null, error: e.message || 'Ocorreu um erro desconhecido durante a análise.'};
    }
  }

export async function fetchLabelAction(
  prevState: { labelUrl: string | null; error: string | null; rawError: string | null; zplContent: string | null; },
  formData: FormData
): Promise<{ labelUrl: string | null; error: string | null; rawError: string | null; zplContent: string | null; }> {
  const orderId = String(formData.get('orderId') || '').trim();
  const format = (String(formData.get('format') || 'PDF').toUpperCase()) === 'ZPL' ? 'ZPL' : 'PDF';

  if (!orderId) {
    return { labelUrl: null, error: 'Informe o ID do pedido.', rawError: null, zplContent: null };
  }

  try {
    const settings = await loadAppSettings();
    if (!settings?.iderisPrivateKey) {
      return { labelUrl: null, error: 'A chave da API da Ideris não está configurada.', rawError: null, zplContent: null };
    }

    const { data, error, rawError } = await fetchOrderLabel(settings.iderisPrivateKey, orderId, format);
    
    if (error) {
        return { labelUrl: null, error: error, rawError: rawError, zplContent: null };
    }

    let labelUrl: string | null = null;
    try {
      labelUrl = data?.obj?.[0]?.text ?? null;
    } catch (e) {
        // If data is just a string (for ZPL), handle it.
        if (typeof data === 'string') {
            labelUrl = data;
        }
    }
    
    let zplContent: string | null = null;
    let pdfUrl: string | null = null;
    
    if (!labelUrl) {
      return {
        labelUrl: null,
        error: 'A Ideris respondeu, mas não foi possível encontrar a URL da etiqueta na resposta.',
        rawError: JSON.stringify(data, null, 2),
        zplContent: null,
      };
    }

    // Se for ZPL, o 'labelUrl' contém o conteúdo ZPL. Se for PDF, contém a URL.
    if(format === 'ZPL') {
      zplContent = labelUrl;
    } else {
      pdfUrl = labelUrl;
    }

    return { labelUrl: pdfUrl, zplContent: zplContent, error: null, rawError: null };
    
  } catch (e: any) {
    return { labelUrl: null, error: e.message || 'Ocorreu um erro inesperado.', rawError: e.stack || null, zplContent: null };
  }
}

export async function analyzeLabelAction(
    prevState: { analysis: AnalyzeLabelOutput | null; error: string | null; },
    formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const photoDataUri = formData.get('photoDataUri') as string;

    if (!photoDataUri) {
        return { analysis: null, error: 'Nenhum dado de imagem para analisar.' };
    }

    try {
        const result = await analyzeLabel({ photoDataUri });
        return { analysis: result, error: null };
    } catch (e: any) {
        console.error("Error analyzing label:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao analisar a etiqueta.' };
    }
}

export async function analyzeZplAction(
    prevState: { analysis: AnalyzeLabelOutput | null; error: string | null; },
    formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const zplContent = formData.get('zplContent') as string;

    if (!zplContent) {
        return { analysis: null, error: 'Nenhum conteúdo ZPL para analisar.' };
    }

    try {
        const result = await analyzeZpl({ zplContent });
        return { analysis: result, error: null };
    } catch (e: any) {
        console.error("Error analyzing ZPL:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao analisar a etiqueta ZPL.' };
    }
}

export async function remixLabelDataAction(
    prevState: { analysis: AnalyzeLabelOutput | null; error: string | null; },
    formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null; }> {
    const originalDataJSON = formData.get('originalData') as string;
    const fieldToRemix = formData.get('fieldToRemix') as RemixableField;

    if (!originalDataJSON || !fieldToRemix) {
        return { analysis: null, error: 'Dados originais ou campo para modificar não encontrados.' };
    }

    try {
        const originalData: AnalyzeLabelOutput = JSON.parse(originalDataJSON);

        const flowInput: RemixLabelDataInput = {
            fieldToRemix: fieldToRemix,
            originalValue: originalData[fieldToRemix],
        };

        const result = await remixLabelData(flowInput);
        
        const finalResult = { ...originalData, [fieldToRemix]: result.newValue };

        return { analysis: finalResult, error: null };
    } catch (e: any) {
        console.error("Error remixing label data:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao gerar os novos dados da etiqueta.' };
    }
}

type ZplBlock = {
  start: number;
  end: number;
  x?: number;
  y?: number;
  fdText: string;
  isBarcode: boolean;
};

const TOLERANCE_PX = 12;
const BARCODE_LEFT_SAFE_X = 160;

function normalize(s: string) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseZplBlocks(zpl: string): ZplBlock[] {
  const lines = zpl.split(/\r?\n/);
  const blocks: ZplBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const m = lines[i].match(/^\^(FO|FT)\s*(\d+),\s*(\d+)/i);
    if (!m) { i++; continue; }

    const start = i;
    const x = +m[2], y = +m[3];
    let isBarcode = false;
    let fdText = "";
    let end = i;

    i++;
    for (; i < lines.length; i++) {
      const L = lines[i];

      if (/^\^B[A-Z]/i.test(L)) isBarcode = true;

      const fdMatch = L.match(/\^FD([\s\S]*?)\^FS/);
      if (fdMatch) {
        fdText = fdMatch[1];
        end = i;
        break;
      }

      const onlyFd = L.match(/^\^FD(.*)$/);
      if (onlyFd) {
        fdText = onlyFd[1];
        let j = i + 1;
        for (; j < lines.length; j++) {
          const L2 = lines[j];
          if (/^\^B[A-Z]/i.test(L2)) isBarcode = true;
          const fsHere = L2.includes("^FS");
          fdText += "\n" + L2.replace(/\^FS.*/, "");
          if (fsHere) { end = j; i = j; break; }
        }
        break;
      }
    }

    blocks.push({ start, end, x, y, fdText, isBarcode });
    i++;
  }

  return blocks;
}

function ensureCI28(zpl: string) {
  if (!/\^XA\s*\^CI28/m.test(zpl)) {
    return zpl.replace(/^(\^XA)/m, "$1\n^CI28");
  }
  return zpl;
}

type BaselinePositions = Partial<Record<keyof AnalyzeLabelOutput, {x:number,y:number}>>;

function buildBaselinePositions(originalZpl: string, baseline: AnalyzeLabelOutput): BaselinePositions {
  const blocks = parseZplBlocks(originalZpl);
  const pos: BaselinePositions = {};
  const fields: (keyof AnalyzeLabelOutput)[] = [
    "orderNumber","invoiceNumber","trackingNumber","senderName","senderAddress",
    "recipientName","streetAddress","city","state","zipCode"
  ];

  for (const f of fields) {
    const val = (baseline[f] || "").trim();
    if (!val) continue;

    const nval = normalize(val);
    const hit = blocks.find(b =>
      !b.isBarcode &&
      typeof b.x === "number" &&
      typeof b.y === "number" &&
      normalize(b.fdText) === nval
    );

    if (hit) {
      pos[f] = { x: hit.x!, y: hit.y! };
    }
  }
  return pos;
}

function applyAnchoredReplacements(originalZpl: string, pos: BaselinePositions, baseline: AnalyzeLabelOutput, remixed: AnalyzeLabelOutput) {
  const lines = originalZpl.split(/\r?\n/);
  const blocks = parseZplBlocks(originalZpl);

  const fields: (keyof AnalyzeLabelOutput)[] = [
    "orderNumber","invoiceNumber","trackingNumber","senderName","senderAddress",
    "recipientName","streetAddress","city","state","zipCode"
  ];

  let changed = false;

  function distanceOK(a?: number, b?: number) {
    return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= TOLERANCE_PX;
  }

  for (const f of fields) {
    const target = (remixed[f] ?? "").toString();
    const basePos = pos[f];
    if (!basePos) continue;

    const blk = blocks.find(b =>
      !b.isBarcode &&
      (b.x ?? 0) >= BARCODE_LEFT_SAFE_X &&
      distanceOK(b.x, basePos.x) && distanceOK(b.y, basePos.y)
    );

    if (!blk) continue;

    const rngLines = lines.slice(blk.start, blk.end + 1).join("\n");

    if (target === "") {
      for (let i = blk.start; i <= blk.end; i++) lines[i] = "";
      changed = true;
      continue;
    }

    const replaced = rngLines.replace(/\^FD[\s\S]*?\^FS/, `^FD${target}^FS`);
    if (replaced !== rngLines) {
      const newChunk = replaced.split("\n");
      lines.splice(blk.start, blk.end - blk.start + 1, ...newChunk);
      changed = true;
    }
  }

  let out = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  out = ensureCI28(out);
  return { out, changed };
}

export async function remixZplDataAction(
  prevState: { result: RemixZplDataOutput | null; error: string | null },
  formData: FormData
): Promise<{ result: RemixZplDataOutput | null; error: string | null }> {
  const originalZpl = formData.get('originalZpl') as string;
  const baselineDataJSON = formData.get('baselineData') as string;
  const remixedDataJSON  = formData.get('remixedData') as string;
  const matchMode = (formData.get('matchMode') as 'strict' | 'relaxed') ?? 'strict';

  if (!originalZpl || !remixedDataJSON || !baselineDataJSON) {
    return { result: null, error: 'Faltam dados: originalZpl, baselineData ou remixedData.' };
  }

  try {
    const baseline = JSON.parse(baselineDataJSON) as AnalyzeLabelOutput;
    const remixed  = JSON.parse(remixedDataJSON)  as AnalyzeLabelOutput;

    for (const k of [
      'recipientName','streetAddress','city','state','zipCode',
      'orderNumber','invoiceNumber','trackingNumber','senderName','senderAddress','estimatedDeliveryDate'
    ] as (keyof AnalyzeLabelOutput)[]) {
      // @ts-ignore
      if (baseline[k] == null) baseline[k] = '';
      // @ts-ignore
      if (remixed[k]  == null) remixed[k]  = '';
    }

    const baselinePositions = buildBaselinePositions(originalZpl, baseline);
    const { out, changed } = applyAnchoredReplacements(originalZpl, baselinePositions, baseline, remixed);

    if (changed) {
      return { result: { modifiedZpl: out }, error: null };
    }

    const flowInput: RemixZplDataInput = {
      originalZpl,
      baselineData: baseline,
      remixedData: remixed,
      // @ts-ignore
      matchMode,
      // @ts-ignore
      baselinePositions
    };
    const llm = await remixZplData(flowInput);
    const sanitized = (llm.modifiedZpl || '').replace(/```(?:zpl)?/g, '').trim();
    return { result: { modifiedZpl: sanitized }, error: null };

  } catch (e: any) {
    console.error('Error remixing ZPL data:', e);
    return { result: null, error: e.message || 'Ocorreu um erro ao gerar o novo ZPL.' };
  }
}

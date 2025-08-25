
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
            originalValue: originalData[fieldToRemix] as string,
        };

        const result = await remixLabelData(flowInput);
        
        const finalResult = { ...originalData, [fieldToRemix]: result.newValue };

        return { analysis: finalResult, error: null };
    } catch (e: any) {
        console.error("Error remixing label data:", e);
        return { analysis: null, error: e.message || 'Ocorreu um erro ao gerar os novos dados da etiqueta.' };
    }
}

// --- CONSTANTES ---
const TOLERANCE_PX = 12;           // tolerância de coordenadas
const BARCODE_LEFT_SAFE_X = 220;   // NUNCA editar à esquerda disso

// --- TIPOS ---
type AnchorMap = Partial<Record<keyof AnalyzeLabelOutput, { x: number, y: number }>>;

type ZplBlock = {
  start: number; end: number;
  x?: number; y?: number;
  fdText: string;
  isBarcode: boolean;   // true se houver ^B* no bloco
};

// --- UTIL: normaliza texto para comparação "solta" ---
function normalize(s: string) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// --- PARSEIA BLOCOS ^FO/^FT ... ^FD...^FS (marca se é barcode) ---
function parseZplBlocks(zpl: string): ZplBlock[] {
  const lines = zpl.split(/\r?\n/);
  const blocks: ZplBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\^(FO|FT)\s*(\d+),\s*(\d+)/i);
    if (!m) continue;

    const start = i, x = +m[2], y = +m[3];
    let isBarcode = false, fdText = "", end = i;

    for (let j = i + 1; j < lines.length; j++) {
      const L = lines[j];
      if (/^\s*\^B[A-Z]/i.test(L)) isBarcode = true;

      const oneLine = L.match(/\^FD([\s\S]*?)\^FS/);
      if (oneLine) { fdText = oneLine[1]; end = j; i = j; break; }

      const fdStart = L.match(/^\s*\^FD(.*)$/);
      if (fdStart) {
        fdText = fdStart[1];
        for (let k = j + 1; k < lines.length; k++) {
          const L2 = lines[k];
          if (/^\s*\^B[A-Z]/i.test(L2)) isBarcode = true;
          const ends = /\^FS/.test(L2);
          fdText += "\n" + L2.replace(/\^FS.*$/, "");
          if (ends) { end = k; i = k; break; }
        }
        break;
      }
    }
    blocks.push({ start, end, x, y, fdText, isBarcode });
  }
  return blocks;
}

// --- GARANTE ^CI28 depois de ^XA ---
function ensureCI28(zpl: string) {
  if (!/\^XA\s*\^CI28/m.test(zpl)) return zpl.replace(/^(\^XA)/m, "$1\n^CI28");
  return zpl;
}

// --- DETECÇÃO DO TEMPLATE MAGALU ---
function isMagaluTemplate(zpl: string) {
  return /\^BQN,2,4/i.test(zpl) && /DESTINAT[ÁA]RIO/i.test(zpl) && /REMETENTE/i.test(zpl);
}

// --- ÂNCORAS FIXAS DO MAGALU ---
function magaluAnchors(): AnchorMap {
  return {
    recipientName:   { x: 370, y: 736 },
    streetAddress:   { x: 370, y: 791 },
    zipCode:         { x: 370, y: 848 },   // CEP ao fim da linha
    senderName:      { x: 370, y: 992 },
    senderAddress:   { x: 370, y: 1047 },
    city:            { x: 370, y: 1158 },  // "CIDADE, UF"
    state:           { x: 370, y: 1158 },  // mesma linha
  };
}

// --- CODIFICAÇÃO/DECODIFICAÇÃO ^FH (_xx) ---
function fhDecode(payload: string): string {
  // converte grupos como _50_41... em texto UTF-8
  return payload.replace(/(?:_[0-9A-Fa-f]{2})+/g, (seq) => {
    const bytes = seq.match(/_[0-9A-Fa-f]{2}/g)!.map(x => parseInt(x.slice(1), 16));
    return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
  });
}
function fhEncode(txt: string): string {
  const bytes = Buffer.from(txt, 'utf8');
  return Array.from(bytes).map(b => `_${b.toString(16).toUpperCase().padStart(2,'0')}`).join('');
}

function composeCityState(city?: string, state?: string) {
  const c = (city || '').trim();
  const s = (state || '').trim();
  if (!c && !s) return '';
  if (!c) return s.toUpperCase();
  if (!s) return c.toUpperCase();
  return `${c.toUpperCase()}, ${s.toUpperCase()}`;
}

function applyAnchoredReplacements(
  originalZpl: string,
  anchors: AnchorMap,
  baseline: AnalyzeLabelOutput,
  remixed: AnalyzeLabelOutput
) {
  const lines = originalZpl.split(/\r?\n/);
  const blocks = parseZplBlocks(originalZpl);

  const near = (a?: number, b?: number) =>
    typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= TOLERANCE_PX;

  function findBlockAt(x: number, y: number) {
    return blocks.find(b =>
      !b.isBarcode &&
      (b.x ?? 0) >= BARCODE_LEFT_SAFE_X &&
      near(b.x, x) && near(b.y, y)
    );
  }

  function replaceFDChunk(chunk: string, newTxt: string) {
    return chunk.replace(/\^FD[\s\S]*?\^FS/, `^FD${newTxt}^FS`);
  }

  let changed = false;

  // 1) recipientName
  if (anchors.recipientName && (remixed.recipientName ?? '').trim() !== '') {
    const blk = findBlockAt(anchors.recipientName.x!, anchors.recipientName.y!);
    if (blk) {
      const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
      const hadFH = /\^FH/.test(chunk);
      const newPayload = hadFH ? fhEncode(remixed.recipientName!) : remixed.recipientName!;
      const replaced = replaceFDChunk(chunk, newPayload);
      lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
      changed = true;
    }
  }

  // 2) streetAddress (linha 2)
  if (anchors.streetAddress && (remixed.streetAddress ?? '').trim() !== '') {
    const blk = findBlockAt(anchors.streetAddress.x!, anchors.streetAddress.y!);
    if (blk) {
      const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
      const hadFH = /\^FH/.test(chunk);
      const newPayload = hadFH ? fhEncode(remixed.streetAddress!) : remixed.streetAddress!;
      const replaced = replaceFDChunk(chunk, newPayload);
      lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
      changed = true;
    }
  }

  // 3) zipCode (apenas os ÚLTIMOS 8 dígitos da linha)
  if (anchors.zipCode && (remixed.zipCode ?? '').trim() !== '') {
    const blk = findBlockAt(anchors.zipCode.x!, anchors.zipCode.y!);
    if (blk) {
      const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
      const m = chunk.match(/\^FD([\s\S]*?)\^FS/);
      if (m) {
        const hadFH = /\^FH/.test(chunk);
        const oldPayload = m[1];
        const decoded = hadFH ? fhDecode(oldPayload) : oldPayload;
        const newZip = (remixed.zipCode || '').replace(/\D/g, '').slice(0, 8);
        const updatedText = decoded.replace(/(\d{8})(?!.*\d)/, newZip); // só o último bloco de 8 dígitos
        const newPayload = hadFH ? fhEncode(updatedText) : updatedText;
        const replaced = replaceFDChunk(chunk, newPayload);
        lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
        changed = true;
      }
    }
  }

  // 4) senderName
  if (anchors.senderName && (remixed.senderName ?? '').trim() !== '') {
    const blk = findBlockAt(anchors.senderName.x!, anchors.senderName.y!);
    if (blk) {
      const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
      const hadFH = /\^FH/.test(chunk);
      const newPayload = hadFH ? fhEncode(remixed.senderName!) : remixed.senderName!;
      const replaced = replaceFDChunk(chunk, newPayload);
      lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
      changed = true;
    }
  }

  // 5) senderAddress
  if (anchors.senderAddress && (remixed.senderAddress ?? '').trim() !== '') {
    const blk = findBlockAt(anchors.senderAddress.x!, anchors.senderAddress.y!);
    if (blk) {
      const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
      const hadFH = /\^FH/.test(chunk);
      const newPayload = hadFH ? fhEncode(remixed.senderAddress!) : remixed.senderAddress!;
      const replaced = replaceFDChunk(chunk, newPayload);
      lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
      changed = true;
    }
  }

  // 6) city/state (linha "CIDADE, UF")
  if (anchors.city && anchors.state) {
    const val = composeCityState(remixed.city, remixed.state);
    if (val) {
      const blk = findBlockAt(anchors.city.x!, anchors.city.y!);
      if (blk) {
        const chunk = lines.slice(blk.start, blk.end + 1).join("\n");
        const hadFH = /\^FH/.test(chunk);
        const newPayload = hadFH ? fhEncode(val) : val;
        const replaced = replaceFDChunk(chunk, newPayload);
        lines.splice(blk.start, blk.end - blk.start + 1, ...replaced.split("\n"));
        changed = true;
      }
    }
  }

  // 7) remove bloco redundante "BA" (370,1104), se existir
  const rm = blocks.find(b => !b.isBarcode && near(b.x, 370) && near(b.y, 1104));
  if (rm) {
    for (let i = rm.start; i <= rm.end; i++) lines[i] = "";
    changed = true;
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

    // normaliza campos ausentes
    ([
      'recipientName','streetAddress','city','state','zipCode',
      'orderNumber','invoiceNumber','trackingNumber',
      'senderName','senderAddress','estimatedDeliveryDate'
    ] as (keyof AnalyzeLabelOutput)[]).forEach((k) => {
      // @ts-ignore
      if (baseline[k] == null) baseline[k] = '';
      // @ts-ignore
      if (remixed[k]  == null) remixed[k]  = '';
    });

    // 1) Âncoras: se Magalu, usa fixas; senão tenta heurística antiga (se você quiser manter).
    const anchors: AnchorMap = isMagaluTemplate(originalZpl) ? magaluAnchors() : {};

    // 2) aplica substituições ancoradas
    const { out, changed } = applyAnchoredReplacements(originalZpl, anchors, baseline, remixed);
    if (changed) {
      return { result: { modifiedZpl: out }, error: null };
    }

    // 3) fallback LLM SOMENTE para inserir "estimatedDeliveryDate" (quando não existir no template)
    if ((remixed.estimatedDeliveryDate || '').trim()) {
      const flowInput: RemixZplDataInput = {
        originalZpl,
        baselineData: baseline,
        remixedData: remixed,
        // @ts-ignore
        matchMode,
        // @ts-ignore
        baselinePositions: anchors,
      };
      const llm = await remixZplData(flowInput);
      const sanitized = (llm.modifiedZpl || '').replace(/```(?:zpl)?/g, '').trim();
      return { result: { modifiedZpl: ensureCI28(sanitized) }, error: null };
    }

    // 4) nada para fazer
    return { result: { modifiedZpl: ensureCI28(originalZpl) }, error: null };

  } catch (e: any) {
    console.error('Error remixing ZPL data:', e);
    return { result: null, error: e.message || 'Ocorreu um erro ao gerar o novo ZPL.' };
  }
}

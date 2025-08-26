
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

// --- UTIL: normaliza texto para comparação "solta" ---
function normalize(s: string) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// --- CODIFICAÇÃO/DECODIFICAÇÃO ^FH (_xx) ---
function fhDecode(payload: string): string {
  // converte grupos como _50_41... em texto UTF-8
  return payload.replace(/(?:_[0-9A-Fa-f]{2})+/g, (seq) => {
    try {
      const bytes = seq.split('_').filter(Boolean).map(x => parseInt(x, 16));
      return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
    } catch (e) {
      return seq; // Retorna a sequência original em caso de erro
    }
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

// --- GARANTE ^CI28 depois de ^XA ---
function ensureCI28(zpl: string) {
  if (!/\^XA\s*\^CI28/m.test(zpl)) return zpl.replace(/^(\^XA)/m, "$1\n^CI28");
  return zpl;
}

// --- DETECÇÃO DO TEMPLATE MAGALU ---
function isMagaluTemplate(zpl: string) {
  // Tem QR do Magalu e os blocos nas coordenadas típicas
  const hasQR = /\^BQN\s*,\s*2\s*,\s*4/i.test(zpl);
  const hasRecipientLine = /\^(FO|FT)\s*370\s*,\s*736\b/i.test(zpl); // linha do nome do destinatário
  const hasSenderLine    = /\^(FO|FT)\s*370\s*,\s*992\b/i.test(zpl); // linha do nome do remetente
  return hasQR && hasRecipientLine && hasSenderLine;
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

// --- Aplica substituições ancoradas ---
function applyAnchoredReplacements(
  originalZpl: string,
  anchors: AnchorMap,
  remixed: AnalyzeLabelOutput
) {
    const lines = originalZpl.split(/\r?\n/);
    const blocksToRemove = new Set<number>();
    let hasChanged = false;

    // Helper para encontrar um bloco
    const findBlockIndexAt = (x: number, y: number): number => {
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^\s*\^(FO|FT)\s*(\d+),\s*(\d+)/i);
            if (m && Math.abs(Number(m[2]) - x) <= TOLERANCE_PX && Math.abs(Number(m[3]) - y) <= TOLERANCE_PX) {
                if (Number(m[2]) >= BARCODE_LEFT_SAFE_X) {
                    return i;
                }
            }
        }
        return -1;
    };
    
    // Helper para substituir ou apagar
    const processField = (fieldName: keyof AnchorMap, newValue: string) => {
        const anchor = anchors[fieldName];
        if (!anchor) return;

        const blockStartIndex = findBlockIndexAt(anchor.x, anchor.y);
        if (blockStartIndex === -1) return;

        let blockEndIndex = -1;
        for (let j = blockStartIndex; j < lines.length; j++) {
            if (/\^FS/.test(lines[j])) {
                blockEndIndex = j;
                break;
            }
        }
        if (blockEndIndex === -1) return;
        
        hasChanged = true;
        
        // Se o novo valor for vazio, marca para apagar
        if (newValue.trim() === '') {
            for (let i = blockStartIndex; i <= blockEndIndex; i++) {
                blocksToRemove.add(i);
            }
            return;
        }

        // Procura a linha com ^FD
        for (let j = blockStartIndex; j <= blockEndIndex; j++) {
            if (lines[j].includes('^FD')) {
                const hasFH = lines.slice(blockStartIndex, j + 1).some(l => l.includes('^FH'));
                const payload = hasFH ? fhEncode(newValue) : newValue;
                lines[j] = lines[j].replace(/\^FD[\s\S]*?\^FS/, `^FD${payload}^FS`);
                // Apaga as outras linhas do bloco se for multi-linha
                for (let k = j + 1; k <= blockEndIndex; k++) lines[k] = '';
                break;
            }
        }
    };
    
    // Aplica as lógicas
    processField('recipientName', remixed.recipientName);
    processField('streetAddress', remixed.streetAddress);
    processField('senderName', remixed.senderName);
    processField('senderAddress', remixed.senderAddress);
    
    const cityState = composeCityState(remixed.city, remixed.state);
    if(anchors.city) { // Usa a âncora da cidade para o campo combinado
        processField('city', cityState);
    }
    
    // Lógica especial para CEP
    const zipAnchor = anchors.zipCode;
    if(zipAnchor) {
        const zipBlockIndex = findBlockIndexAt(zipAnchor.x, zipAnchor.y);
        if (zipBlockIndex !== -1) {
            for(let i = zipBlockIndex; i < lines.length; i++) {
                if(lines[i].includes('^FD')) {
                    const newZip = (remixed.zipCode || '').replace(/\D/g, '').slice(0, 8);
                    const originalLine = lines[i];
                    const updatedLine = originalLine.replace(/(\d{8})(?!.*\d)/, newZip);
                    if (originalLine !== updatedLine) {
                        lines[i] = updatedLine;
                        hasChanged = true;
                    }
                    break;
                }
                 if(/\^FS/.test(lines[i])) break;
            }
        }
    }
    
    // Remove o bloco redundante "BA"
    const redundantBlockIndex = findBlockIndexAt(370, 1104);
    if (redundantBlockIndex !== -1) {
        // Simplesmente marca a linha para remoção
        blocksToRemove.add(redundantBlockIndex);
        if(lines[redundantBlockIndex + 1]?.includes('^FS')) blocksToRemove.add(redundantBlockIndex+1);
        hasChanged = true;
    }
    
    const finalLines = lines.filter((_, index) => !blocksToRemove.has(index));
    let out = finalLines.join("\n").replace(/\n{2,}/g, "\n"); // Limpa linhas vazias extras

    return { out: ensureCI28(out), changed: hasChanged };
}

export async function remixZplDataAction(
  prevState: { result: RemixZplDataOutput | null; error: string | null },
  formData: FormData
): Promise<{ result: RemixZplDataOutput | null; error: string | null }> {
  const originalZpl = formData.get('originalZpl') as string;
  const baselineDataJSON = formData.get('baselineData') as string;
  const remixedDataJSON  = formData.get('remixedData') as string;
  // matchMode não é mais lido do form

  if (!originalZpl || !remixedDataJSON || !baselineDataJSON) {
    return { result: null, error: 'Faltam dados: originalZpl, baselineData ou remixedData.' };
  }

  try {
    const remixed  = JSON.parse(remixedDataJSON)  as AnalyzeLabelOutput;

    // Normaliza campos ausentes para strings vazias
    const allKeys: (keyof AnalyzeLabelOutput)[] = [
      'recipientName','streetAddress','city','state','zipCode',
      'orderNumber','invoiceNumber','trackingNumber',
      'senderName','senderAddress','estimatedDeliveryDate'
    ];
    allKeys.forEach((k) => {
      if ((remixed as any)[k] === null || (remixed as any)[k] === undefined) (remixed as any)[k] = '';
    });
    
    const anchors: AnchorMap = isMagaluTemplate(originalZpl) ? magaluAnchors() : {};
    
    // Tenta aplicar substituições ancoradas PRIMEIRO
    const { out, changed } = applyAnchoredReplacements(originalZpl, anchors, remixed);

    if (changed) {
      return { result: { modifiedZpl: out }, error: null };
    }

    // Se as âncoras não funcionarem (template desconhecido ou nenhuma alteração), usa LLM como fallback
    const flowInput: RemixZplDataInput = {
        originalZpl,
        baselineData: JSON.parse(baselineDataJSON),
        remixedData: remixed,
        matchMode: 'strict', // Ou simplesmente remova se o flow não precisar mais
        baselinePositions: anchors
    };

    const llmResult = await remixZplData(flowInput);
    const sanitizedZpl = (llmResult.modifiedZpl || '').replace(/```(?:zpl)?/g, '').trim();

    return { result: { modifiedZpl: ensureCI28(sanitizedZpl) }, error: null };

  } catch (e: any) {
    console.error('Error remixing ZPL data:', e);
    return { result: null, error: e.message || 'Ocorreu um erro ao gerar o novo ZPL.' };
  }
}
    

    

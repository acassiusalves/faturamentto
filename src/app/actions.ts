
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
import type { RemixZplDataInput, RemixZplDataOutput, AnalyzeLabelOutput, RemixableField, RemixLabelDataInput, OrganizeResult, StandardizeListOutput, LookupResult, LookupProductsInput } from '@/lib/types';

// === ADICIONAR ESTAS INTERFACES E FUNÇÕES NO INÍCIO DO actions.ts ===
// (Adicione após os imports existentes)

interface ZplField {
  x: number;
  y: number;
  content: string;
  startLine: number;
  endLine: number;
  isBarcode: boolean;
  isQrCode: boolean;
  hasEncoding: boolean;
  fieldType: 'text' | 'barcode' | 'qrcode';
  originalContent: string;
}

interface ZplAnalysis {
  fields: ZplField[];
  barcodeFields: ZplField[];
  textFields: ZplField[];
  qrCodeFields: ZplField[];
}

interface FieldMapping {
  recipientName?: ZplField;
  streetAddress?: ZplField;
  city?: ZplField;
  zipCode?: ZplField;
  senderName?: ZplField;
  senderAddress?: ZplField;
  orderNumber?: ZplField;
  invoiceNumber?: ZplField;
  trackingNumber?: ZplField;
  estimatedDeliveryDate?: ZplField;
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
  const hasSenderLine    = /\^(FO|FT)\s*370\s*,\s*1047\b/i.test(zpl); // linha do nome do remetente
  return hasQR && hasRecipientLine && hasSenderLine;
}

// --- ÂNCORAS FIXAS DO MAGALU ---
function magaluAnchors(): AnchorMap {
  return {
    recipientName:   { x: 370, y: 736 },
    streetAddress:   { x: 370, y: 791 },
    zipCode:         { x: 370, y: 848 },   // CEP ao fim da linha
    senderName:      { x: 370, y: 1047 },
    senderAddress:   { x: 370, y: 1104 },
    city:            { x: 370, y: 848 },  // "CIDADE, UF"
    state:           { x: 370, y: 848 },  // mesma linha
  };
}

// === FUNÇÃO 1: ANÁLISE DA ESTRUTURA ZPL ===
function analyzeZplStructure(zpl: string): ZplAnalysis {
  const lines = zpl.split(/\r?\n/);
  const fields: ZplField[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detecta posicionamento ^FO ou ^FT
    const posMatch = line.match(/^\^(FO|FT)\s*(\d+)\s*,\s*(\d+)/i);
    if (!posMatch) continue;
    
    const x = parseInt(posMatch[2]);
    const y = parseInt(posMatch[3]);
    
    // Procura o bloco completo até ^FS
    let blockEnd = -1;
    let blockContent = '';
    let hasBarcode = false;
    let hasQrCode = false;
    let hasEncoding = false;
    let dataContent = '';
    
    // Analisa o bloco
    for (let j = i; j < lines.length; j++) {
      const blockLine = lines[j].trim();
      blockContent += blockLine + '\n';
      
      // Detecta tipos de campo
      if (/^\^B[A-Z]/i.test(blockLine)) hasBarcode = true;
      if (/^\^BQ/i.test(blockLine)) hasQrCode = true;
      if (/^\^FH/i.test(blockLine)) hasEncoding = true;
      
      // Extrai conteúdo do campo ^FD
      const fdMatch = blockLine.match(/^\^FD(.*)$/i);
      if (fdMatch) {
        dataContent = fdMatch[1].replace(/\^FS$/, '');
      }
      
      // Fim do bloco
      if (/\^FS/.test(blockLine)) {
        blockEnd = j;
        break;
      }
    }
    
    if (blockEnd === -1) continue;
    
    // Decodifica conteúdo se tiver ^FH
    let decodedContent = dataContent;
    if (hasEncoding && dataContent) {
      decodedContent = fhDecode(dataContent);
    }
    
    // Determina o tipo do campo
    let fieldType: 'text' | 'barcode' | 'qrcode' = 'text';
    if (hasQrCode) fieldType = 'qrcode';
    else if (hasBarcode) fieldType = 'barcode';
    
    fields.push({
      x,
      y,
      content: decodedContent,
      startLine: i,
      endLine: blockEnd,
      isBarcode: hasBarcode,
      isQrCode: hasQrCode,
      hasEncoding,
      fieldType,
      originalContent: blockContent.trim()
    });
    
    // Pula para após o bloco
    i = blockEnd;
  }
  
  return {
    fields,
    barcodeFields: fields.filter(f => f.isBarcode),
    textFields: fields.filter(f => f.fieldType === 'text'),
    qrCodeFields: fields.filter(f => f.isQrCode)
  };
}

// === FUNÇÃO 2: MAPEAMENTO DE CAMPOS ===
function mapFieldsToData(analysis: ZplAnalysis, originalData: AnalyzeLabelOutput): FieldMapping {
  const mapping: FieldMapping = {};
  const textFields = [...analysis.textFields]; // Cópia para não modificar original
  
  // Função de similaridade de texto
  const similarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w]/g, '');
    const normA = normalize(a);
    const normB = normalize(b);
    
    if (normA === normB) return 1;
    if (normA.includes(normB) || normB.includes(normA)) return 0.8;
    
    // Verifica números (CEP, pedidos, etc)
    if (/^\d+$/.test(normA) && /^\d+$/.test(normB)) {
      return normA === normB ? 1 : 0;
    }
    
    return 0;
  };
  
  // Mapeia cada campo dos dados originais
  Object.entries(originalData).forEach(([key, value]) => {
    if (!value || typeof value !== 'string') return;
    
    let bestMatch: ZplField | null = null;
    let bestScore = 0;
    
    textFields.forEach((field, index) => {
      const score = similarity(field.content, value);
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = field;
      }
    });
    
    if (bestMatch) {
      (mapping as any)[key] = bestMatch;
      // Remove do array para não mapear novamente
      const index = textFields.indexOf(bestMatch);
      if (index > -1) textFields.splice(index, 1);
    }
  });
  
  return mapping;
}

// === FUNÇÃO 3: APLICAR SUBSTITUIÇÕES ===
function applySmartReplacements(
  originalZpl: string,
  mapping: FieldMapping,
  newData: AnalyzeLabelOutput
): { modifiedZpl: string; changesApplied: number } {
  const lines = originalZpl.split(/\r?\n/);
  let changesApplied = 0;
  
  Object.entries(mapping).forEach(([dataKey, field]) => {
    if (!field) return;
    
    const newValue = (newData as any)[dataKey];
    if (newValue === undefined || typeof newValue !== 'string') return;
    
    // Encontra a linha com ^FD no bloco do campo
    for (let i = field.startLine; i <= field.endLine; i++) {
      if (lines[i].includes('^FD')) {
        const encodedValue = field.hasEncoding ? fhEncode(newValue) : newValue;
        
        // Substitui apenas o conteúdo, mantendo ^FD e ^FS
        lines[i] = lines[i].replace(
          /(\^FD).*?(\^FS|$)/,
          `$1${encodedValue}$2`
        );
        
        changesApplied++;
        break;
      }
    }
  });
  
  return {
    modifiedZpl: ensureCI28(lines.join('\n')),
    changesApplied
  };
}

// === FUNÇÃO 4: DETECÇÃO AUTOMÁTICA PRINCIPAL ===
function autoDetectAndReplace(
  originalZpl: string,
  originalData: AnalyzeLabelOutput,
  newData: AnalyzeLabelOutput
): {
  success: boolean;
  modifiedZpl?: string;
  changesApplied?: number;
  fieldsDetected?: number;
  error?: string;
} {
  try {
    // 1. Analisa estrutura do ZPL
    const analysis = analyzeZplStructure(originalZpl);
    
    if (analysis.textFields.length === 0) {
      return {
        success: false,
        error: 'Nenhum campo de texto detectado no ZPL'
      };
    }
    
    // 2. Mapeia campos automaticamente
    const mapping = mapFieldsToData(analysis, originalData);
    
    // 3. Aplica substituições
    const { modifiedZpl, changesApplied } = applySmartReplacements(
      originalZpl,
      mapping,
      newData
    );
    
    return {
      success: true,
      modifiedZpl,
      changesApplied,
      fieldsDetected: analysis.textFields.length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

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
        
        const settings = await loadAppSettings();
        const apiKey = settings?.geminiApiKey;
        
        if (!apiKey) {
             return { analysis: null, error: 'A chave de API do Gemini não está configurada no sistema.' };
        }

        const flowInput: RemixLabelDataInput = {
            fieldToRemix: fieldToRemix,
            originalValue: originalData[fieldToRemix] as string,
            apiKey: apiKey
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
    .replace(/[^\w\s-]/g, " ") // Mantém o hífen
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}


function composeCityState(city?: string, state?: string) {
  const c = (city || '').trim();
  const s = (state || '').trim();
  if (!c && !s) return '';
  if (!c) return s.toUpperCase();
  if (!s) return c.toUpperCase();
  return `${c.toUpperCase()}, ${s.toUpperCase()}`;
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
  console.log('🚀 Nova remixZplDataAction executando...');
  const originalZpl = formData.get('originalZpl') as string;
  const baselineDataJSON = formData.get('baselineData') as string;
  const remixedDataJSON  = formData.get('remixedData') as string;
  
  if (!originalZpl || !remixedDataJSON || !baselineDataJSON) {
    return { result: null, error: 'Faltam dados: originalZpl, baselineData ou remixedData.' };
  }

  try {
    const baselineData = JSON.parse(baselineDataJSON) as AnalyzeLabelOutput;
    const remixedData  = JSON.parse(remixedDataJSON)  as AnalyzeLabelOutput;

    // Normaliza campos ausentes para strings vazias
    const allKeys: (keyof AnalyzeLabelOutput)[] = [
      'recipientName','streetAddress','city','state','zipCode',
      'orderNumber','invoiceNumber','trackingNumber',
      'senderName','senderAddress','estimatedDeliveryDate'
    ];
    allKeys.forEach((k) => {
      if ((remixedData as any)[k] === null || (remixedData as any)[k] === undefined) {
        (remixedData as any)[k] = '';
      }
    });
    
    // === 🎯 MÉTODO 1: DETECÇÃO AUTOMÁTICA (NOVO E PRINCIPAL) ===
    console.log('🤖 Tentando detecção automática de campos...');
    const autoResult = autoDetectAndReplace(originalZpl, baselineData, remixedData);
    
    if (autoResult.success && autoResult.changesApplied && autoResult.changesApplied > 0) {
      console.log(`✅ Detecção automática: ${autoResult.changesApplied} campos atualizados de ${autoResult.fieldsDetected} detectados`);
      return { 
        result: { modifiedZpl: autoResult.modifiedZpl! }, 
        error: null 
      };
    }

    // === 🎯 MÉTODO 2: ÂNCORAS FIXAS (FALLBACK PARA TEMPLATES CONHECIDOS) ===  
    console.log('⚓ Tentando sistema de âncoras fixas...');
    const anchors: AnchorMap = isMagaluTemplate(originalZpl) ? magaluAnchors() : {};
    
    if (Object.keys(anchors).length > 0) {
      const { out, changed } = applyAnchoredReplacements(originalZpl, anchors, remixedData);
      
      if (changed) {
        console.log('✅ Âncoras fixas (template Magalu) aplicadas com sucesso');
        return { result: { modifiedZpl: out }, error: null };
      }
    }

    // === 🎯 MÉTODO 3: IA COMO ÚLTIMO RECURSO ===
    console.log('🧠 Usando IA como último recurso...');
    const flowInput: RemixZplDataInput = {
        originalZpl,
        baselineData,
        remixedData,
        matchMode: 'strict',
        baselinePositions: anchors
    };

    const llmResult = await remixZplData(flowInput);
    const sanitizedZpl = (llmResult.modifiedZpl || '').replace(/```(?:zpl)?/g, '').trim();
    
    if (!sanitizedZpl || sanitizedZpl.length < 50) {
      return { 
        result: null, 
        error: 'Não foi possível aplicar as alterações. O formato desta etiqueta não é compatível com nenhum método de edição disponível.' 
      };
    }
    
    console.log('⚠️ IA utilizada como fallback - verifique o resultado');
    const result = { modifiedZpl: ensureCI28(sanitizedZpl) };
    return { result, error: null };

  } catch (e: any) {
    console.error('❌ Error remixing ZPL data:', e);
    return { 
      result: null, 
      error: e.message || 'Ocorreu um erro ao gerar o novo ZPL.' 
    };
  }
}
    

    

    
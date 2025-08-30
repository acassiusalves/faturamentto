

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
import { regenerateZpl, type RegenerateZplInput, type RegenerateZplOutput } from '@/ai/flows/regenerate-zpl-flow';

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
      element: ZplTextElement;
      confidence: number;
    }
  };
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

// === FUNÇÃO 1: EXTRAÇÃO COMPLETA DE ELEMENTOS DE TEXTO ===
function extractAllTextElements(zpl: string): ZplTextElement[] {
  const lines = zpl.split(/\r?\n/);
  const elements: ZplTextElement[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detecta início de bloco com posicionamento
    const posMatch = line.match(/^\^(FO|FT)\s*(\d+)\s*,\s*(\d+)/i);
    if (!posMatch) continue;
    
    const x = parseInt(posMatch[2]);
    const y = parseInt(posMatch[3]);
    
    // Analisa o bloco completo
    let blockEnd = -1;
    let hasBarcode = false;
    let hasQrCode = false;
    let hasEncoding = false;
    let dataContent = '';
    let fdLineIndex = -1;
    
    for (let j = i; j < lines.length; j++) {
      const blockLine = lines[j].trim();
      
      // Detecta tipos
      if (/^\^B[A-Z]/i.test(blockLine)) hasBarcode = true;
      if (/^\^BQ/i.test(blockLine)) hasQrCode = true;
      if (/^\^FH/i.test(blockLine)) hasEncoding = true;
      
      // Encontra ^FD
      if (blockLine.includes('^FD')) {
        fdLineIndex = j;
        const fdMatch = blockLine.match(/\^FD(.*)$/i);
        if (fdMatch) {
          dataContent = fdMatch[1].replace(/\^FS$/, '');
        }
      }
      
      if (/\^FS/.test(blockLine)) {
        blockEnd = j;
        break;
      }
    }
    
    if (blockEnd === -1 || fdLineIndex === -1) continue;
    
    // Só processa campos de texto (não códigos)
    if (hasBarcode || hasQrCode) continue;
    
    // Decodifica conteúdo
    let decodedContent = dataContent;
    if (hasEncoding && dataContent) {
      decodedContent = fhDecode(dataContent);
    }
    
    // Ignora campos vazios ou muito pequenos
    if (!decodedContent || decodedContent.length < 2) continue;
    
    elements.push({
      content: decodedContent,
      rawContent: dataContent,
      x,
      y,
      startLine: i,
      endLine: blockEnd,
      fdLineIndex,
      hasEncoding,
      isBarcode: hasBarcode,
      isQrCode: hasQrCode
    });
    
    i = blockEnd; // Pula para depois do bloco
  }
  
  return elements;
}


// === PARSING CORRETO PARA REMETENTE EM 4 CAMPOS ===

// Função para parsing específico do endereço do remetente
function parseSenderAddress(fullAddress: string): {
  address?: string;
  neighborhood?: string; // Novo campo para bairro
  cityState?: string; 
  zipCode?: string;
} {
  const result: { address?: string; neighborhood?: string; cityState?: string; zipCode?: string } = {};
  
  // Remove espaços extras
  const clean = fullAddress.trim();
  
  // Padrão específico para: "RUA DA ALFÂNDEGA, 200 - SALA 208 BRÁS - 030060330 SÃO PAULO, SP"
  // Regex para capturar: endereço - bairro - cep cidade, estado
  const complexMatch = clean.match(/^(.+?)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]+)\s*-\s*(\d{8})\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]+),?\s*([A-Z]{2})$/i);
  
  if (complexMatch) {
    const addressPart = complexMatch[1].trim();
    const neighborhood = complexMatch[2].trim();
    const zipCode = complexMatch[3];
    const city = complexMatch[4].trim();
    const state = complexMatch[5].trim();
    
    result.address = addressPart;
    result.neighborhood = `${neighborhood} - ${zipCode}`;
    result.cityState = `${city}-${state}`;
    result.zipCode = zipCode;
    
    return result;
  }
  
  // Padrão alternativo mais flexível
  // Tenta identificar estrutura: endereço + bairro + cep + cidade + estado
  const flexibleMatch = clean.match(/^(.+?)\s+(BRÁS|CENTRO|[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]{3,15})\s*-?\s*(\d{8})\s*(.+)$/i);
  
  if (flexibleMatch) {
    const addressPart = flexibleMatch[1].trim();
    const neighborhood = flexibleMatch[2].trim();
    const zipCode = flexibleMatch[3];
    const remainder = flexibleMatch[4].trim();
    
    // Tenta extrair cidade e estado do restante
    const cityStateMatch = remainder.match(/^([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]+),?\s*([A-Z]{2})$/i);
    
    if (cityStateMatch) {
      result.address = addressPart;
      result.neighborhood = `${neighborhood} - ${zipCode}`;
      result.cityState = `${cityStateMatch[1].trim()}-${cityStateMatch[2].trim()}`;
      result.zipCode = zipCode;
      return result;
    }
  }
  
  // Se não conseguiu separar completamente, tenta ao menos extrair CEP e cidade
  const basicMatch = clean.match(/^(.+?)\s*(\d{8})\s*([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s,]+)$/i);
  if (basicMatch) {
    result.address = basicMatch[1].trim();
    result.zipCode = basicMatch[2];
    result.cityState = basicMatch[3].trim().replace(/,\s*/, '-');
    return result;
  }
  
  // Fallback: retorna como endereço
  result.address = clean;
  return result;
}

// === INTERFACE ESTENDIDA PARA SUPORTAR BAIRRO ===
interface ZplAddressStructure {
  recipientName?: ZplTextElement;
  recipientAddress?: ZplTextElement;
  recipientCityState?: ZplTextElement;
  senderName?: ZplTextElement;
  senderAddress?: ZplTextElement;  
  senderNeighborhood?: ZplTextElement; // Novo campo
  senderCityState?: ZplTextElement;
  zipCode?: ZplTextElement;
}

// === FUNÇÃO ATUALIZADA DE IDENTIFICAÇÃO ===
function identifyAddressStructureImproved(elements: ZplTextElement[]): ZplAddressStructure {
  const structure: ZplAddressStructure = {};
  
  const sortedByY = [...elements].sort((a, b) => a.y - b.y);
  
  const patterns = {
    cep: /^\d{5}-?\d{3}$|^\d{8}$/,
    cityState: /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]+[,\-]\s*[A-Z]{2}$/i,
    street: /^(rua|r\.|av|avenida|alameda|travessa|pça|praça).+\d+|.+\d+.*\-.*/i,
    personName: /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ\s]{5,}$/i,
    complexSenderAddress: /.+\d+.+[A-Z]{2}.*\d{8}|.+\d{8}.+[A-Z]{2}/i
  };
  
  let senderAreaStart = -1;
  
  sortedByY.forEach((element, index) => {
    if (element.y >= 900 && senderAreaStart === -1) {
      senderAreaStart = index;
    }
  });
  
  sortedByY.forEach((element, index) => {
    const content = element.content.trim();
    
    // CEP isolado
    if (patterns.cep.test(content)) {
      structure.zipCode = element;
      return;
    }
    
    // Cidade + Estado isolados
    if (patterns.cityState.test(content)) {
      if (index < senderAreaStart && !structure.recipientCityState) {
        structure.recipientCityState = element;
      } else if (!structure.senderCityState) {
        structure.senderCityState = element;
      }
      return;
    }
    
    // Endereço complexo do remetente (prioridade para área do remetente)
    if (index >= senderAreaStart && patterns.complexSenderAddress.test(content) && content.length > 30) {
      const parsed = parseSenderAddress(content);
      
      if (parsed.address) {
        structure.senderAddress = { ...element, content: parsed.address };
      }
      if (parsed.neighborhood) {
        structure.senderNeighborhood = { ...element, content: parsed.neighborhood };
      }
      if (parsed.cityState) {
        structure.senderCityState = { ...element, content: parsed.cityState };
      }
      if (parsed.zipCode && !structure.zipCode) {
        structure.zipCode = { ...element, content: parsed.zipCode };
      }
      return;
    }
    
    // Endereços simples
    if (patterns.street.test(content) || /\d+/.test(content)) {
      if (index < senderAreaStart && !structure.recipientAddress) {
        structure.recipientAddress = element;
      } else if (index >= senderAreaStart && !structure.senderAddress) {
        structure.senderAddress = element;
      }
      return;
    }
    
    // Nomes
    if (patterns.personName.test(content) && 
        !patterns.cityState.test(content) && 
        !patterns.street.test(content) &&
        !/^\d+$/.test(content)) {
      
      if (index < senderAreaStart && !structure.recipientName) {
        structure.recipientName = element;
      } else if (index >= senderAreaStart && !structure.senderName) {
        structure.senderName = element;
      }
    }
  });
  
  return structure;
}

// === MAPEAMENTO ATUALIZADO COM BAIRRO ===
function mapAddressFieldsSeparatelyImproved(
  elements: ZplTextElement[], 
  extractedData: AnalyzeLabelOutput
): ZplMapping['mappedFields'] {
  const mapping: ZplMapping['mappedFields'] = {};
  const addressStructure = identifyAddressStructureImproved(elements);
  
  // Mapeia campos diretos
  const directMappings = [
    { field: 'orderNumber', patterns: [/^\d{8,15}$/, /pedido.*(\d+)/i] },
    { field: 'invoiceNumber', patterns: [/^\d{6,12}$/, /nf.*(\d+)/i] },
    { field: 'trackingNumber', patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/, /^[A-Z0-9]{13}$/] }
  ];
  
  directMappings.forEach(({ field, patterns }) => {
    const extractedValue = (extractedData as any)[field];
    if (!extractedValue) return;
    
    const element = elements.find(el => {
      if (el.content.includes(extractedValue)) return true;
      return patterns.some(pattern => pattern.test(el.content));
    });
    
    if (element) {
      (mapping as any)[field] = { element, confidence: 95 };
      const index = elements.indexOf(element);
      if (index > -1) elements.splice(index, 1);
    }
  });
  
  // Mapeia estrutura de endereços
  if (addressStructure.recipientName) {
    mapping.recipientName = { element: addressStructure.recipientName, confidence: 95 };
  }
  
  if (addressStructure.recipientAddress) {
    mapping.streetAddress = { element: addressStructure.recipientAddress, confidence: 95 };
  }
  
  if (addressStructure.recipientCityState) {
    mapping.city = { element: addressStructure.recipientCityState, confidence: 95 };
  }
  
  if (addressStructure.senderName) {
    mapping.senderName = { element: addressStructure.senderName, confidence: 95 };
  }
  
  if (addressStructure.senderAddress) {
    mapping.senderAddress = { element: addressStructure.senderAddress, confidence: 95 };
  }
  
  // Novo mapeamento para bairro do remetente
  if (addressStructure.senderNeighborhood) {
    // Mapeia para um campo personalizado (você pode precisar adicionar este campo ao tipo AnalyzeLabelOutput)
    (mapping as any).senderNeighborhood = { element: addressStructure.senderNeighborhood, confidence: 95 };
  }
  
  if (addressStructure.senderCityState) {
    // Se não temos cidade do destinatário, usa a do remetente como estado
    if (!mapping.city) {
      (mapping as any).senderCityState = { element: addressStructure.senderCityState, confidence: 95 };
    }
  }
  
  if (addressStructure.zipCode) {
    mapping.zipCode = { element: addressStructure.zipCode, confidence: 98 };
  }
  
  return mapping;
}

// === CORREÇÃO DE DADOS ATUALIZADA ===
function fixAddressSeparation(
  extractedData: AnalyzeLabelOutput,
  mapping: ZplMapping
): AnalyzeLabelOutput {
  const correctedData = { ...extractedData };
  const { mappedFields } = mapping;
  
  // Destinatário (mantém lógica existente)
  if (mappedFields.recipientName?.element.content) {
    correctedData.recipientName = mappedFields.recipientName.element.content;
  }
  
  if (mappedFields.streetAddress?.element.content) {
    correctedData.streetAddress = mappedFields.streetAddress.element.content;
  }
  
  if (mappedFields.city?.element.content) {
    const cityStateContent = mappedFields.city.element.content;
    const cityStateMatch = cityStateContent.match(/^(.+?)[,\-]\s*([A-Z]{2})$/i);
    if (cityStateMatch) {
      correctedData.city = cityStateMatch[1].trim();
      correctedData.state = cityStateMatch[2].trim().toUpperCase();
    } else {
      correctedData.city = cityStateContent;
    }
  }
  
  if (mappedFields.zipCode?.element.content) {
    correctedData.zipCode = mappedFields.zipCode.element.content.replace(/\D/g, '');
  }
  
  // Remetente com parsing específico
  if (mappedFields.senderName?.element.content) {
    correctedData.senderName = mappedFields.senderName.element.content;
  }
  
  if (mappedFields.senderAddress?.element.content) {
    correctedData.senderAddress = mappedFields.senderAddress.element.content;
  }
  
  // Adiciona campos estendidos para o remetente
  (correctedData as any).senderNeighborhood = (mappedFields as any).senderNeighborhood?.element.content || '';
  (correctedData as any).senderCityState = (mappedFields as any).senderCityState?.element.content || '';
  
  return correctedData;
}


// === FUNÇÃO 3: APLICAÇÃO PRECISA DAS ALTERAÇÕES ===
function applyPreciseChanges(
  originalZpl: string,
  mapping: ZplMapping['mappedFields'],
  newData: AnalyzeLabelOutput
): { modifiedZpl: string; changesApplied: number; details: string[] } {
  const lines = originalZpl.split(/\r?\n/);
  let changesApplied = 0;
  const details: string[] = [];
  
  Object.entries(mapping).forEach(([fieldName, fieldMapping]) => {
    if (!fieldMapping) return;
    
    const newValue = (newData as any)[fieldName];
    if (newValue === null || newValue === undefined) return; // Allow empty strings but not null/undefined
    
    const element = fieldMapping.element;
    const fdLine = lines[element.fdLineIndex];
    
    if (!fdLine || !fdLine.includes('^FD')) return;
    
    // Codifica se necessário
    const encodedValue = element.hasEncoding ? fhEncode(String(newValue)) : String(newValue);
    
    // Substitui mantendo estrutura ^FD...^FS
    const newLine = fdLine.replace(
      /(\^FD).*?(\^FS|$)/,
      `$1${encodedValue}$2`
    );
    
    if (newLine !== fdLine) {
      lines[element.fdLineIndex] = newLine;
      changesApplied++;
      details.push(`${fieldName}: "${element.content}" → "${newValue}" (linha ${element.fdLineIndex + 1})`);
    }
  });
  
  return {
    modifiedZpl: ensureCI28(lines.join('\n')),
    changesApplied,
    details
  };
}


function preciseMappingAndAnalysis(
  originalZpl: string,
  extractedData: AnalyzeLabelOutput
): {
  success: boolean;
  mapping?: ZplMapping;
  correctedData?: AnalyzeLabelOutput; // Nova propriedade
  error?: string;
  stats?: {
    totalElements: number;
    mappedFields: number;
    unmappedElements: number;
  }
} {
  try {
    // 1. Extrai todos os elementos de texto
    const allElements = extractAllTextElements(originalZpl);
    
    if (allElements.length === 0) {
      return {
        success: false,
        error: 'Nenhum elemento de texto encontrado no ZPL'
      };
    }
    
    // 2. Usa mapeamento melhorado para endereços
    const mappedFields = mapAddressFieldsSeparatelyImproved([...allElements], extractedData);
    
    const mapping: ZplMapping = {
      allTextElements: allElements,
      mappedFields
    };
    
    // 3. Corrige dados extraídos baseado no mapeamento
    const correctedData = fixAddressSeparation(extractedData, mapping);
    
    return {
      success: true,
      mapping,
      correctedData, // Dados corrigidos com endereços separados
      stats: {
        totalElements: allElements.length,
        mappedFields: Object.keys(mappedFields).length,
        unmappedElements: allElements.length - Object.keys(mappedFields).length
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no mapeamento'
    };
  }
}

function applyChangesWithPreciseMapping(
  originalZpl: string,
  mapping: ZplMapping,
  newData: AnalyzeLabelOutput
): {
  success: boolean;
  modifiedZpl?: string;
  changesApplied?: number;
  details?: string[];
  error?: string;
} {
  try {
    const result = applyPreciseChanges(originalZpl, mapping.mappedFields, newData);
    
    return {
      success: true,
      modifiedZpl: result.modifiedZpl,
      changesApplied: result.changesApplied,
      details: result.details
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao aplicar alterações'
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
  console.log('🚀 Iniciando mapeamento preciso do ZPL...');
  
  const originalZpl = formData.get('originalZpl') as string;
  const baselineDataJSON = formData.get('baselineData') as string;
  const remixedDataJSON = formData.get('remixedData') as string;
  
  if (!originalZpl || !remixedDataJSON || !baselineDataJSON) {
    return { result: null, error: 'Faltam dados: originalZpl, baselineData ou remixedData.' };
  }

  try {
    const baselineData = JSON.parse(baselineDataJSON) as AnalyzeLabelOutput;
    const remixedData = JSON.parse(remixedDataJSON) as AnalyzeLabelOutput;

    // Normaliza campos ausentes
    const allKeys: (keyof AnalyzeLabelOutput)[] = [
      'recipientName', 'streetAddress', 'city', 'state', 'zipCode',
      'orderNumber', 'invoiceNumber', 'trackingNumber',
      'senderName', 'senderAddress', 'estimatedDeliveryDate'
    ];
    
    allKeys.forEach((k) => {
      if ((remixedData as any)[k] === null || (remixedData as any)[k] === undefined) {
        (remixedData as any)[k] = '';
      }
    });

    // === 🎯 MÉTODO 1: MAPEAMENTO PRECISO COM CORREÇÃO DE ENDEREÇOS ===
    console.log('🗺️ Fazendo mapeamento completo do ZPL com correção de endereços...');
    const mappingResult = preciseMappingAndAnalysis(originalZpl, baselineData);
    
    if (mappingResult.success && mappingResult.mapping) {
      const { mapping, stats, correctedData } = mappingResult;
      
      console.log(`📊 Mapeamento: ${stats!.mappedFields} campos mapeados de ${stats!.totalElements} elementos`);
      
      const dataToApply = correctedData || remixedData;
      
      const changeResult = applyChangesWithPreciseMapping(originalZpl, mapping, dataToApply);
      
      if (changeResult.success && changeResult.changesApplied! > 0) {
        console.log(`✅ Mapeamento preciso: ${changeResult.changesApplied} alterações aplicadas`);
        console.log('📝 Detalhes das alterações:', changeResult.details);
        
        return {
          result: { 
            modifiedZpl: changeResult.modifiedZpl!,
            correctedData: dataToApply
          } as any,
          error: null
        };
      } else {
        console.log('ℹ️ Mapeamento preciso não encontrou alterações para aplicar');
      }
    } else {
      console.log('⚠️ Mapeamento preciso falhou:', mappingResult.error);
    }

    // === 🎯 MÉTODO 2: ÂNCORAS FIXAS (FALLBACK) ===  
    console.log('⚓ Tentando sistema de âncoras fixas...');
    const anchors: AnchorMap = isMagaluTemplate(originalZpl) ? magaluAnchors() : {};
    
    if (Object.keys(anchors).length > 0) {
      const { out, changed } = applyAnchoredReplacements(originalZpl, anchors, remixedData);
      
      if (changed) {
        console.log('✅ Âncoras fixas aplicadas com sucesso');
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
        error: 'Não foi possível aplicar as alterações. Nenhum método conseguiu mapear os campos desta etiqueta.'
      };
    }
    
    console.log('⚠️ IA utilizada como fallback - verifique o resultado');
    return { result: { modifiedZpl: ensureCI28(sanitizedZpl) }, error: null };

  } catch (e: any) {
    console.error('❌ Erro no mapeamento preciso:', e);
    return {
      result: null,
      error: e.message || 'Ocorreu um erro ao processar a etiqueta.'
    };
  }
}

export async function correctExtractedDataAction(
  prevState: { analysis: AnalyzeLabelOutput | null; error: string | null },
  formData: FormData
): Promise<{ analysis: AnalyzeLabelOutput | null; error: string | null }> {
  const originalZpl = formData.get('originalZpl') as string;
  const extractedDataJSON = formData.get('extractedData') as string;
  
  if (!originalZpl || !extractedDataJSON) {
    return { analysis: null, error: 'Dados faltando para correção' };
  }
  
  try {
    const extractedData = JSON.parse(extractedDataJSON) as AnalyzeLabelOutput;
    const mappingResult = preciseMappingAndAnalysis(originalZpl, extractedData);
    
    if (mappingResult.success && mappingResult.correctedData) {
      return { 
        analysis: mappingResult.correctedData, 
        error: null 
      };
    } else {
      return { 
        analysis: extractedData, 
        error: mappingResult.error || 'Não foi possível corrigir os dados' 
      };
    }
  } catch (e: any) {
    return { 
      analysis: null, 
      error: e.message || 'Erro ao processar correção de dados' 
    };
  }
}


// === FUNÇÃO PARA DEBUG: EXIBIR ELEMENTOS MAPEADOS ===
export async function debugMappingAction(
  prevState: { result: any | null; error: string | null },
  formData: FormData
): Promise<{ result: any | null; error: string | null }> {
  const originalZpl = formData.get('originalZpl') as string;
  const extractedDataJSON = formData.get('extractedData') as string;
  
  if (!originalZpl || !extractedDataJSON) {
    return { result: null, error: 'Dados faltando para debug' };
  }
  
  try {
    const extractedData = JSON.parse(extractedDataJSON) as AnalyzeLabelOutput;
    const mappingResult = preciseMappingAndAnalysis(originalZpl, extractedData);
    
    if (mappingResult.success) {
      const debugInfo = {
        stats: mappingResult.stats,
        allElements: mappingResult.mapping!.allTextElements.map(el => ({
          content: el.content,
          position: `${el.x},${el.y}`,
          line: el.fdLineIndex + 1
        })),
        mappedFields: Object.entries(mappingResult.mapping!.mappedFields).map(([field, mapping]) => ({
          field,
          content: mapping!.element.content,
          position: `${mapping!.element.x},${mapping!.element.y}`,
          confidence: mapping!.confidence,
          line: mapping!.element.fdLineIndex + 1
        }))
      };
      
      return { result: debugInfo, error: null };
    } else {
      return { result: null, error: mappingResult.error! };
    }
  } catch (e: any) {
    return { result: null, error: e.message };
  }
}
    
export async function regenerateZplAction(
  prevState: any,
  formData: FormData
): Promise<{
  result: RegenerateZplOutput | null;
  error: string | null;
}> {
  try {
    const originalZpl = formData.get('originalZpl') as string;
    const editedDataStr = formData.get('editedData') as string;
    
    if (!originalZpl || !editedDataStr) {
      return { result: null, error: 'Dados obrigatórios em falta.' };
    }

    const editedData = JSON.parse(editedDataStr);
    
    const result = await regenerateZpl({
      originalZpl,
      editedData
    });

    return { result, error: null };
  } catch (error) {
    console.error('Erro ao regenerar ZPL:', error);
    return { 
      result: null, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao regenerar ZPL.' 
    };
  }
}
    

    

    




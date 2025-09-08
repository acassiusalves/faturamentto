
'use server';

import { loadAllTrendKeywords } from '@/services/firestore';
import { z } from 'genkit';

const TrendingProductInfoSchema = z.object({
  productName: z.string(),
  matchedKeywords: z.array(z.string()),
});
export type TrendingProductsOutput = { trendingProducts: z.infer<typeof TrendingProductInfoSchema>[] };

// --- Normalização ---
const ACCENT: Record<string,string> = { á:'a',à:'a',ã:'a',â:'a',ä:'a', é:'e',ê:'e',ë:'e', í:'i',î:'i',ï:'i', ó:'o',ô:'o',õ:'o',ö:'o', ú:'u',û:'u',ü:'u', ç:'c' };
const stripAccents = (s:string)=> s.replace(/[^\u0000-\u007E]/g,c=>ACCENT[c] ?? c);
const normalize = (s:string)=> stripAccents(s)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu,' ')       // tira pontuação
  .replace(/\s+/g,' ')
  .trim();

// Palavras inúteis pra decisão
const STOP = new Set([
  'para','de','da','do','das','dos','e','com','sem','por','pra','pro','a','o','os','as','no','na','nos','nas','em',
  // ruídos comuns dos seus nomes:
  'rgb','luz','gamer','multimidia','multimedia','smartphone','notebook','pc','fm','sd','aux','usb',
  'led','abnt2','brasileiro','crakeado','sem','fio','2','4g','combo','mouse','teclado','kit','metal','com'
]);

// Termos que INVALIDAM (acessórios/peças/consumíveis)
const NEG = new Set(['fio','cabo','bateria','carregador','fonte','pelicula','capa','case','adaptador','suporte','refil','cartucho','fita']);

// Núcleos por categoria (ajuda a evitar falso positivo)
const CORE_HINTS = new Set([
  // áudio
  'caixa','som','speaker','soundbar','bluetooth',
  // periféricos
  'teclado','mouse','teclado-mouse','combo',
  // outros exemplos
  'headset','fone'
]);

// remove bloco inicial de SKU/brand (EXBOM, BK-G800 etc.) e pega “o nome de verdade”
function stripSkuPrefix(name: string): string {
  const raw = normalize(name);
  // regra: corta os 1–3 primeiros tokens se forem “gritados” (tudo letra/num curta) típicos de SKU/marca
  const tokens = raw.split(' ');
  let i = 0, cut = 0;
  while (i < tokens.length && cut < 3) {
    const t = tokens[i];
    const isSkuish = /^[a-z0-9\-]{2,8}$/.test(t) || /^[a-z]{3,}$/.test(t) && ['exbom','multilaser','jbl','hp','dell','lg','logitech'].includes(t);
    if (isSkuish) { cut++; i++; } else break;
  }
  const rest = tokens.slice(cut).join(' ').trim();
  return rest || raw;
}

function tokenizeCore(text: string): string[] {
  const s = normalize(text);
  return s.split(' ')
    .filter(t => t && t.length > 2 && !STOP.has(t));
}

function isAccessory(tokens: string[]) {
  return tokens.some(t => NEG.has(t));
}

function coreTokens(tokens: string[]) {
  // foca no “substantivo” do produto
  return tokens.filter(t => CORE_HINTS.has(t) || /^[a-z]{4,}$/.test(t));
}

function matches(productName: string, trend: string): boolean {
  const base = stripSkuPrefix(productName);
  const pTokens = tokenizeCore(base);
  const tTokens = tokenizeCore(trend);

  if (!pTokens.length || !tTokens.length) return false;
  if (isAccessory(tTokens)) return false;

  const pCore = new Set(coreTokens(pTokens));
  const tSet  = new Set(tTokens);

  // heurísticas
  let overlap = 0;
  for (const t of tSet) if (pCore.has(t)) overlap++;

  const isCaixaSomP = pCore.has('caixa') && pCore.has('som');
  const isCaixaSomT = tSet.has('caixa') && tSet.has('som');

  if (isCaixaSomP && isCaixaSomT) return true;
  if (overlap >= 2) return true;

  // overlap == 1 mas o único termo é muito forte (ex.: "teclado" vs "teclado")
  if (overlap === 1) {
    for (const t of tSet) if (pCore.has(t) && CORE_HINTS.has(t)) return true;
  }

  return false;
}

export async function findTrendingProducts(productNames: string[]): Promise<TrendingProductsOutput> {
  const trendKeywords = await loadAllTrendKeywords();
  if (!trendKeywords?.length || !productNames?.length) return { trendingProducts: [] };

  const out: TrendingProductsOutput['trendingProducts'] = [];
  for (const name of productNames) {
    const hits: string[] = [];
    for (const kw of trendKeywords) if (matches(name, kw)) hits.push(kw);
    if (hits.length) out.push({ productName: name, matchedKeywords: hits });
  }
  return { trendingProducts: out };
}
